<?php

use App\Http\Middleware\AdminAuth;
use App\Http\Middleware\AppAdminAuth;
use App\Http\Middleware\BumpCatalogVersion;
use App\Http\Middleware\CacheHeaders;
use App\Http\Middleware\CustomerAuth;
use App\Http\Middleware\NoStoreHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        // API routes are served at the ROOT path (apiPrefix '') so the storefront
        // can call http://localhost:8000/products, /auth/admin/login, etc. — the
        // exact same paths the legacy PHP backend exposed.
        api: __DIR__.'/../routes/api.php',
        apiPrefix: '',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin.auth'    => AdminAuth::class,
            'app.admin'     => AppAdminAuth::class, // staff app: same rule, app envelope
            'customer.auth' => CustomerAuth::class,
            // Caching policy — see routes/api.php for where each one is applied.
            //   cache.public:<max-age>,<stale-while-revalidate>  public catalogue reads
            //   cache.private                                    anything personal
            //   catalog.bump                                     retires the catalogue after a write
            'cache.public'  => CacheHeaders::class,
            'cache.private' => NoStoreHeaders::class,
            'catalog.bump'  => BumpCatalogVersion::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Always answer with the {ok:false,error} envelope the React apps expect.
        $exceptions->shouldRenderJsonWhen(fn () => true);
        $exceptions->render(function (\Throwable $e, $request) {
            // Api::halt() throws this carrying a ready-made {ok:false} response — use it as-is.
            if ($e instanceof \Illuminate\Http\Exceptions\HttpResponseException) {
                return $e->getResponse();
            }
            $status = 500;
            if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                $status = $e->getStatusCode();
            } elseif ($e instanceof \Illuminate\Validation\ValidationException) {
                $status = 422;
            }
            // Staff app (/app/*): the {error, message, code, data} envelope.
            if ($request->is('app/*')) {
                if ($e instanceof \Illuminate\Validation\ValidationException) {
                    return \App\Support\AppApi::fail('Please check the highlighted fields.', 422, 'validation_failed',
                        ['fields' => collect($e->errors())->map(fn ($m) => $m[0])->all()]);
                }
                if ($e instanceof \Illuminate\Routing\Exceptions\InvalidSignatureException) {
                    return \App\Support\AppApi::fail('This image link has expired. Open the order again.', 403, 'link_expired');
                }
                [$msg, $reason] = match (true) {
                    $status === 404 => ['Not found.', 'not_found'],
                    $status === 405 => ['Method not allowed.', 'method_not_allowed'],
                    $status === 413 => ['The photo is too large.', 'image_too_large'],
                    $status === 429 => ['Too many requests. Please wait a moment.', 'rate_limited'],
                    $status >= 500 => ['Something went wrong on the server. Please try again.', 'server_error'],
                    default => [$e->getMessage() ?: 'Request failed.', 'request_failed'],
                };
                if ($status >= 500) {
                    report($e);
                }
                return \App\Support\AppApi::fail($msg, $status, $reason);
            }
            if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                $status = $e->getStatusCode();
            } elseif ($e instanceof \Illuminate\Validation\ValidationException) {
                $status = 422;
            }
            $payload = ['ok' => false, 'error' => $e->getMessage() ?: 'Server error'];
            if ($e instanceof \Illuminate\Validation\ValidationException) {
                $payload['error'] = 'Form mukammal karein';
                $payload['fields'] = collect($e->errors())->map(fn ($m) => $m[0])->all();
            }
            return response()->json($payload, $status);
        });
    })->create();

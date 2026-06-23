<?php

use App\Http\Middleware\AdminAuth;
use App\Http\Middleware\CustomerAuth;
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
            'customer.auth' => CustomerAuth::class,
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
            $payload = ['ok' => false, 'error' => $e->getMessage() ?: 'Server error'];
            if ($e instanceof \Illuminate\Validation\ValidationException) {
                $payload['error'] = 'Form mukammal karein';
                $payload['fields'] = collect($e->errors())->map(fn ($m) => $m[0])->all();
            }
            return response()->json($payload, $status);
        });
    })->create();

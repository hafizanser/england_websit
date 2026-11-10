<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\AppApi;
use App\Support\TokenAuth;
use Closure;
use Illuminate\Http\Request;

/**
 * Admin sign-in for the England Orders staff app (/app/*). Same rule as AdminAuth —
 * a Sanctum token owned by an admin with role "admin" — but it answers in the app's
 * {error, message, code, data} envelope instead of the website's {ok:false}.
 */
class AppAdminAuth
{
    public function handle(Request $request, Closure $next)
    {
        $admin = TokenAuth::admin($request);
        if (!$admin) {
            AppApi::halt('Your session has ended. Sign in again.', 401, 'unauthenticated');
        }
        $request->setUserResolver(fn () => $admin);
        $request->attributes->set('admin', $admin);
        return $next($request);
    }
}

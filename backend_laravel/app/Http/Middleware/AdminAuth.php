<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\Api;
use App\Support\TokenAuth;
use Closure;
use Illuminate\Http\Request;

class AdminAuth
{
    public function handle(Request $request, Closure $next)
    {
        $admin = TokenAuth::admin($request);
        if (!$admin) {
            Api::halt('Admin authentication required', 401);
        }
        $request->setUserResolver(fn () => $admin);
        $request->attributes->set('admin', $admin);
        return $next($request);
    }
}

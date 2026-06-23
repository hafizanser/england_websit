<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\Api;
use App\Support\TokenAuth;
use Closure;
use Illuminate\Http\Request;

class CustomerAuth
{
    public function handle(Request $request, Closure $next)
    {
        $customer = TokenAuth::customer($request);
        if (!$customer) {
            Api::halt('Login required', 401);
        }
        $request->setUserResolver(fn () => $customer);
        $request->attributes->set('customer', $customer);
        return $next($request);
    }
}

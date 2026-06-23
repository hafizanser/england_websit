<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Admin;
use App\Models\ShopCustomer;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Resolves the bearer token to its owning model (Sanctum), distinguishing the
 * two identity types the app issues tokens for: admins and storefront customers.
 * Mirrors the legacy Controller::requireAdmin / requireCustomer / optionalCustomer.
 */
class TokenAuth
{
    public static function tokenable(Request $request): ?object
    {
        $bearer = $request->bearerToken();
        if (!$bearer) {
            return null;
        }
        $token = PersonalAccessToken::findToken($bearer);
        return $token?->tokenable;
    }

    public static function admin(Request $request): ?Admin
    {
        $t = self::tokenable($request);
        return ($t instanceof Admin && $t->role === 'admin') ? $t : null;
    }

    public static function customer(Request $request): ?ShopCustomer
    {
        $t = self::tokenable($request);
        return $t instanceof ShopCustomer ? $t : null;
    }
}

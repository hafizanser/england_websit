<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\ShopCustomer;
use App\Support\TokenAuth;
use Illuminate\Http\Request;

abstract class Controller
{
    /** Resolved admin (admin.auth middleware guarantees it on protected routes). */
    protected function admin(Request $request): ?Admin
    {
        return $request->attributes->get('admin') ?? TokenAuth::admin($request);
    }

    /** Resolved customer (customer.auth middleware guarantees it on protected routes). */
    protected function customer(Request $request): ?ShopCustomer
    {
        return $request->attributes->get('customer') ?? TokenAuth::customer($request);
    }

    /** Logged-in customer if a valid token is present, else null (no error). */
    protected function optionalCustomer(Request $request): ?ShopCustomer
    {
        return TokenAuth::customer($request);
    }
}

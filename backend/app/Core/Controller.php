<?php
declare(strict_types=1);

namespace App\Core;

use App\Models\User;
use App\Models\Customer;

/** Base controller — gives access to the request + auth guard. */
abstract class Controller
{
    protected Request $request;

    public function __construct(Request $request)
    {
        $this->request = $request;
    }

    /** Ensure a valid admin bearer token; halts with 401 otherwise. */
    protected function requireAdmin(): array
    {
        $token = $this->request->bearerToken();
        $user = $token ? (new User())->findByToken($token) : null;
        if (!$user || $user['role'] !== 'admin') {
            Response::error('Admin authentication required', 401);
        }
        return $user;
    }

    /** Ensure a valid customer bearer token; halts with 401 otherwise. */
    protected function requireCustomer(): array
    {
        $token = $this->request->bearerToken();
        $customer = $token ? (new Customer())->findByToken($token) : null;
        if (!$customer) {
            Response::error('Login required', 401);
        }
        return $customer;
    }

    /** Return the logged-in customer if a valid token is present, else null. */
    protected function optionalCustomer(): ?array
    {
        $token = $this->request->bearerToken();
        return $token ? (new Customer())->findByToken($token) : null;
    }
}

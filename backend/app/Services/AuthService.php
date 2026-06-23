<?php
declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Models\Customer;

/** Admin auth + lightweight customer identity (phone lookup). */
class AuthService
{
    public function adminLogin(string $username, string $password): ?array
    {
        $user = (new User())->findByUsername($username);
        if (!$user || !password_verify($password, $user['password_hash'])) {
            return null;
        }
        $token = (new User())->issueToken((int)$user['id']);
        return [
            'token' => $token,
            'user'  => ['id' => (int)$user['id'], 'username' => $user['username'], 'role' => $user['role']],
        ];
    }

    public function adminLogout(string $token): void
    {
        (new User())->clearToken($token);
    }

    /** Customer "login" = locate an existing account by phone (no password, B2B style). */
    public function customerByPhone(string $phone): ?array
    {
        return (new Customer())->findByPhone($phone);
    }
}

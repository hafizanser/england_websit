<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

class User extends Model
{
    protected string $table = 'users';

    public function findByUsername(string $username): ?array
    {
        return $this->find('username', $username);
    }

    public function findByToken(string $token): ?array
    {
        if ($token === '') return null;
        return $this->find('token', $token);
    }

    public function issueToken(int $id): string
    {
        $token = bin2hex(random_bytes(24));
        $this->run('UPDATE users SET token = ? WHERE id = ?', [$token, $id]);
        return $token;
    }

    public function clearToken(string $token): void
    {
        $this->run('UPDATE users SET token = NULL WHERE token = ?', [$token]);
    }
}

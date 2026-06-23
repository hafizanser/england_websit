<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

class Customer extends Model
{
    protected string $table = 'customers';

    public static function normalizePhone(string $phone): string
    {
        return preg_replace('/[^0-9]/', '', $phone) ?? '';
    }

    public function findByPhone(string $phone): ?array
    {
        $norm = self::normalizePhone($phone);
        if ($norm === '') return null;
        return $this->run('SELECT * FROM customers WHERE REPLACE(REPLACE(phone, " ", ""), "+", "") LIKE ? LIMIT 1', ['%' . $norm])->fetch() ?: null;
    }

    public function getById(int $id): ?array
    {
        return $this->find('id', $id) ?: null;
    }

    public function findByEmail(string $email): ?array
    {
        $email = trim($email);
        if ($email === '') return null;
        return $this->run('SELECT * FROM customers WHERE LOWER(email) = LOWER(?) LIMIT 1', [$email])->fetch() ?: null;
    }

    public function findByToken(string $token): ?array
    {
        if ($token === '') return null;
        return $this->find('token', $token) ?: null;
    }

    public function issueToken(int $id): string
    {
        $token = bin2hex(random_bytes(24));
        $this->run('UPDATE customers SET token = ? WHERE id = ?', [$token, $id]);
        return $token;
    }

    public function clearToken(string $token): void
    {
        $this->run('UPDATE customers SET token = NULL WHERE token = ?', [$token]);
    }

    /**
     * Register a customer account. If a guest account already exists for the
     * phone (created at an earlier checkout) it is upgraded with a password;
     * if it already has a password we treat it as "already registered".
     * @return array{0: array, 1: ?string} [public customer, token] or [error array, null]
     */
    public function register(array $d): array
    {
        $phone = trim((string)($d['phone'] ?? ''));
        $name = trim((string)($d['name'] ?? ''));
        $password = (string)($d['password'] ?? '');
        $hash = password_hash($password, PASSWORD_DEFAULT);

        $existing = $this->findByPhone($phone);
        if ($existing) {
            if (!empty($existing['password_hash'])) {
                return [['error' => 'Is number par account pehle se mojood hai — login karein'], null];
            }
            // upgrade guest account → registered (backfill details + set password)
            $this->run(
                'UPDATE customers SET name = COALESCE(NULLIF(?, ""), name), email = COALESCE(NULLIF(?, ""), email),
                 address = COALESCE(NULLIF(?, ""), address), city = COALESCE(NULLIF(?, ""), city), password_hash = ? WHERE id = ?',
                [$name, $d['email'] ?? '', $d['address'] ?? '', $d['city'] ?? '', $hash, $existing['id']]
            );
            $id = (int)$existing['id'];
        } else {
            $this->run(
                'INSERT INTO customers (name, phone, email, address, city, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
                [$name, $phone, $d['email'] ?? '', $d['address'] ?? '', $d['city'] ?? '', $hash]
            );
            $id = (int)$this->lastInsertId();
        }
        $token = $this->issueToken($id);
        return [$this->publicData($this->getById($id)), $token];
    }

    /**
     * Mobile-number-only login / registration. The phone IS the identity:
     * find the account (created here or at checkout) or create a fresh one,
     * then issue a session token. Returns [public, token].
     */
    public function loginOrCreateByPhone(string $phone, string $name = '', array $extra = []): array
    {
        $name = trim($name);
        $email = trim((string)($extra['email'] ?? ''));
        $city = trim((string)($extra['city'] ?? ''));
        $address = trim((string)($extra['address'] ?? ''));
        $existing = $this->findByPhone($phone);
        if ($existing) {
            // Backfill any details this account is still missing (never overwrite).
            $this->run(
                'UPDATE customers SET name = COALESCE(NULLIF(name, ""), NULLIF(?, "")),
                 email = COALESCE(NULLIF(email, ""), NULLIF(?, "")),
                 city = COALESCE(NULLIF(city, ""), NULLIF(?, "")),
                 address = COALESCE(NULLIF(address, ""), NULLIF(?, "")) WHERE id = ?',
                [$name, $email, $city, $address, $existing['id']]
            );
            $id = (int)$existing['id'];
        } else {
            $this->run(
                'INSERT INTO customers (name, phone, email, city, address) VALUES (?, ?, ?, ?, ?)',
                [$name !== '' ? $name : 'Dukaandar', trim($phone), $email, $city, $address]
            );
            $id = (int)$this->lastInsertId();
        }
        $token = $this->issueToken($id);
        return [$this->publicData($this->getById($id)), $token];
    }

    /** Authenticate by phone OR email + password. Returns [public, token] or null. */
    public function login(string $identifier, string $password): ?array
    {
        $row = $this->findByPhone($identifier) ?: $this->findByEmail($identifier);
        if (!$row || empty($row['password_hash']) || !password_verify($password, $row['password_hash'])) {
            return null;
        }
        $token = $this->issueToken((int)$row['id']);
        return [$this->publicData($this->getById((int)$row['id'])), $token];
    }

    /** Strip sensitive fields before returning to the client. */
    public function publicData(array $row): array
    {
        unset($row['password_hash'], $row['token']);
        $row['id'] = (int)$row['id'];
        $row['has_account'] = true;
        return $row;
    }

    /** Find existing by phone or create a new account from checkout data. */
    public function findOrCreate(array $d): array
    {
        $existing = $this->findByPhone($d['phone'] ?? '');
        if ($existing) {
            // backfill any missing details from this checkout
            $this->run(
                'UPDATE customers SET name = COALESCE(NULLIF(?, ""), name), email = COALESCE(NULLIF(?, ""), email),
                 address = COALESCE(NULLIF(?, ""), address), city = COALESCE(NULLIF(?, ""), city) WHERE id = ?',
                [$d['name'] ?? '', $d['email'] ?? '', $d['address'] ?? '', $d['city'] ?? '', $existing['id']]
            );
            return $this->getById((int)$existing['id']);
        }
        $this->run(
            'INSERT INTO customers (name, phone, email, address, city) VALUES (?, ?, ?, ?, ?)',
            [$d['name'] ?? '', $d['phone'] ?? '', $d['email'] ?? '', $d['address'] ?? '', $d['city'] ?? '']
        );
        return $this->getById((int)$this->lastInsertId());
    }

    public function withStats(): array
    {
        $sql = 'SELECT c.*,
                   COUNT(o.id) AS orders_count,
                   COALESCE(SUM(o.total), 0) AS total_spent,
                   MAX(o.placed_at) AS last_order
                FROM customers c
                LEFT JOIN orders o ON o.customer_id = c.id
                GROUP BY c.id
                ORDER BY c.id DESC';
        $rows = $this->db->query($sql)->fetchAll();
        return array_map(function ($r) {
            $r['orders_count'] = (int)$r['orders_count'];
            $r['total_spent'] = (int)$r['total_spent'];
            return $r;
        }, $rows);
    }
}

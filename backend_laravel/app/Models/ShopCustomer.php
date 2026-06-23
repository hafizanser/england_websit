<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Storefront shopper account (the legacy SQLite `customers` table, now in the
 * FMCG-only `fmcg_customers` MySQL table). Phone is the unique identity; a
 * password is optional (phone-only B2B login is supported). Port of the legacy
 * Models\Customer (token now issued via Sanctum).
 */
class ShopCustomer extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'fmcg_customers';

    protected $fillable = ['name', 'phone', 'email', 'address', 'city', 'password'];

    protected $hidden = ['password'];

    public static function normalizePhone(string $phone): string
    {
        return preg_replace('/[^0-9]/', '', $phone) ?? '';
    }

    public static function findByPhone(string $phone): ?self
    {
        $norm = self::normalizePhone($phone);
        if ($norm === '') {
            return null;
        }
        return self::query()
            ->whereRaw("REPLACE(REPLACE(phone, ' ', ''), '+', '') LIKE ?", ['%' . $norm])
            ->first();
    }

    public static function findByEmail(string $email): ?self
    {
        $email = trim($email);
        if ($email === '') {
            return null;
        }
        return self::query()->whereRaw('LOWER(email) = LOWER(?)', [$email])->first();
    }

    /** Issue a fresh Sanctum token (single active session, like the legacy token column). */
    public function issueToken(): string
    {
        $this->tokens()->delete();
        return $this->createToken('storefront')->plainTextToken;
    }

    public function publicData(): array
    {
        return [
            'id'          => (int) $this->id,
            'name'        => $this->name,
            'phone'       => $this->phone,
            'email'       => $this->email,
            'address'     => $this->address,
            'city'        => $this->city,
            'created_at'  => $this->created_at?->toDateTimeString(),
            'has_account' => true,
        ];
    }

    /** Backfill only the empty fields (never overwrite existing values). */
    private function backfill(array $d): void
    {
        foreach (['name', 'email', 'address', 'city'] as $f) {
            $incoming = trim((string) ($d[$f] ?? ''));
            if ($incoming !== '' && trim((string) ($this->{$f} ?? '')) === '') {
                $this->{$f} = $incoming;
            }
        }
        if ($this->isDirty()) {
            $this->save();
        }
    }

    /**
     * Register an account. Upgrades a guest (phone-only) account with a password
     * if one already exists; rejects if already registered.
     * @return array{0: array, 1: ?string} [public|error, token|null]
     */
    public static function register(array $d): array
    {
        $phone = trim((string) ($d['phone'] ?? ''));
        $name = trim((string) ($d['name'] ?? ''));
        $hash = password_hash((string) ($d['password'] ?? ''), PASSWORD_DEFAULT);

        $existing = self::findByPhone($phone);
        if ($existing) {
            if (!empty($existing->password)) {
                return [['error' => 'Is number par account pehle se mojood hai — login karein'], null];
            }
            $existing->name = $name !== '' ? $name : $existing->name;
            foreach (['email', 'address', 'city'] as $f) {
                $v = trim((string) ($d[$f] ?? ''));
                if ($v !== '') {
                    $existing->{$f} = $v;
                }
            }
            $existing->password = $hash;
            $existing->save();
            $customer = $existing;
        } else {
            $customer = self::create([
                'name'     => $name,
                'phone'    => $phone,
                'email'    => $d['email'] ?? null,
                'address'  => $d['address'] ?? null,
                'city'     => $d['city'] ?? null,
                'password' => $hash,
            ]);
        }
        return [$customer->publicData(), $customer->issueToken()];
    }

    /** Mobile-number-only login/registration. Phone is the identity. @return array{0:array,1:string} */
    public static function loginOrCreateByPhone(string $phone, string $name = '', array $extra = []): array
    {
        $existing = self::findByPhone($phone);
        if ($existing) {
            $existing->backfill(array_merge(['name' => $name], $extra));
            $customer = $existing;
        } else {
            $customer = self::create([
                'name'    => trim($name) !== '' ? trim($name) : 'Dukaandar',
                'phone'   => trim($phone),
                'email'   => trim((string) ($extra['email'] ?? '')) ?: null,
                'city'    => trim((string) ($extra['city'] ?? '')) ?: null,
                'address' => trim((string) ($extra['address'] ?? '')) ?: null,
            ]);
        }
        return [$customer->publicData(), $customer->issueToken()];
    }

    /** Authenticate by phone OR email + password. @return array{0:array,1:string}|null */
    public static function login(string $identifier, string $password): ?array
    {
        $row = self::findByPhone($identifier) ?: self::findByEmail($identifier);
        if (!$row || empty($row->password) || !password_verify($password, $row->password)) {
            return null;
        }
        return [$row->publicData(), $row->issueToken()];
    }

    /** Find by phone or create from checkout data; backfills missing details. */
    public static function findOrCreate(array $d): self
    {
        $existing = self::findByPhone($d['phone'] ?? '');
        if ($existing) {
            $existing->backfill($d);
            return $existing;
        }
        return self::create([
            'name'    => $d['name'] ?? '',
            'phone'   => $d['phone'] ?? '',
            'email'   => $d['email'] ?? null,
            'address' => $d['address'] ?? null,
            'city'    => $d['city'] ?? null,
        ]);
    }
}

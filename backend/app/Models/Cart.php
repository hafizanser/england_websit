<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

/**
 * Per-customer saved cart (SQLite `carts`). Stores the storefront cart rows as
 * JSON so a shopper's basket survives logout/login across devices until they
 * clear it themselves.
 */
class Cart extends Model
{
    protected string $table = 'carts';

    /** Cart rows for a customer (decoded), or an empty cart. */
    public function forCustomer(int $customerId): array
    {
        $row = $this->run('SELECT rows, code FROM carts WHERE customer_id = ? LIMIT 1', [$customerId])->fetch();
        if (!$row) {
            return ['rows' => [], 'code' => null];
        }
        $rows = json_decode((string)($row['rows'] ?? '[]'), true);
        return [
            'rows' => is_array($rows) ? $rows : [],
            'code' => $row['code'] ?? null,
        ];
    }

    /** Upsert a customer's cart. */
    public function save(int $customerId, array $rows, ?string $code = null): array
    {
        $json = json_encode(array_values($rows));
        $now = date('Y-m-d H:i:s');
        // SQLite UPSERT keyed on the customer_id primary key.
        $this->run(
            'INSERT INTO carts (customer_id, rows, code, updated_at) VALUES (?, ?, ?, ?)
             ON CONFLICT(customer_id) DO UPDATE SET rows = excluded.rows, code = excluded.code, updated_at = excluded.updated_at',
            [$customerId, $json, $code, $now]
        );
        return $this->forCustomer($customerId);
    }

    public function clear(int $customerId): void
    {
        $this->run('DELETE FROM carts WHERE customer_id = ?', [$customerId]);
    }
}

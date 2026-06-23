<?php

declare(strict_types=1);

namespace App\Repositories;

/** Per-customer saved cart (fmcg_carts). Port of Models\Cart. */
class CartRepo extends BaseRepo
{
    public function forCustomer(int $customerId): array
    {
        $row = $this->first('SELECT rows, code FROM fmcg_carts WHERE customer_id = ? LIMIT 1', [$customerId]);
        if (!$row) {
            return ['rows' => [], 'code' => null];
        }
        $rows = json_decode((string) ($row['rows'] ?? '[]'), true);
        return [
            'rows' => is_array($rows) ? $rows : [],
            'code' => $row['code'] ?? null,
        ];
    }

    public function save(int $customerId, array $rows, ?string $code = null): array
    {
        $json = json_encode(array_values($rows));
        $now = date('Y-m-d H:i:s');
        $this->exec(
            'INSERT INTO fmcg_carts (customer_id, rows, code, updated_at) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE rows = VALUES(rows), code = VALUES(code), updated_at = VALUES(updated_at)',
            [$customerId, $json, $code, $now]
        );
        return $this->forCustomer($customerId);
    }

    public function clear(int $customerId): void
    {
        $this->exec('DELETE FROM fmcg_carts WHERE customer_id = ?', [$customerId]);
    }
}

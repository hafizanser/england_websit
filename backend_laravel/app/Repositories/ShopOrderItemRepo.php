<?php

declare(strict_types=1);

namespace App\Repositories;

/** Storefront order line items (fmcg_order_items). Port of Models\OrderItem. */
class ShopOrderItemRepo extends BaseRepo
{
    public function add(int $orderId, array $it): void
    {
        $now = date('Y-m-d H:i:s');
        $this->exec(
            'INSERT INTO fmcg_order_items (order_id, product_id, name, sub, unit, seed, qty, unit_price, line_total, discount, discount_note, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $orderId,
                $it['id'] ?? null,
                $it['name'],
                $it['sub'] ?? '',
                $it['unit'] ?? '',
                $it['seed'] ?? '',
                (int) $it['qty'],
                (int) $it['wholesale'],
                (int) $it['lineTotal'],
                (int) ($it['discount'] ?? 0),
                $it['discount_note'] ?? null,
                $now,
                $now,
            ]
        );
    }

    public function byOrder(int $orderId): array
    {
        $rows = $this->select('SELECT * FROM fmcg_order_items WHERE order_id = ? ORDER BY id ASC', [$orderId]);
        return array_map(function ($r) {
            $r['qty'] = (int) $r['qty'];
            $r['unit_price'] = (int) $r['unit_price'];
            $r['line_total'] = (int) $r['line_total'];
            $r['discount'] = (int) $r['discount'];
            $r['net_total'] = $r['line_total'] - $r['discount'];
            return $r;
        }, $rows);
    }
}

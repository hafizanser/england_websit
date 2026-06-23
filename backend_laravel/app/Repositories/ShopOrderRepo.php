<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\ShopCustomer;

/**
 * Storefront orders (FMCG-only fmcg_orders table). Port of the legacy
 * Models\Order. Order numbers are ENG-#### derived from the AUTO_INCREMENT id
 * so they are unique forever.
 */
class ShopOrderRepo extends BaseRepo
{
    private const CODE_PREFIX = 'ENG-';
    private const CODE_BASE = 1000;

    public function create(array $d): int
    {
        $now = date('Y-m-d H:i:s');
        $temp = 'TMP-' . uniqid('', true);
        $this->exec(
            'INSERT INTO fmcg_orders (code, customer_id, status, subtotal, promo_discount, item_discount, delivery, total, promo_code, discount_lines, source, note, placed_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $temp,
                $d['customer_id'],
                $d['status'] ?? 'pending',
                (int) $d['subtotal'],
                (int) $d['promo_discount'],
                (int) ($d['item_discount'] ?? 0),
                (int) $d['total'],
                $d['promo_code'] ?? null,
                json_encode($d['discount_lines'] ?? []),
                in_array($d['source'] ?? 'website', ['website', 'admin'], true) ? $d['source'] : 'website',
                $d['note'] ?? null,
                $now,
                $now,
                $now,
            ]
        );
        $id = $this->lastId();
        $this->exec('UPDATE fmcg_orders SET code = ? WHERE id = ?', [self::codeFor($id), $id]);
        return $id;
    }

    public static function codeFor(int $id): string
    {
        return self::CODE_PREFIX . (self::CODE_BASE + $id);
    }

    public function getById(int $id): ?array
    {
        $row = $this->first('SELECT * FROM fmcg_orders WHERE id = ? LIMIT 1', [$id]);
        return $row ? $this->cast($row) : null;
    }

    public function getByCode(string $code): ?array
    {
        $row = $this->first('SELECT * FROM fmcg_orders WHERE code = ? LIMIT 1', [$code]);
        return $row ? $this->cast($row) : null;
    }

    public function detail(int $id): ?array
    {
        $order = $this->getById($id);
        if (!$order) {
            return null;
        }
        $customer = ShopCustomer::find((int) $order['customer_id']);
        $order['customer'] = $customer?->publicData();
        $order['items'] = (new ShopOrderItemRepo())->byOrder($id);
        $order['history'] = $this->select(
            'SELECT status, note, created_at FROM fmcg_order_status_history WHERE order_id = ? ORDER BY id ASC',
            [$id]
        );
        return $order;
    }

    public function byCustomer(int $customerId): array
    {
        $orders = array_map([$this, 'cast'], $this->select(
            'SELECT * FROM fmcg_orders WHERE customer_id = ? ORDER BY id DESC',
            [$customerId]
        ));
        $itemModel = new ShopOrderItemRepo();
        foreach ($orders as &$o) {
            $o['items'] = $itemModel->byOrder((int) $o['id']);
        }
        return $orders;
    }

    public function updateStatus(int $id, string $status, ?string $note = null): void
    {
        $this->exec('UPDATE fmcg_orders SET status = ?, updated_at = NOW() WHERE id = ?', [$status, $id]);
        $this->addHistory($id, $status, $note);
    }

    public function addHistory(int $id, string $status, ?string $note = null): void
    {
        $this->exec(
            'INSERT INTO fmcg_order_status_history (order_id, status, note, created_at) VALUES (?, ?, ?, ?)',
            [$id, $status, $note, date('Y-m-d H:i:s')]
        );
    }

    private function cast(array $r): array
    {
        foreach (['subtotal', 'promo_discount', 'item_discount', 'delivery', 'total', 'customer_id'] as $k) {
            if (isset($r[$k])) {
                $r[$k] = (int) $r[$k];
            }
        }
        // Mirror the legacy field name used by the storefront (`placed_at`).
        $r['placed_at'] = $r['placed_at'] ?? ($r['created_at'] ?? null);
        $r['discount_lines'] = json_decode($r['discount_lines'] ?? '[]', true) ?: [];
        return $r;
    }
}

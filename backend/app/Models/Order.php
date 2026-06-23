<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

class Order extends Model
{
    protected string $table = 'orders';

    // Order number format: ENG-1001, ENG-1002, … derived from the row's
    // AUTOINCREMENT id so it is unique forever (ids are never reused, even
    // after deletes) — guaranteeing no duplicate order numbers.
    private const CODE_PREFIX = 'ENG-';
    private const CODE_BASE = 1000;

    public function create(array $d): int
    {
        // Insert with a temporary unique code, then stamp the final ENG-#### from
        // the new row id (the `code` column is NOT NULL UNIQUE, so we can't defer it).
        $temp = 'TMP-' . uniqid('', true);
        $this->run(
            'INSERT INTO orders (code, customer_id, status, subtotal, promo_discount, item_discount, delivery, total, promo_code, discount_lines, source, note)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)',
            [
                $temp,
                $d['customer_id'],
                $d['status'] ?? 'pending',
                (int)$d['subtotal'],
                (int)$d['promo_discount'],
                (int)($d['item_discount'] ?? 0),
                (int)$d['total'],
                $d['promo_code'] ?? null,
                json_encode($d['discount_lines'] ?? []),
                in_array($d['source'] ?? 'website', ['website', 'admin'], true) ? $d['source'] : 'website',
                $d['note'] ?? null,
            ]
        );
        $id = (int)$this->lastInsertId();
        $this->run('UPDATE orders SET code = ? WHERE id = ?', [self::codeFor($id), $id]);
        return $id;
    }

    /** The permanent order number for a given row id. */
    public static function codeFor(int $id): string
    {
        return self::CODE_PREFIX . (self::CODE_BASE + $id);
    }

    public function getById(int $id): ?array
    {
        $row = $this->find('id', $id);
        return $row ? $this->cast($row) : null;
    }

    public function getByCode(string $code): ?array
    {
        $row = $this->find('code', $code);
        return $row ? $this->cast($row) : null;
    }

    /** Full order with customer + items. */
    public function detail(int $id): ?array
    {
        $order = $this->getById($id);
        if (!$order) return null;
        $order['customer'] = (new Customer())->getById((int)$order['customer_id']);
        $order['items'] = (new OrderItem())->byOrder($id);
        $order['history'] = $this->run(
            'SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC',
            [$id]
        )->fetchAll();
        return $order;
    }

    public function listAll(array $filters = []): array
    {
        $sql = 'SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.city AS customer_city
                FROM orders o JOIN customers c ON c.id = o.customer_id WHERE 1=1';
        $params = [];
        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $sql .= ' AND o.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['q'])) {
            $sql .= ' AND (o.code LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
            $needle = '%' . $filters['q'] . '%';
            array_push($params, $needle, $needle, $needle);
        }
        $sql .= ' ORDER BY o.id DESC';
        return array_map([$this, 'cast'], $this->run($sql, $params)->fetchAll());
    }

    public function byCustomer(int $customerId): array
    {
        $orders = array_map([$this, 'cast'], $this->run(
            'SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC',
            [$customerId]
        )->fetchAll());
        $itemModel = new OrderItem();
        foreach ($orders as &$o) {
            $o['items'] = $itemModel->byOrder((int)$o['id']);
        }
        return $orders;
    }

    public function updateStatus(int $id, string $status, ?string $note = null): void
    {
        $this->run('UPDATE orders SET status = ?, updated_at = datetime("now") WHERE id = ?', [$status, $id]);
        $this->run('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)', [$id, $status, $note]);
    }

    public function addHistory(int $id, string $status, ?string $note = null): void
    {
        $this->run('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)', [$id, $status, $note]);
    }

    /** Recompute item_discount + total after a per-item discount change. */
    public function recalc(int $id): array
    {
        $items = (new OrderItem())->byOrder($id);
        $itemDiscount = array_sum(array_map(fn ($i) => $i['discount'], $items));
        $order = $this->getById($id);
        $total = max(0, $order['subtotal'] - $order['promo_discount'] - $itemDiscount);
        $this->run(
            'UPDATE orders SET item_discount = ?, total = ?, updated_at = datetime("now") WHERE id = ?',
            [$itemDiscount, $total, $id]
        );
        return $this->detail($id);
    }

    private function cast(array $r): array
    {
        foreach (['subtotal', 'promo_discount', 'item_discount', 'delivery', 'total', 'customer_id'] as $k) {
            if (isset($r[$k])) $r[$k] = (int)$r[$k];
        }
        $r['discount_lines'] = json_decode($r['discount_lines'] ?? '[]', true) ?: [];
        return $r;
    }
}

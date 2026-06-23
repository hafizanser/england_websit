<?php

declare(strict_types=1);

namespace App\Repositories;

/**
 * Orders in the shared order_system MySQL database. Port of Models\RefOrder —
 * maps the order_system schema onto the flat shape the FMCG admin order pages
 * expect (code / customer_name / total / ...).
 */
class WholesaleOrderRepo extends BaseRepo
{
    private static function source(?string $s): string
    {
        return strtolower((string) $s) === 'website' ? 'website' : 'admin';
    }

    /** Canonical unique order code — ENG-#### (1000 + id). */
    public static function code(int $id): string
    {
        return 'ENG-' . (1000 + $id);
    }

    public function listAll(array $filters = []): array
    {
        $sql = "SELECT o.id, o.order_source, o.status, o.total_amount, o.order_date,
                       c.customer_name, c.customer_phone_number
                FROM orders o
                JOIN tbl_customer c ON o.customer_id = c.id
                WHERE 1=1";
        $params = [];

        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $sql .= " AND o.status = ?";
            $params[] = $filters['status'];
        }
        if (!empty($filters['q'])) {
            $needle = '%' . $filters['q'] . '%';
            $digits = (int) preg_replace('/\D/', '', (string) $filters['q']);
            $asEng = $digits >= 1001 ? $digits - 1000 : $digits;
            $sql .= " AND (c.customer_name LIKE ? OR c.customer_phone_number LIKE ? OR o.id = ? OR o.id = ?)";
            array_push($params, $needle, $needle, $digits, $asEng);
        }
        $sql .= " ORDER BY o.id DESC";

        return array_map(static function ($r) {
            return [
                'id'             => (int) $r['id'],
                'code'           => self::code((int) $r['id']),
                'customer_name'  => (string) ($r['customer_name'] ?? ''),
                'customer_phone' => (string) ($r['customer_phone_number'] ?? ''),
                'placed_at'      => $r['order_date'],
                'source'         => self::source($r['order_source']),
                'status'         => (string) ($r['status'] ?? ''),
                'total'          => (float) $r['total_amount'],
            ];
        }, $this->select($sql, $params));
    }

    public function byPhone(string $phone): array
    {
        $digits = preg_replace('/\D/', '', $phone);
        $tail = strlen($digits) > 10 ? substr($digits, -10) : $digits;
        if ($tail === '') {
            return [];
        }
        $sql = "SELECT o.id, o.order_source, o.status, o.total_amount, o.order_date
                FROM orders o
                JOIN tbl_customer c ON o.customer_id = c.id
                WHERE REPLACE(REPLACE(REPLACE(c.customer_phone_number, ' ', ''), '+', ''), '-', '') LIKE ?
                ORDER BY o.id DESC";
        $rows = $this->select($sql, ['%' . $tail]);
        $out = [];
        foreach ($rows as $r) {
            $id = (int) $r['id'];
            $items = $this->select("SELECT quantity FROM order_items WHERE order_id = ?", [$id]);
            $out[] = [
                'id'        => $id,
                'code'      => self::code($id),
                'status'    => (string) ($r['status'] ?? ''),
                'source'    => self::source($r['order_source']),
                'placed_at' => $r['order_date'],
                'total'     => (float) $r['total_amount'],
                'items'     => array_map(static fn ($i) => ['qty' => (int) $i['quantity']], $items),
            ];
        }
        return $out;
    }

    public function detail(int $id): ?array
    {
        $o = $this->first(
            "SELECT o.*, c.id AS cust_id, c.customer_name, c.customer_phone_number,
                    c.customer_address, c.shop_name
             FROM orders o
             JOIN tbl_customer c ON o.customer_id = c.id
             WHERE o.id = ? LIMIT 1",
            [$id]
        );
        if (!$o) {
            return null;
        }

        $rows = $this->select(
            "SELECT oi.id, oi.product_id, oi.quantity, oi.product_price, oi.discount_value, oi.unit_type, p.product_name
             FROM order_items oi
             JOIN tbl_product p ON oi.product_id = p.id
             WHERE oi.order_id = ?",
            [$id]
        );

        $subtotal = 0.0;
        $itemDiscount = 0.0;
        $items = array_map(static function ($i) use (&$subtotal, &$itemDiscount) {
            $line = (float) $i['quantity'] * (float) $i['product_price'];
            $disc = (float) ($i['discount_value'] ?? 0);
            $subtotal += $line;
            $itemDiscount += $disc;
            return [
                'id'            => (int) $i['id'],
                'product_id'    => (string) $i['product_id'],
                'name'          => (string) $i['product_name'],
                'qty'           => (int) $i['quantity'],
                'unit'          => (string) ($i['unit_type'] ?? ''),
                'unit_price'    => (float) $i['product_price'],
                'line_total'    => $line,
                'discount'      => $disc,
                'discount_note' => null,
            ];
        }, $rows);

        return [
            'id'             => (int) $o['id'],
            'code'           => self::code((int) $o['id']),
            'status'         => (string) ($o['status'] ?? ''),
            'source'         => self::source($o['order_source']),
            'subtotal'       => $subtotal,
            'item_discount'  => $itemDiscount,
            'discount_lines' => [],
            'total'          => (float) $o['total_amount'],
            'placed_at'      => $o['order_date'] ?? null,
            'customer'       => [
                'id'      => (int) $o['cust_id'],
                'name'    => (string) ($o['customer_name'] ?? ''),
                'phone'   => (string) ($o['customer_phone_number'] ?? ''),
                'address' => (string) ($o['customer_address'] ?? ''),
                'city'    => (string) ($o['city'] ?? ''),
            ],
            'items'   => $items,
            'history' => [],
        ];
    }

    public function exists(int $id): bool
    {
        return (bool) $this->scalar("SELECT 1 FROM orders WHERE id = ? LIMIT 1", [$id]);
    }

    public function updateStatus(int $id, string $status): void
    {
        $this->exec("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?", [$status, $id]);
    }

    public function setItemDiscount(int $orderId, int $itemId, float $amount): ?array
    {
        $this->exec(
            "UPDATE order_items SET discount_value = ?, updated_at = NOW() WHERE id = ? AND order_id = ?",
            [$amount, $itemId, $orderId]
        );
        $row = $this->first(
            "SELECT COALESCE(SUM(quantity * product_price), 0) AS gross,
                    COALESCE(SUM(discount_value), 0) AS disc
             FROM order_items WHERE order_id = ?",
            [$orderId]
        );
        $total = max(0.0, (float) $row['gross'] - (float) $row['disc']);
        $this->exec("UPDATE orders SET total_amount = ?, updated_at = NOW() WHERE id = ?", [$total, $orderId]);
        return $this->detail($orderId);
    }

    public function itemBelongsToOrder(int $itemId, int $orderId): bool
    {
        return (bool) $this->scalar(
            "SELECT 1 FROM order_items WHERE id = ? AND order_id = ? LIMIT 1",
            [$itemId, $orderId]
        );
    }
}

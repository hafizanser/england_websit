<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\MysqlModel;

/**
 * Orders in the shared `order_system` MySQL database (same source the Laravel
 * app and the Profit pages use). Maps the order_system schema onto the flat
 * shape the FMCG admin order pages expect (code / customer_name / total / ...).
 */
class RefOrder extends MysqlModel
{
    /** order_system `order_source` → FMCG admin source bucket. */
    private static function source(?string $s): string
    {
        return strtolower((string)$s) === 'website' ? 'website' : 'admin';
    }

    /**
     * Canonical unique order code — same ENG-#### scheme as the SQLite store
     * (Order::codeFor) so order numbers look consistent across the whole app.
     */
    public static function code(int $id): string
    {
        return 'ENG-' . (1000 + $id);
    }

    /** List orders for the admin table, newest first, with optional filters. */
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
            // Search by name / phone / order id — and by the ENG-#### code
            // (ENG-1007 → id 7), so the unique order number is searchable.
            $needle = '%' . $filters['q'] . '%';
            $digits = (int)preg_replace('/\D/', '', (string)$filters['q']);
            $asEng = $digits >= 1001 ? $digits - 1000 : $digits;
            $sql .= " AND (c.customer_name LIKE ? OR c.customer_phone_number LIKE ? OR o.id = ? OR o.id = ?)";
            array_push($params, $needle, $needle, $digits, $asEng);
        }
        $sql .= " ORDER BY o.id DESC";

        return array_map(static function ($r) {
            return [
                'id'             => (int)$r['id'],
                'code'           => self::code((int)$r['id']),
                'customer_name'  => (string)($r['customer_name'] ?? ''),
                'customer_phone' => (string)($r['customer_phone_number'] ?? ''),
                'placed_at'      => $r['order_date'],
                'source'         => self::source($r['order_source']),
                'status'         => (string)($r['status'] ?? ''),
                'total'          => (float)$r['total_amount'],
            ];
        }, $this->run($sql, $params)->fetchAll());
    }

    /**
     * Orders for a customer matched by PHONE (same source as the admin order
     * history), projected to the storefront order shape used by My Profile /
     * order history. Codes are prefixed `OS-` so the detail route can resolve
     * them back to this MySQL source.
     */
    public function byPhone(string $phone): array
    {
        $digits = preg_replace('/\D/', '', $phone);
        // Match on the last 10 significant digits so 11-digit (03xxxxxxxxx) and
        // 10-digit (3xxxxxxxxx) stored formats both resolve to the same number.
        $tail = strlen($digits) > 10 ? substr($digits, -10) : $digits;
        if ($tail === '') {
            return [];
        }
        $sql = "SELECT o.id, o.order_source, o.status, o.total_amount, o.order_date
                FROM orders o
                JOIN tbl_customer c ON o.customer_id = c.id
                WHERE REPLACE(REPLACE(REPLACE(c.customer_phone_number, ' ', ''), '+', ''), '-', '') LIKE ?
                ORDER BY o.id DESC";
        $rows = $this->run($sql, ['%' . $tail])->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            $id = (int) $r['id'];
            $items = $this->run("SELECT quantity FROM order_items WHERE order_id = ?", [$id])->fetchAll();
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

    /** Full order (customer + items) for the detail page, or null if missing. */
    public function detail(int $id): ?array
    {
        $o = $this->run(
            "SELECT o.*, c.id AS cust_id, c.customer_name, c.customer_phone_number,
                    c.customer_address, c.shop_name
             FROM orders o
             JOIN tbl_customer c ON o.customer_id = c.id
             WHERE o.id = ? LIMIT 1",
            [$id]
        )->fetch();
        if (!$o) {
            return null;
        }

        $rows = $this->run(
            "SELECT oi.id, oi.product_id, oi.quantity, oi.product_price, oi.discount_value, oi.unit_type, p.product_name
             FROM order_items oi
             JOIN tbl_product p ON oi.product_id = p.id
             WHERE oi.order_id = ?",
            [$id]
        )->fetchAll();

        $subtotal = 0.0;
        $itemDiscount = 0.0;
        $items = array_map(static function ($i) use (&$subtotal, &$itemDiscount) {
            $line = (float)$i['quantity'] * (float)$i['product_price'];
            $disc = (float)($i['discount_value'] ?? 0);
            $subtotal += $line;
            $itemDiscount += $disc;
            return [
                'id'            => (int)$i['id'],
                'product_id'    => (string)$i['product_id'],
                'name'          => (string)$i['product_name'],
                'qty'           => (int)$i['quantity'],
                'unit'          => (string)($i['unit_type'] ?? ''),
                'unit_price'    => (float)$i['product_price'],
                'line_total'    => $line,
                'discount'      => $disc,
                'discount_note' => null,
            ];
        }, $rows);

        return [
            'id'             => (int)$o['id'],
            'code'           => self::code((int)$o['id']),
            'status'         => (string)($o['status'] ?? ''),
            'source'         => self::source($o['order_source']),
            'subtotal'       => $subtotal,
            'item_discount'  => $itemDiscount,
            'discount_lines' => [],
            'total'          => (float)$o['total_amount'],
            'placed_at'      => $o['order_date'] ?? null,
            'customer'       => [
                'id'      => (int)$o['cust_id'],
                'name'    => (string)($o['customer_name'] ?? ''),
                'phone'   => (string)($o['customer_phone_number'] ?? ''),
                'address' => (string)($o['customer_address'] ?? ''),
                'city'    => (string)($o['city'] ?? ''),
            ],
            'items'   => $items,
            'history' => [],
        ];
    }

    public function exists(int $id): bool
    {
        return (bool)$this->run("SELECT 1 FROM orders WHERE id = ? LIMIT 1", [$id])->fetchColumn();
    }

    public function updateStatus(int $id, string $status): void
    {
        $this->run("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?", [$status, $id]);
    }

    /** Set a line discount and recompute the order total = Σ(qty·price) − Σ(discount). */
    public function setItemDiscount(int $orderId, int $itemId, float $amount): ?array
    {
        $this->run(
            "UPDATE order_items SET discount_value = ?, updated_at = NOW() WHERE id = ? AND order_id = ?",
            [$amount, $itemId, $orderId]
        );
        $row = $this->run(
            "SELECT COALESCE(SUM(quantity * product_price), 0) AS gross,
                    COALESCE(SUM(discount_value), 0) AS disc
             FROM order_items WHERE order_id = ?",
            [$orderId]
        )->fetch();
        $total = max(0.0, (float)$row['gross'] - (float)$row['disc']);
        $this->run("UPDATE orders SET total_amount = ?, updated_at = NOW() WHERE id = ?", [$total, $orderId]);
        return $this->detail($orderId);
    }

    public function itemBelongsToOrder(int $itemId, int $orderId): bool
    {
        return (bool)$this->run(
            "SELECT 1 FROM order_items WHERE id = ? AND order_id = ? LIMIT 1",
            [$itemId, $orderId]
        )->fetchColumn();
    }
}

<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\MysqlModel;

/**
 * Order-level profit analytics in the shared `order_system` database.
 *
 * Mirrors the order_management (Laravel) `OrderController::profits()` /
 * `profitDetails()` business logic byte-for-byte:
 *
 *   per-line production cost = CASE
 *       WHEN unit_type = 'cotton' THEN production_cotton_price
 *       WHEN unit_type = 'box'    THEN production_box_price
 *       ELSE NULL                                  -- other units => 0 profit
 *   line_profit  = production_cost IS NULL ? 0 : quantity * (sale_price - cost)
 *   order_profit = SUM(line_profit)
 *
 * Date filter is applied on `orders.order_date` (inclusive day boundaries).
 */
class RefProfit extends MysqlModel
{
    /** Production-cost expression — only cotton & box carry a cost (matches Laravel). */
    private const COST = "CASE WHEN oi.unit_type = 'cotton' THEN p.production_cotton_price
                               WHEN oi.unit_type = 'box'    THEN p.production_box_price
                               ELSE NULL END";

    /**
     * Per-order list with computed profit, optionally filtered by order_date.
     * Ordered by most recent — same as the reference "Order Breakdown" table.
     */
    public function orderList(?string $from, ?string $to): array
    {
        $cost = self::COST;
        $sql = "SELECT o.id AS order_id, c.customer_name, c.shop_name,
                       o.total_amount, o.order_date, o.order_source, o.status,
                       COALESCE(SUM(CASE
                           WHEN ($cost) IS NULL THEN 0
                           ELSE (oi.quantity * (oi.product_price - ($cost)))
                       END), 0) AS total_profit
                FROM orders o
                JOIN tbl_customer c ON o.customer_id = c.id
                LEFT JOIN order_items oi ON oi.order_id = o.id
                LEFT JOIN tbl_product p ON oi.product_id = p.id";

        [$where, $params] = $this->dateWhere($from, $to);
        $sql .= $where;
        $sql .= " GROUP BY o.id, c.customer_name, c.shop_name, o.total_amount, o.order_date, o.order_source, o.status
                  ORDER BY o.order_date DESC";

        return array_map(static function ($r) {
            return [
                'order_id'     => (string)$r['order_id'],
                'customer_name'=> (string)($r['customer_name'] ?? ''),
                'shop_name'    => (string)($r['shop_name'] ?? ''),
                'total_amount' => (float)$r['total_amount'],
                'total_profit' => (float)$r['total_profit'],
                'order_date'   => $r['order_date'],
                'order_source' => $r['order_source'] ?? null,
                'status'       => $r['status'] ?? null,
            ];
        }, $this->run($sql, $params)->fetchAll());
    }

    /** Per-order line-item profit breakdown, or null if the order does not exist. */
    public function orderDetail(int $id): ?array
    {
        $order = $this->run(
            "SELECT o.id AS order_id, o.*, c.customer_name, c.customer_address, c.customer_phone_number, c.shop_name
             FROM orders o
             JOIN tbl_customer c ON o.customer_id = c.id
             WHERE o.id = ? LIMIT 1",
            [$id]
        )->fetch();
        if (!$order) {
            return null;
        }

        $cost = self::COST;
        $rows = $this->run(
            "SELECT oi.id, oi.product_id, oi.quantity, oi.free_quantity, oi.product_price, oi.unit_type,
                    p.product_name,
                    ($cost) AS production_price,
                    CASE WHEN ($cost) IS NULL THEN 0 ELSE (oi.product_price - ($cost)) END AS unit_profit,
                    CASE WHEN ($cost) IS NULL THEN 0 ELSE (oi.quantity * (oi.product_price - ($cost))) END AS line_profit,
                    (oi.quantity * oi.product_price) AS item_total
             FROM order_items oi
             JOIN tbl_product p ON oi.product_id = p.id
             WHERE oi.order_id = ?",
            [$id]
        )->fetchAll();

        $hasMissing  = false;
        $totalProfit = 0.0;
        $totalPrice  = 0.0;
        $items = array_map(function ($i) use (&$hasMissing, &$totalProfit, &$totalPrice) {
            $missing = $i['production_price'] === null;
            if ($missing) {
                $hasMissing = true;
            }
            $totalProfit += (float)$i['line_profit'];
            $totalPrice  += (float)$i['item_total'];
            return [
                'product_name'     => (string)$i['product_name'],
                'quantity'         => (int)$i['quantity'],
                'free_quantity'    => (int)($i['free_quantity'] ?? 0),
                'unit_type'        => $i['unit_type'],
                'product_price'    => (float)$i['product_price'],
                'production_price' => $missing ? null : (float)$i['production_price'],
                'unit_profit'      => (float)$i['unit_profit'],
                'line_profit'      => (float)$i['line_profit'],
                'item_total'       => (float)$i['item_total'],
            ];
        }, $rows);

        return [
            'order' => [
                'order_id'              => (string)$order['order_id'],
                'customer_name'         => (string)($order['customer_name'] ?? ''),
                'shop_name'             => (string)($order['shop_name'] ?? ''),
                'customer_address'      => (string)($order['customer_address'] ?? ''),
                'customer_phone_number' => (string)($order['customer_phone_number'] ?? ''),
                'total_amount'          => (float)$order['total_amount'],
                'total_profit'          => $order['total_profit'] !== null ? (float)$order['total_profit'] : null,
                'order_date'            => $order['order_date'] ?? null,
                'order_source'          => $order['order_source'] ?? null,
                'status'                => $order['status'] ?? null,
                'adda_name'             => $order['adda_name'] ?? null,
                'pandi_name'            => $order['pandi_name'] ?? null,
                'transport_mode'        => $order['transport_mode'] ?? null,
            ],
            'items'        => $items,
            'total_profit' => round($totalProfit, 2),
            'total_price'  => round($totalPrice, 2),
            'has_missing'  => $hasMissing,
        ];
    }

    /** Build the order_date WHERE clause + bound params for from/to (YYYY-MM-DD). */
    private function dateWhere(?string $from, ?string $to): array
    {
        $from = $from !== null ? trim($from) : '';
        $to   = $to !== null ? trim($to) : '';
        if ($from !== '' && $to !== '') {
            return [' WHERE o.order_date BETWEEN ? AND ?', [$from . ' 00:00:00', $to . ' 23:59:59']];
        }
        if ($from !== '') {
            return [' WHERE o.order_date >= ?', [$from . ' 00:00:00']];
        }
        if ($to !== '') {
            return [' WHERE o.order_date <= ?', [$to . ' 23:59:59']];
        }
        return ['', []];
    }
}

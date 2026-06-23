<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Api;
use Illuminate\Support\Facades\DB;

/**
 * Storefront sales dashboard summary. Reads the FMCG storefront tables
 * (fmcg_orders / fmcg_customers / fmcg_order_items) plus the active catalogue
 * size from tbl_product. Port of the legacy Admin\ReportController.
 */
class ReportController extends Controller
{
    private function scalar(string $sql): int
    {
        $row = (array) DB::selectOne($sql);
        return (int) reset($row);
    }

    public function summary()
    {
        $totalOrders    = $this->scalar('SELECT COUNT(*) c FROM fmcg_orders');
        $revenue        = $this->scalar("SELECT COALESCE(SUM(total),0) s FROM fmcg_orders WHERE status != 'cancelled'");
        $totalCustomers = $this->scalar('SELECT COUNT(*) c FROM fmcg_customers');
        $totalProducts  = $this->scalar('SELECT COUNT(*) c FROM tbl_product WHERE is_active = 1');
        $totalDiscount  = $this->scalar("SELECT COALESCE(SUM(promo_discount + item_discount),0) s FROM fmcg_orders WHERE status != 'cancelled'");

        $rows = fn (string $sql) => array_map(fn ($r) => (array) $r, DB::select($sql));

        $statusBreakdown = $rows("SELECT status, COUNT(*) count, COALESCE(SUM(total),0) value FROM fmcg_orders GROUP BY status");

        $topProducts = $rows(
            "SELECT name, SUM(qty) qty, SUM(line_total - discount) revenue
             FROM fmcg_order_items GROUP BY name ORDER BY qty DESC LIMIT 6"
        );

        $daily = $rows(
            "SELECT DATE(placed_at) day, COUNT(*) orders, COALESCE(SUM(total),0) revenue
             FROM fmcg_orders WHERE status != 'cancelled'
             GROUP BY DATE(placed_at) ORDER BY day DESC LIMIT 7"
        );

        $lowStock = $rows('SELECT id, product_name AS name, total_stock_cotton AS stock FROM tbl_product WHERE is_active = 1 ORDER BY total_stock_cotton ASC LIMIT 5');

        $recentOrders = $rows(
            'SELECT o.code, o.total, o.status, o.placed_at, c.name customer_name
             FROM fmcg_orders o JOIN fmcg_customers c ON c.id = o.customer_id ORDER BY o.id DESC LIMIT 6'
        );

        return Api::ok([
            'cards' => [
                'orders'    => $totalOrders,
                'revenue'   => $revenue,
                'customers' => $totalCustomers,
                'products'  => $totalProducts,
                'discount'  => $totalDiscount,
                'avgOrder'  => $totalOrders ? (int) round($revenue / max(1, $totalOrders)) : 0,
            ],
            'statusBreakdown' => array_map(fn ($r) => ['status' => $r['status'], 'count' => (int) $r['count'], 'value' => (int) $r['value']], $statusBreakdown),
            'topProducts'     => array_map(fn ($r) => ['name' => $r['name'], 'qty' => (int) $r['qty'], 'revenue' => (int) $r['revenue']], $topProducts),
            'daily'           => array_map(fn ($r) => ['day' => $r['day'], 'orders' => (int) $r['orders'], 'revenue' => (int) $r['revenue']], array_reverse($daily)),
            'lowStock'        => array_map(fn ($r) => ['id' => $r['id'], 'name' => $r['name'], 'stock' => (int) $r['stock']], $lowStock),
            'recentOrders'    => $recentOrders,
        ]);
    }
}

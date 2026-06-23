<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Controller;
use App\Core\Response;
use App\Core\Database;

class ReportController extends Controller
{
    public function summary(): void
    {
        $this->requireAdmin();
        $db = Database::pdo();

        $totalOrders   = (int)$db->query('SELECT COUNT(*) c FROM orders')->fetch()['c'];
        $revenue       = (int)$db->query("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status != 'cancelled'")->fetch()['s'];
        $totalCustomers = (int)$db->query('SELECT COUNT(*) c FROM customers')->fetch()['c'];
        $totalProducts = (int)$db->query('SELECT COUNT(*) c FROM products WHERE active = 1')->fetch()['c'];
        $totalDiscount = (int)$db->query("SELECT COALESCE(SUM(promo_discount + item_discount),0) s FROM orders WHERE status != 'cancelled'")->fetch()['s'];

        $statusBreakdown = $db->query('SELECT status, COUNT(*) count, COALESCE(SUM(total),0) value FROM orders GROUP BY status')->fetchAll();

        $topProducts = $db->query(
            "SELECT name, SUM(qty) qty, SUM(line_total - discount) revenue
             FROM order_items GROUP BY name ORDER BY qty DESC LIMIT 6"
        )->fetchAll();

        // last 7 days revenue
        $daily = $db->query(
            "SELECT substr(placed_at,1,10) day, COUNT(*) orders, COALESCE(SUM(total),0) revenue
             FROM orders WHERE status != 'cancelled'
             GROUP BY day ORDER BY day DESC LIMIT 7"
        )->fetchAll();

        $lowStock = $db->query('SELECT id, name, stock FROM products WHERE active = 1 ORDER BY stock ASC LIMIT 5')->fetchAll();

        $recentOrders = $db->query(
            'SELECT o.code, o.total, o.status, o.placed_at, c.name customer_name
             FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.id DESC LIMIT 6'
        )->fetchAll();

        Response::ok([
            'cards' => [
                'orders'    => $totalOrders,
                'revenue'   => $revenue,
                'customers' => $totalCustomers,
                'products'  => $totalProducts,
                'discount'  => $totalDiscount,
                'avgOrder'  => $totalOrders ? (int)round($revenue / max(1, $totalOrders)) : 0,
            ],
            'statusBreakdown' => array_map(fn ($r) => ['status' => $r['status'], 'count' => (int)$r['count'], 'value' => (int)$r['value']], $statusBreakdown),
            'topProducts'     => array_map(fn ($r) => ['name' => $r['name'], 'qty' => (int)$r['qty'], 'revenue' => (int)$r['revenue']], $topProducts),
            'daily'           => array_map(fn ($r) => ['day' => $r['day'], 'orders' => (int)$r['orders'], 'revenue' => (int)$r['revenue']], array_reverse($daily)),
            'lowStock'        => array_map(fn ($r) => ['id' => $r['id'], 'name' => $r['name'], 'stock' => (int)$r['stock']], $lowStock),
            'recentOrders'    => $recentOrders,
        ]);
    }
}

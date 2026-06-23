<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Controller;
use App\Core\Response;
use App\Models\RefOrder;
use App\Models\RefReview;

/** Aggregated activity feed for the admin notification bell. */
class NotificationController extends Controller
{
    public function index(): void
    {
        $this->requireAdmin();

        $items = [];

        // Recent orders
        $orders = array_slice((new RefOrder())->listAll(), 0, 6);
        foreach ($orders as $o) {
            $items[] = [
                'type'  => 'order',
                'title' => 'Naya order ' . $o['code'],
                'text'  => (($o['customer_name'] ?? '') ?: 'Customer') . ' • Rs.' . number_format((float)$o['total']),
                'time'  => $o['placed_at'] ?? null,
                'link'  => '/admin/orders/' . $o['id'],
            ];
        }

        // Recent reviews
        foreach ((new RefReview())->recent(6) as $r) {
            $items[] = [
                'type'  => 'review',
                'title' => $r['rating'] . '★ review',
                'text'  => (($r['customer_name'] ?? '') ?: 'Customer') . ' • ' . (($r['product_name'] ?? '') ?: 'Product'),
                'time'  => $r['created_at'] ?? null,
                'link'  => '/admin/reviews',
            ];
        }

        usort($items, static fn ($a, $b) => strcmp((string)($b['time'] ?? ''), (string)($a['time'] ?? '')));

        Response::ok(['data' => ['items' => array_slice($items, 0, 12), 'count' => count($items)]]);
    }
}

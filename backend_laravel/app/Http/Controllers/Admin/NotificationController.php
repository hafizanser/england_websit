<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Repositories\ReviewRepo;
use App\Repositories\WholesaleOrderRepo;
use App\Support\Api;

/** Aggregated activity feed for the admin notification bell. */
class NotificationController extends Controller
{
    public function index()
    {
        $items = [];

        $orders = array_slice((new WholesaleOrderRepo())->listAll(), 0, 6);
        foreach ($orders as $o) {
            $items[] = [
                'type'  => 'order',
                'title' => 'Naya order ' . $o['code'],
                'text'  => (($o['customer_name'] ?? '') ?: 'Customer') . ' • Rs.' . number_format((float) $o['total']),
                'time'  => $o['placed_at'] ?? null,
                'link'  => '/admin/orders/' . $o['id'],
            ];
        }

        foreach ((new ReviewRepo())->recent(6) as $r) {
            $items[] = [
                'type'  => 'review',
                'title' => $r['rating'] . '★ review',
                'text'  => (($r['customer_name'] ?? '') ?: 'Customer') . ' • ' . (($r['product_name'] ?? '') ?: 'Product'),
                'time'  => $r['created_at'] ?? null,
                'link'  => '/admin/reviews',
            ];
        }

        usort($items, static fn ($a, $b) => strcmp((string) ($b['time'] ?? ''), (string) ($a['time'] ?? '')));

        return Api::ok(['data' => ['items' => array_slice($items, 0, 12), 'count' => count($items)]]);
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\ShopCustomer;
use App\Repositories\ShopOrderRepo;
use App\Repositories\WholesaleOrderRepo;
use App\Support\Api;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    /** Single order by its unique ENG-#### code (storefront SQLite-origin first, else order_system id). */
    public function show(Request $request, string $code)
    {
        // 1) Storefront order with this exact code.
        $order = (new ShopOrderRepo())->getByCode($code);
        if ($order) {
            return Api::ok(['order' => (new ShopOrderRepo())->detail((int) $order['id'])]);
        }

        // 2) Otherwise map the trailing number to an order_system id.
        if (preg_match('/(\d+)\s*$/', $code, $m)) {
            $num = (int) $m[1];
            $id = $num >= 1001 ? $num - 1000 : $num; // ENG-1007 -> 7, OS-7/#7 -> 7
            $mysql = (new WholesaleOrderRepo())->detail($id);
            if ($mysql) {
                return Api::ok(['order' => $mysql]);
            }
        }

        Api::halt('Order nahi mila', 404);
    }

    /** Logged-in customer's own order history (storefront + order_system merged). */
    public function myOrders(Request $request)
    {
        $customer = $this->customer($request);
        $sqlite = (new ShopOrderRepo())->byCustomer((int) $customer->id);
        $mysql = [];
        try {
            $mysql = (new WholesaleOrderRepo())->byPhone((string) ($customer->phone ?? ''));
        } catch (\Throwable $e) {
            $mysql = [];
        }
        $orders = array_merge($sqlite, $mysql);
        usort($orders, static fn ($a, $b) => strcmp((string) ($b['placed_at'] ?? ''), (string) ($a['placed_at'] ?? '')));
        return Api::ok(['customer' => $customer->publicData(), 'orders' => $orders]);
    }

    /** Customer order history by phone — merges storefront + order_system. */
    public function lookup(Request $request)
    {
        $phone = (string) $request->input('phone', '');
        $customer = ShopCustomer::findByPhone($phone);
        $sqlite = $customer ? (new ShopOrderRepo())->byCustomer((int) $customer->id) : [];
        $mysql = [];
        try {
            $mysql = (new WholesaleOrderRepo())->byPhone($phone);
        } catch (\Throwable $e) {
            $mysql = [];
        }
        $orders = array_merge($sqlite, $mysql);
        usort($orders, static fn ($a, $b) => strcmp((string) ($b['placed_at'] ?? ''), (string) ($a['placed_at'] ?? '')));
        return Api::ok([
            'found'    => count($orders) > 0,
            'customer' => $customer?->publicData(),
            'orders'   => $orders,
        ]);
    }
}

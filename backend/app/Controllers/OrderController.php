<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Response;
use App\Models\Order;
use App\Models\Customer;
use App\Models\RefOrder;

class OrderController extends Controller
{
    /**
     * Single order by its unique ENG-#### code. Storefront orders carry that
     * code in SQLite; MySQL order_system orders derive it as ENG-(1000+id), so
     * we resolve SQLite first (authoritative code column) and fall back to the
     * order_system id (ENG-1007 → 7). Legacy #7 / OS-7 codes also resolve.
     */
    public function show(array $p): void
    {
        $code = (string)$p['code'];

        // 1) SQLite storefront order with this exact code.
        $order = (new Order())->getByCode($code);
        if ($order) {
            Response::ok(['order' => (new Order())->detail((int)$order['id'])]);
        }

        // 2) Otherwise map the trailing number to an order_system id.
        if (preg_match('/(\d+)\s*$/', $code, $m)) {
            $num = (int)$m[1];
            $id = $num >= 1001 ? $num - 1000 : $num; // ENG-1007 → 7, OS-7/#7 → 7
            $mysql = (new RefOrder())->detail($id);
            if ($mysql) {
                Response::ok(['order' => $mysql]);
            }
        }

        Response::error('Order nahi mila', 404);
    }

    /**
     * Logged-in customer's own order history. Merges the storefront SQLite
     * orders with the MySQL order_system orders for the SAME phone, so the
     * profile shows everything tied to that number — same source the admin
     * dashboard reads from.
     */
    public function myOrders(): void
    {
        $customer = $this->requireCustomer();
        $sqlite = (new Order())->byCustomer((int)$customer['id']);
        $mysql = [];
        try {
            $mysql = (new RefOrder())->byPhone((string)($customer['phone'] ?? ''));
        } catch (\Throwable $e) {
            $mysql = [];
        }
        $orders = array_merge($sqlite, $mysql);
        // Newest first across both sources.
        usort($orders, static fn ($a, $b) => strcmp((string)($b['placed_at'] ?? ''), (string)($a['placed_at'] ?? '')));
        Response::ok(['customer' => (new Customer())->publicData($customer), 'orders' => $orders]);
    }

    /** Customer order history by phone — merges SQLite + order_system (MySQL). */
    public function lookup(): void
    {
        $phone = (string)$this->request->input('phone', '');
        $customer = (new Customer())->findByPhone($phone);
        $sqlite = $customer ? (new Order())->byCustomer((int)$customer['id']) : [];
        $mysql = [];
        try {
            $mysql = (new RefOrder())->byPhone($phone);
        } catch (\Throwable $e) {
            $mysql = [];
        }
        $orders = array_merge($sqlite, $mysql);
        usort($orders, static fn ($a, $b) => strcmp((string)($b['placed_at'] ?? ''), (string)($a['placed_at'] ?? '')));
        Response::ok(['found' => count($orders) > 0, 'customer' => $customer, 'orders' => $orders]);
    }
}

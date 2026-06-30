<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Repositories\ShopOrderRepo;
use App\Services\OrderService;
use App\Support\Api;
use Illuminate\Http\Request;
use InvalidArgumentException;

class OrderController extends Controller
{
    /** Orders come from fmcg_orders (storefront + admin orders). */
    public function index(Request $request)
    {
        $orders = (new ShopOrderRepo())->listAll([
            'status' => $request->query('status', 'all'),
            'q'      => $request->query('q', ''),
        ]);
        return Api::ok(['data' => $orders]);
    }

    /** Admin manually places a storefront order on behalf of a customer. */
    public function store(Request $request)
    {
        $data = $request->all();

        $errors = [];
        if (mb_strlen(trim((string) ($data['name'] ?? ''))) < 3) {
            $errors['name'] = 'Customer ka naam likhein.';
        }
        if (strlen(preg_replace('/[^0-9]/', '', (string) ($data['phone'] ?? ''))) < 10) {
            $errors['phone'] = 'Sahi mobile number likhein.';
        }
        if (mb_strlen(trim((string) ($data['address'] ?? ''))) < 6) {
            $errors['address'] = 'Customer ka pata likhein.';
        }
        if (empty($data['items']) || !is_array($data['items'])) {
            $errors['items'] = 'Kam az kam ek product add karein.';
        }
        if ($errors) {
            Api::halt('Form mukammal karein', 422, ['fields' => $errors]);
        }

        try {
            $order = (new OrderService())->checkout($data, 'admin');
        } catch (InvalidArgumentException $e) {
            Api::halt($e->getMessage(), 422);
        }
        return Api::ok(['order' => $order], 201);
    }

    public function show(Request $request, string $id)
    {
        $order = (new ShopOrderRepo())->detail((int) $id);
        if (!$order) {
            Api::halt('Order nahi mila', 404);
        }
        return Api::ok(['order' => $order]);
    }

    public function updateStatus(Request $request, string $id)
    {
        $status = (string) $request->input('status', '');
        $allowed = config('fmcg.order_statuses', ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled']);
        if (!in_array($status, $allowed, true)) {
            Api::halt('Ghalat status', 422);
        }
        $order = new ShopOrderRepo();
        if (!$order->exists((int) $id)) {
            Api::halt('Order nahi mila', 404);
        }

        // Keep stock in sync with the status change: cancelling RESTORES the
        // ordered units; un-cancelling an order RE-RESERVES them. (Other status
        // moves between active states don't touch stock.)
        $current = (string) ($order->getById((int) $id)['status'] ?? '');
        if ($status === 'cancelled' && $current !== 'cancelled') {
            $order->restoreStockForOrder((int) $id);
        } elseif ($current === 'cancelled' && $status !== 'cancelled') {
            $order->reserveStockForOrder((int) $id);
        }

        $order->updateStatus((int) $id, $status);
        return Api::ok(['order' => $order->detail((int) $id)]);
    }

    /** Apply / clear a discount on a single product within an order. */
    public function setItemDiscount(Request $request, string $id, string $item)
    {
        $orderId = (int) $id;
        $itemId = (int) $item;
        $amount = max(0, (int) $request->input('discount', 0));

        $order = new ShopOrderRepo();
        if (!$order->itemBelongsToOrder($itemId, $orderId)) {
            Api::halt('Item nahi mila', 404);
        }
        return Api::ok(['order' => $order->setItemDiscount($orderId, $itemId, (float) $amount)]);
    }
}

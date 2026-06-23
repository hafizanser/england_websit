<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Controller;
use App\Core\Response;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RefOrder;
use App\Services\OrderService;

class OrderController extends Controller
{
    public function index(): void
    {
        $this->requireAdmin();
        // Read the real orders from the shared order_system DB (same source as
        // the Profit pages) — not the local SQLite store.
        $orders = (new RefOrder())->listAll([
            'status' => $this->request->query['status'] ?? 'all',
            'q'      => $this->request->query['q'] ?? '',
        ]);
        Response::ok(['data' => $orders]);
    }

    /** Admin manually places an order on behalf of a customer (phone/WhatsApp). */
    public function store(): void
    {
        $this->requireAdmin();
        $data = $this->request->all();

        $errors = [];
        if (mb_strlen(trim((string)($data['name'] ?? ''))) < 3) {
            $errors['name'] = 'Customer ka naam likhein.';
        }
        if (strlen(preg_replace('/[^0-9]/', '', (string)($data['phone'] ?? ''))) < 10) {
            $errors['phone'] = 'Sahi mobile number likhein.';
        }
        if (mb_strlen(trim((string)($data['address'] ?? ''))) < 6) {
            $errors['address'] = 'Customer ka pata likhein.';
        }
        if (empty($data['items']) || !is_array($data['items'])) {
            $errors['items'] = 'Kam az kam ek product add karein.';
        }
        if ($errors) {
            Response::error('Form mukammal karein', 422, ['fields' => $errors]);
        }

        try {
            $order = (new OrderService())->checkout($data, 'admin');
        } catch (\InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        }
        Response::ok(['order' => $order], 201);
    }

    public function show(array $p): void
    {
        $this->requireAdmin();
        $order = (new RefOrder())->detail((int)$p['id']);
        if (!$order) {
            Response::error('Order nahi mila', 404);
        }
        Response::ok(['order' => $order]);
    }

    public function updateStatus(array $p): void
    {
        $this->requireAdmin();
        $status = (string)$this->request->input('status', '');
        $config = $GLOBALS['__config'] ?? [];
        $allowed = $config['order_statuses'] ?? ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
        if (!in_array($status, $allowed, true)) {
            Response::error('Ghalat status', 422);
        }
        $order = new RefOrder();
        if (!$order->exists((int)$p['id'])) {
            Response::error('Order nahi mila', 404);
        }
        $order->updateStatus((int)$p['id'], $status);
        Response::ok(['order' => $order->detail((int)$p['id'])]);
    }

    /** Apply / clear a discount on a single product within an order. */
    public function setItemDiscount(array $p): void
    {
        $this->requireAdmin();
        $orderId = (int)$p['id'];
        $itemId = (int)$p['item'];
        $amount = max(0, (int)$this->request->input('discount', 0));

        $order = new RefOrder();
        if (!$order->itemBelongsToOrder($itemId, $orderId)) {
            Response::error('Item nahi mila', 404);
        }
        Response::ok(['order' => $order->setItemDiscount($orderId, $itemId, (float)$amount)]);
    }
}

<?php
declare(strict_types=1);

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;

/** Orchestrates checkout: customer account + authoritative pricing + persistence. */
class OrderService
{
    private PricingService $pricing;
    private Order $orders;
    private OrderItem $items;
    private Customer $customers;

    public function __construct()
    {
        $this->pricing = new PricingService();
        $this->orders = new Order();
        $this->items = new OrderItem();
        $this->customers = new Customer();
    }

    /**
     * Place an order. Creates (or links) a customer account from the form data,
     * recomputes pricing server-side, and stores the order + items + status.
     */
    public function checkout(array $payload, string $source = 'website'): array
    {
        $rows = $payload['items'] ?? [];
        $items = $this->pricing->hydrate($rows);
        if (empty($items)) {
            throw new \InvalidArgumentException('Cart khali hai — koi valid product nahi mila.');
        }

        $code = $payload['code'] ?? null;
        $totals = $this->pricing->totals($items, $code);

        // auto-create / link the customer account
        $customer = $this->customers->findOrCreate([
            'name'    => trim((string)($payload['name'] ?? '')),
            'phone'   => trim((string)($payload['phone'] ?? '')),
            'email'   => trim((string)($payload['email'] ?? '')),
            'address' => trim((string)($payload['address'] ?? '')),
            'city'    => trim((string)($payload['city'] ?? '')),
        ]);

        $orderId = $this->orders->create([
            'customer_id'    => (int)$customer['id'],
            'status'         => 'pending',
            'subtotal'       => $totals['subtotal'],
            'promo_discount' => $totals['discount'],
            'item_discount'  => 0,
            'total'          => $totals['total'],
            'promo_code'     => $totals['codeStatus']['ok'] ?? false ? $code : null,
            'discount_lines' => $totals['lines'],
            'source'         => $source,
            'note'           => trim((string)($payload['note'] ?? '')),
        ]);

        foreach ($items as $it) {
            $this->items->add($orderId, $it);
        }

        $this->orders->addHistory(
            $orderId,
            'pending',
            $source === 'admin' ? 'Order admin dashboard se banaya gaya' : 'Order place hua website se',
        );

        return $this->orders->detail($orderId);
    }

    /** Quote totals without persisting (used by the cart/checkout preview). */
    public function quote(array $rows, ?string $code = null): array
    {
        $items = $this->pricing->hydrate($rows);
        return $this->pricing->totals($items, $code);
    }
}

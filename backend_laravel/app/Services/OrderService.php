<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ShopCustomer;
use App\Repositories\ShopOrderItemRepo;
use App\Repositories\ShopOrderRepo;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/** Orchestrates checkout: customer account + authoritative pricing + persistence. Port of Services\OrderService. */
class OrderService
{
    private PricingService $pricing;
    private ShopOrderRepo $orders;
    private ShopOrderItemRepo $items;

    public function __construct()
    {
        $this->pricing = new PricingService();
        $this->orders = new ShopOrderRepo();
        $this->items = new ShopOrderItemRepo();
    }

    public function checkout(array $payload, string $source = 'website'): array
    {
        $rows = $payload['items'] ?? [];
        $items = $this->pricing->hydrate($rows);
        if (empty($items)) {
            throw new InvalidArgumentException('Cart khali hai — koi valid product nahi mila.');
        }

        $code = $payload['code'] ?? null;
        $totals = $this->pricing->totals($items, $code);

        // All-or-nothing: customer + order + items + history must commit together,
        // so a mid-way failure can never leave a half-written order.
        return DB::transaction(function () use ($items, $totals, $code, $payload, $source) {
            $customer = ShopCustomer::findOrCreate([
                'name'    => trim((string) ($payload['name'] ?? '')),
                'phone'   => trim((string) ($payload['phone'] ?? '')),
                'email'   => trim((string) ($payload['email'] ?? '')),
                'address' => trim((string) ($payload['address'] ?? '')),
                'city'    => trim((string) ($payload['city'] ?? '')),
            ]);

            $orderId = $this->orders->create([
                'customer_id'    => (int) $customer->id,
                'status'         => 'pending',
                'subtotal'       => $totals['subtotal'],
                'promo_discount' => $totals['discount'],
                'item_discount'  => 0,
                'total'          => $totals['total'],
                'promo_code'     => ($totals['codeStatus']['ok'] ?? false) ? $code : null,
                'discount_lines' => $totals['lines'],
                'source'         => $source,
                'note'           => trim((string) ($payload['note'] ?? '')),
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
        });
    }

    public function quote(array $rows, ?string $code = null): array
    {
        $items = $this->pricing->hydrate($rows);
        return $this->pricing->totals($items, $code);
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Mail\NewOrderNotification;
use App\Models\ShopCustomer;
use App\Repositories\ProductRepo;
use App\Repositories\ShopOrderItemRepo;
use App\Repositories\ShopOrderRepo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use InvalidArgumentException;

/** Orchestrates checkout: customer account + authoritative pricing + persistence. Port of Services\OrderService. */
class OrderService
{
    private PricingService $pricing;
    private ShopOrderRepo $orders;
    private ShopOrderItemRepo $items;
    private ProductRepo $products;

    public function __construct()
    {
        $this->pricing = new PricingService();
        $this->orders = new ShopOrderRepo();
        $this->items = new ShopOrderItemRepo();
        $this->products = new ProductRepo();
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
        $order = DB::transaction(function () use ($items, $totals, $code, $payload, $source) {
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
                // Reduce available stock for the ordered units (single source of
                // truth). Inside the same transaction, so stock + order commit
                // together or not at all.
                $pid = (string) ($it['id'] ?? '');
                $qty = (int) ($it['qty'] ?? 0);
                if ($pid !== '' && $qty > 0) {
                    $this->products->adjustStock($pid, -$qty);
                }
            }

            $this->orders->addHistory(
                $orderId,
                'pending',
                $source === 'admin' ? 'Order admin dashboard se banaya gaya' : 'Order place hua website se',
            );

            return $this->orders->detail($orderId);
        });

        // Notify the admin of the new order. Best-effort and AFTER commit, so a
        // mail failure can never roll back or block a successfully placed order.
        $this->notifyAdmin($order);

        return $order;
    }

    /** Send the new-order notification email to the configured admin address. */
    private function notifyAdmin(?array $order): void
    {
        if (!$order) {
            return;
        }

        $to = config('mail.order_notify');
        if (!$to) {
            return;
        }

        // Send AFTER the HTTP response is flushed to the browser, so a slow or
        // unreachable SMTP server can NEVER delay (or appear to fail) checkout.
        // Best-effort: any error is logged, never thrown.
        dispatch(function () use ($to, $order) {
            try {
                Mail::to($to)->send(new NewOrderNotification($order));
            } catch (\Throwable $e) {
                Log::error('New-order notification email failed: ' . $e->getMessage());
            }
        })->afterResponse();
    }

    public function quote(array $rows, ?string $code = null): array
    {
        $items = $this->pricing->hydrate($rows);
        return $this->pricing->totals($items, $code);
    }
}

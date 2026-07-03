<?php

declare(strict_types=1);

namespace App\Services;

use App\Mail\NewOrderNotification;
use App\Models\ShopCustomer;
use App\Repositories\ProductRepo;
use App\Repositories\ShopOrderItemRepo;
use App\Repositories\ShopOrderRepo;
use App\Support\StockMath;
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

        // Authoritative stock guard: convert every ordered unit to the shared base
        // and enforce the single-source-of-truth pool per product BEFORE writing the
        // order. Mixed units (Cartons + Bundles …) share one pool, so an over-sell is
        // rejected with the existing stock-limit alert. Returns the exact main-unit
        // (carton) amount to decrement per product. Mirrors src/lib/pack.js.
        $decrements = $this->planStock($items);

        $code = $payload['code'] ?? null;
        $totals = $this->pricing->totals($items, $code);

        // All-or-nothing: customer + order + items + history must commit together,
        // so a mid-way failure can never leave a half-written order.
        $order = DB::transaction(function () use ($items, $decrements, $totals, $code, $payload, $source) {
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

            // Reduce available stock by the CONVERTED main-unit amount per product
            // (Boxes/Bundles consume a fraction of a Carton). Inside the same
            // transaction, so stock + order commit together or not at all.
            foreach ($decrements as $pid => $cartons) {
                if ($cartons > 0) {
                    $this->products->adjustStock((string) $pid, -$cartons);
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

    /**
     * Validate the cart against available stock using the shared conversion
     * (App\Support\StockMath) and return the main-unit (carton) amount to decrement
     * per product id. Throws InvalidArgumentException (surfaced as the 422 stock
     * alert) when any product's combined units exceed its pool.
     */
    private function planStock(array $items): array
    {
        // Group every unit line by product id so mixed units share one pool.
        $byProduct = [];
        foreach ($items as $it) {
            $pid = (string) ($it['id'] ?? '');
            if ($pid === '') {
                continue;
            }
            $byProduct[$pid][] = [
                'unitKey' => (string) ($it['unitKey'] ?? ($it['unit'] ?? '')),
                'qty'     => (int) ($it['qty'] ?? 0),
                'name'    => (string) ($it['name'] ?? ''),
            ];
        }
        if (!$byProduct) {
            return [];
        }

        $catalog = $this->products->byStorefrontIds(array_keys($byProduct));
        $decrements = [];
        foreach ($byProduct as $pid => $lines) {
            $p = $catalog[$pid] ?? null;
            if (!$p || $p['stock'] === null) {
                continue; // unknown product / unknown stock → no cap (mirror client)
            }
            $stock = (float) $p['stock'];
            $conv = $p['conversions'] ?? [];
            $unitKeys = array_map(fn ($o) => (string) ($o['unit'] ?? ''), $p['unitOptions'] ?? []);
            $name = $p['name'] ?? ($lines[0]['name'] ?? 'Product');
            $basePerMain = StockMath::basePerMain($conv, $unitKeys);

            if ($basePerMain > 0) {
                // Shared pool: committed base ≤ total base.
                $committed = StockMath::committedBase($lines, $conv);
                $available = $stock * $basePerMain;
                if ($committed > $available + 1e-9) {
                    $this->throwStock($name, $stock, $conv, $unitKeys, $lines[0]['unitKey'] ?? '');
                }
                $decrements[$pid] = $committed / $basePerMain;
            } else {
                // Single-unit product (no conversion data): raw qty vs raw stock.
                $rawQty = array_sum(array_map(fn ($l) => (int) $l['qty'], $lines));
                if ($stock <= 0 || $rawQty > $stock + 1e-9) {
                    $this->throwStock($name, $stock, $conv, $unitKeys, $lines[0]['unitKey'] ?? '');
                }
                $decrements[$pid] = (float) $rawQty;
            }
        }
        return $decrements;
    }

    /** Raise the stock-limit alert, phrased in the offending line's unit. */
    private function throwStock(string $name, float $stock, array $conv, array $unitKeys, string $unitKey): void
    {
        $label = StockMath::unitLabel($unitKey !== '' ? $unitKey : 'carton');
        $basePerMain = StockMath::basePerMain($conv, $unitKeys);
        $per = $basePerMain > 0 ? (StockMath::unitBase($unitKey, $conv) ?: 1) : 1;
        $avail = $basePerMain > 0
            ? (int) floor(($stock * $basePerMain) / $per)
            : (int) floor(max(0.0, $stock));
        throw new InvalidArgumentException(
            sprintf('Stock kam hai — "%s" ke liye sirf %d %s available hain.', $name, $avail, $label)
        );
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

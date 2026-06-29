<?php
declare(strict_types=1);

namespace App\Services;

use App\Models\Customer;
use App\Models\RefCustomer;
use App\Models\RefOrder;

/** Orchestrates checkout: customer account + authoritative pricing + persistence. */
class OrderService
{
    private PricingService $pricing;
    private Customer $customers;       // SQLite storefront account (auth / session / saved cart)
    private RefCustomer $refCustomers; // order_system customer the order FKs to (MySQL)
    private RefOrder $refOrders;       // shared order_system orders the admin reads (MySQL)

    public function __construct()
    {
        $this->pricing = new PricingService();
        $this->customers = new Customer();
        $this->refCustomers = new RefCustomer();
        $this->refOrders = new RefOrder();
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

        $name    = trim((string)($payload['name'] ?? ''));
        $phone   = trim((string)($payload['phone'] ?? ''));
        $email   = trim((string)($payload['email'] ?? ''));
        $address = trim((string)($payload['address'] ?? ''));
        $city    = trim((string)($payload['city'] ?? ''));

        // 1) Storefront account (SQLite) — powers customer auth / session / saved
        //    cart, so guest checkout still auto-logs the shopper in afterwards.
        $this->customers->findOrCreate([
            'name'    => $name,
            'phone'   => $phone,
            'email'   => $email,
            'address' => $address,
            'city'    => $city,
        ]);

        // 2) order_system customer (MySQL tbl_customer) — the order FKs to this.
        $refCustomer = $this->refCustomers->findOrCreateByCheckout([
            'customer_name'         => $name,
            'customer_phone_number' => $phone,
            'customer_address'      => $address,
            'email'                 => $email,
            'shop_name'             => trim((string)($payload['shop_name'] ?? '')),
        ]);

        // 3) Persist the order into the shared order_system DB — the SAME store the
        //    admin orders list / detail / profit / customers / notifications read.
        //    Website => 'website', admin dashboard => 'dashboard' (RefOrder maps
        //    these back to the website/admin buckets the admin source filter uses).
        $orderId = $this->refOrders->create([
            'order_source' => $source === 'admin' ? 'dashboard' : 'website',
            'customer_id'  => (int)$refCustomer['id'],
            'city'         => $city,
            'status'       => 'In Progress',
            'total_amount' => $totals['total'],
            'order_notes'  => trim((string)($payload['note'] ?? '')),
        ]);

        foreach ($items as $it) {
            $this->refOrders->addItem($orderId, $it);
        }

        return $this->refOrders->detail($orderId);
    }

    /** Quote totals without persisting (used by the cart/checkout preview). */
    public function quote(array $rows, ?string $code = null): array
    {
        $items = $this->pricing->hydrate($rows);
        return $this->pricing->totals($items, $code);
    }
}

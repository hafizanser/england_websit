<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Response;
use App\Services\OrderService;
use App\Models\Customer;

class CheckoutController extends Controller
{
    /** Place an order as a guest; account is auto-created from the form. */
    public function place(): void
    {
        $data = $this->request->all();

        // minimal validation
        $errors = [];
        if (mb_strlen(trim((string)($data['name'] ?? ''))) < 3) {
            $errors['name'] = 'Naam likhein (kam az kam 3 harf).';
        }
        $phoneDigits = preg_replace('/[^0-9]/', '', (string)($data['phone'] ?? ''));
        if (strlen($phoneDigits) !== 11) {
            $errors['phone'] = 'Mobile number 11 digit ka hona chahiye.';
        }
        if (mb_strlen(trim((string)($data['address'] ?? ''))) < 6) {
            $errors['address'] = 'Dukaan ka poora pata likhein.';
        }
        if (empty($data['items']) || !is_array($data['items'])) {
            $errors['items'] = 'Cart khali hai.';
        }
        if ($errors) {
            Response::error('Form mukammal karein', 422, ['fields' => $errors]);
        }

        try {
            $order = (new OrderService())->checkout($data, 'website');
        } catch (\InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        }

        // Auto-login: checkout always finds-or-creates the customer account, so
        // issue a fresh session token here and hand it back. The storefront uses
        // it to log the shopper in instantly — no separate register/login step.
        $session = null;
        $customers = new Customer();
        $cust = $customers->findByPhone((string)($data['phone'] ?? ''));
        if ($cust) {
            $session = [
                'token'    => $customers->issueToken((int)$cust['id']),
                'customer' => $customers->publicData($cust),
            ];
        }

        Response::ok(['order' => $order, 'session' => $session], 201);
    }
}

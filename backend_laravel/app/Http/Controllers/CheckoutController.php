<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\ShopCustomer;
use App\Services\OrderService;
use App\Support\Api;
use Illuminate\Http\Request;
use InvalidArgumentException;

class CheckoutController extends Controller
{
    /** Place an order as a guest; account is auto-created from the form. */
    public function place(Request $request)
    {
        $data = $request->all();

        $errors = [];
        if (mb_strlen(trim((string) ($data['name'] ?? ''))) < 3) {
            $errors['name'] = 'Naam likhein (kam az kam 3 harf).';
        }
        $phoneDigits = preg_replace('/[^0-9]/', '', (string) ($data['phone'] ?? ''));
        if (strlen($phoneDigits) !== 11) {
            $errors['phone'] = 'Mobile number 11 digit ka hona chahiye.';
        }
        if (mb_strlen(trim((string) ($data['address'] ?? ''))) < 6) {
            $errors['address'] = 'Dukaan ka poora pata likhein.';
        }
        if (empty($data['items']) || !is_array($data['items'])) {
            $errors['items'] = 'Cart khali hai.';
        }
        if ($errors) {
            Api::halt('Form mukammal karein', 422, ['fields' => $errors]);
        }

        try {
            $order = (new OrderService())->checkout($data, 'website');
        } catch (InvalidArgumentException $e) {
            Api::halt($e->getMessage(), 422);
        }

        // Auto-login: issue a fresh session token for the (found-or-created) account.
        $session = null;
        $cust = ShopCustomer::findByPhone((string) ($data['phone'] ?? ''));
        if ($cust) {
            $session = [
                'token'    => $cust->issueToken(),
                'customer' => $cust->publicData(),
            ];
        }

        return Api::ok(['order' => $order, 'session' => $session], 201);
    }
}

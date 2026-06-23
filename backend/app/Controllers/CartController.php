<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Response;
use App\Models\Cart;

/** Customer-owned saved cart (requires a customer session token). */
class CartController extends Controller
{
    public function show(): void
    {
        $customer = $this->requireCustomer();
        Response::ok(['data' => (new Cart())->forCustomer((int)$customer['id'])]);
    }

    public function save(): void
    {
        $customer = $this->requireCustomer();
        $rows = $this->request->input('rows', []);
        $code = $this->request->input('code', null);
        if (!is_array($rows)) {
            $rows = [];
        }
        $saved = (new Cart())->save((int)$customer['id'], $rows, is_string($code) ? $code : null);
        Response::ok(['data' => $saved]);
    }

    public function clear(): void
    {
        $customer = $this->requireCustomer();
        (new Cart())->clear((int)$customer['id']);
        Response::ok(['data' => ['rows' => [], 'code' => null]]);
    }
}

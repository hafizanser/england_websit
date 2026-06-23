<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\CartRepo;
use App\Support\Api;
use Illuminate\Http\Request;

/** Customer-owned saved cart (requires a customer session token). */
class CartController extends Controller
{
    public function show(Request $request)
    {
        $customer = $this->customer($request);
        return Api::ok(['data' => (new CartRepo())->forCustomer((int) $customer->id)]);
    }

    public function save(Request $request)
    {
        $customer = $this->customer($request);
        $rows = $request->input('rows', []);
        $code = $request->input('code', null);
        if (!is_array($rows)) {
            $rows = [];
        }
        $saved = (new CartRepo())->save((int) $customer->id, $rows, is_string($code) ? $code : null);
        return Api::ok(['data' => $saved]);
    }

    public function clear(Request $request)
    {
        $customer = $this->customer($request);
        (new CartRepo())->clear((int) $customer->id);
        return Api::ok(['data' => ['rows' => [], 'code' => null]]);
    }
}

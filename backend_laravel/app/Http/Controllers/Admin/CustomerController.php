<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Repositories\WholesaleCustomerRepo;
use App\Support\Api;
use Illuminate\Http\Request;

/** Admin customer management against the shared order_system customers (tbl_customer). */
class CustomerController extends Controller
{
    public function index()
    {
        return Api::ok(['data' => (new WholesaleCustomerRepo())->withStats()]);
    }

    public function show(Request $request, string $id)
    {
        $model = new WholesaleCustomerRepo();
        $customer = $model->getById((int) $id);
        if (!$customer) {
            Api::halt('Customer nahi mila', 404);
        }
        $customer['orders'] = $model->orders((int) $id);
        return Api::ok(['customer' => $customer]);
    }

    public function store(Request $request)
    {
        $d = $request->all();
        if (mb_strlen(trim((string) ($d['customer_name'] ?? ''))) < 2) {
            Api::halt('Customer ka naam likhein', 422);
        }
        if (trim((string) ($d['customer_phone_number'] ?? '')) === '') {
            Api::halt('Phone number likhein', 422);
        }
        return Api::ok(['customer' => (new WholesaleCustomerRepo())->insert($this->fields($d))], 201);
    }

    public function update(Request $request, string $id)
    {
        $id = (int) $id;
        $model = new WholesaleCustomerRepo();
        if (!$model->getById($id)) {
            Api::halt('Customer nahi mila', 404);
        }
        $d = $request->all();
        if (mb_strlen(trim((string) ($d['customer_name'] ?? ''))) < 2) {
            Api::halt('Customer ka naam likhein', 422);
        }
        return Api::ok(['customer' => $model->update($id, $this->fields($d))]);
    }

    public function destroy(Request $request, string $id)
    {
        (new WholesaleCustomerRepo())->delete((int) $id);
        return Api::ok(['deleted' => (int) $id]);
    }

    private function fields(array $d): array
    {
        $out = [];
        foreach (['customer_name', 'customer_address', 'customer_phone_number', 'shop_name', 'adda_name', 'pandi_name', 'ptcl_number', 'email'] as $k) {
            if (array_key_exists($k, $d)) {
                $out[$k] = is_string($d[$k]) ? trim($d[$k]) : $d[$k];
            }
        }
        return $out;
    }
}

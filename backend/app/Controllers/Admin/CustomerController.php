<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Controller;
use App\Core\Response;
use App\Models\RefCustomer;

/** Admin customer management against the shared order_system customers (tbl_customer). */
class CustomerController extends Controller
{
    public function index(): void
    {
        $this->requireAdmin();
        Response::ok(['data' => (new RefCustomer())->withStats()]);
    }

    public function show(array $p): void
    {
        $this->requireAdmin();
        $model = new RefCustomer();
        $customer = $model->getById((int)$p['id']);
        if (!$customer) {
            Response::error('Customer nahi mila', 404);
        }
        $customer['orders'] = $model->orders((int)$p['id']);
        Response::ok(['customer' => $customer]);
    }

    public function store(): void
    {
        $this->requireAdmin();
        $d = $this->request->all();
        if (mb_strlen(trim((string)($d['customer_name'] ?? ''))) < 2) {
            Response::error('Customer ka naam likhein', 422);
        }
        if (trim((string)($d['customer_phone_number'] ?? '')) === '') {
            Response::error('Phone number likhein', 422);
        }
        Response::ok(['customer' => (new RefCustomer())->insert($this->fields($d))], 201);
    }

    public function update(array $p): void
    {
        $this->requireAdmin();
        $id = (int)$p['id'];
        $model = new RefCustomer();
        if (!$model->getById($id)) {
            Response::error('Customer nahi mila', 404);
        }
        $d = $this->request->all();
        if (mb_strlen(trim((string)($d['customer_name'] ?? ''))) < 2) {
            Response::error('Customer ka naam likhein', 422);
        }
        Response::ok(['customer' => $model->update($id, $this->fields($d))]);
    }

    public function destroy(array $p): void
    {
        $this->requireAdmin();
        (new RefCustomer())->delete((int)$p['id']);
        Response::ok(['deleted' => (int)$p['id']]);
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

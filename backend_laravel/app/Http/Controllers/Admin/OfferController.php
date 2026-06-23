<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Repositories\OfferRepo;
use App\Support\Api;
use App\Support\Uploads;
use Illuminate\Http\Request;

/** Admin offer management against the shared order_system catalogue (offers table). */
class OfferController extends Controller
{
    public function index()
    {
        return Api::ok(['data' => (new OfferRepo())->all()]);
    }

    public function store(Request $request)
    {
        $d = $request->all();
        if (empty($d['main_product_id'])) {
            Api::halt('Main product chunein', 422);
        }
        $data = $this->payload($d);
        if ($request->hasFile('banner_image')) {
            $data['banner_image'] = Uploads::save($request->file('banner_image'), 'offer');
        }
        return Api::ok(['offer' => (new OfferRepo())->insert($data)], 201);
    }

    public function update(Request $request, string $id)
    {
        $id = (int) $id;
        $model = new OfferRepo();
        $existing = $model->getById($id);
        if (!$existing) {
            Api::halt('Offer nahi mili', 404);
        }
        $data = $this->payload($request->all());
        if ($request->hasFile('banner_image')) {
            $data['banner_image'] = Uploads::save($request->file('banner_image'), 'offer');
            if (!empty($existing['banner_image'])) {
                Uploads::delete($existing['banner_image']);
            }
        }
        return Api::ok(['offer' => $model->update($id, $data)]);
    }

    public function destroy(Request $request, string $id)
    {
        (new OfferRepo())->delete((int) $id);
        return Api::ok(['deleted' => (int) $id]);
    }

    private function payload(array $d): array
    {
        $otherFree = $this->boolInt($d, 'is_other_product_free');
        return [
            'main_product_id'       => (int) ($d['main_product_id'] ?? 0),
            'main_unit_type'        => (string) ($d['main_unit_type'] ?? 'box'),
            'main_quantity'         => max(1, (int) ($d['main_quantity'] ?? 1)),
            'is_other_product_free' => $otherFree,
            'free_product_id'       => $otherFree && !empty($d['free_product_id']) ? (int) $d['free_product_id'] : null,
            'free_unit_type'        => (string) ($d['free_unit_type'] ?? ''),
            'free_quantity'         => max(1, (int) ($d['free_quantity'] ?? 1)),
            'is_active'             => array_key_exists('is_active', $d) ? $this->boolInt($d, 'is_active') : 1,
        ];
    }

    private function boolInt(array $d, string $k): int
    {
        return in_array($d[$k] ?? 0, [true, 1, '1', 'true', 'on', 'yes'], true) ? 1 : 0;
    }
}

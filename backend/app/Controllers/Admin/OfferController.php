<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Controller;
use App\Core\Response;
use App\Core\Uploads;
use App\Models\RefOffer;

/**
 * Admin offer management against the shared order_system catalogue (offers table).
 * Product-linked buy/free deals with an uploadable banner image.
 */
class OfferController extends Controller
{
    public function index(): void
    {
        $this->requireAdmin();
        Response::ok(['data' => (new RefOffer())->all()]);
    }

    public function store(): void
    {
        $this->requireAdmin();
        $d = $this->request->all();
        if (empty($d['main_product_id'])) {
            Response::error('Main product chunein', 422);
        }
        $data = $this->payload($d);
        if ($this->request->hasFile('banner_image')) {
            $data['banner_image'] = Uploads::save($this->request->file('banner_image'), 'offer');
        }
        Response::ok(['offer' => (new RefOffer())->insert($data)], 201);
    }

    public function update(array $p): void
    {
        $this->requireAdmin();
        $id = (int) $p['id'];
        $model = new RefOffer();
        $existing = $model->getById($id);
        if (!$existing) {
            Response::error('Offer nahi mili', 404);
        }
        $data = $this->payload($this->request->all());
        if ($this->request->hasFile('banner_image')) {
            $data['banner_image'] = Uploads::save($this->request->file('banner_image'), 'offer');
            if (!empty($existing['banner_image'])) {
                Uploads::delete($existing['banner_image']);
            }
        }
        Response::ok(['offer' => $model->update($id, $data)]);
    }

    public function destroy(array $p): void
    {
        $this->requireAdmin();
        (new RefOffer())->delete((int) $p['id']);
        Response::ok(['deleted' => (int) $p['id']]);
    }

    /** Map request fields to the offers table columns. */
    private function payload(array $d): array
    {
        $otherFree = $this->boolInt($d, 'is_other_product_free');
        return [
            'main_product_id'       => (int) ($d['main_product_id'] ?? 0),
            'main_unit_type'        => (string) ($d['main_unit_type'] ?? 'box'),
            'main_quantity'         => max(1, (int) ($d['main_quantity'] ?? 1)),
            'is_other_product_free' => $otherFree,
            // Free product only applies to "other product" offers; the free
            // UNIT TYPE + QUANTITY are always persisted (a same-product offer
            // still grants free units of the main product).
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

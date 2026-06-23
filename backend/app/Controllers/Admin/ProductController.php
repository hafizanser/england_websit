<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Controller;
use App\Core\Response;
use App\Core\Uploads;
use App\Models\RefProduct;

/**
 * Admin product management against the shared order_system catalogue.
 * Field set & behaviour mirror the reference order_management app
 * (image upload, unit types, tiered pricing, MRP, cost, packing, flags).
 */
class ProductController extends Controller
{
    public function index(): void
    {
        $this->requireAdmin();
        Response::ok(['data' => (new RefProduct())->all()]);
    }

    public function show(array $p): void
    {
        $this->requireAdmin();
        $product = (new RefProduct())->getById((int)$p['id']);
        if (!$product) {
            Response::error('Product nahi mila', 404);
        }
        Response::ok(['product' => $product]);
    }

    public function store(): void
    {
        $this->requireAdmin();
        $d = $this->request->all();
        if (mb_strlen(trim((string)($d['product_name'] ?? ''))) < 2) {
            Response::error('Product ka naam likhein', 422);
        }

        $data = $this->payload($d);

        // Primary image
        if ($this->request->hasFile('product_image')) {
            $data['product_image'] = Uploads::save($this->request->file('product_image'));
        }

        // Gallery images
        $gallery = [];
        foreach ($this->request->files('multiple_images') as $i => $file) {
            $gallery[] = Uploads::save($file, (string)rand(100, 999));
        }
        $data['multiple_images'] = $gallery;

        Response::ok(['product' => (new RefProduct())->insert($data)], 201);
    }

    public function update(array $p): void
    {
        $this->requireAdmin();
        $id = (int)$p['id'];
        $model = new RefProduct();
        $existing = $model->getById($id);
        if (!$existing) {
            Response::error('Product nahi mila', 404);
        }

        $d = $this->request->all();
        $data = $this->payload($d);

        // Primary image: replace if a new file came in, else keep the current one.
        if ($this->request->hasFile('product_image')) {
            $data['product_image'] = Uploads::save($this->request->file('product_image'));
            if (!empty($existing['product_image'])) {
                Uploads::delete($existing['product_image']);
            }
        }

        // Gallery: keep whatever the client says to keep (existing_images), append new uploads,
        // and delete files that were removed.
        $old = $existing['multiple_images'] ?? [];
        if (array_key_exists('existing_images', $d)) {
            $keep = $d['existing_images'];
            if (is_string($keep)) {
                $decoded = json_decode($keep, true);
                $keep = is_array($decoded)
                    ? $decoded
                    : array_filter(array_map('trim', explode(',', $keep)));
            }
            $keep = is_array($keep) ? array_values($keep) : [];
            foreach (array_diff($old, $keep) as $removed) {
                Uploads::delete($removed);
            }
        } else {
            $keep = $old;
        }
        foreach ($this->request->files('multiple_images') as $file) {
            $keep[] = Uploads::save($file, (string)rand(100, 999));
        }
        $data['multiple_images'] = array_values(array_filter($keep));

        Response::ok(['product' => $model->update($id, $data)]);
    }

    public function destroy(array $p): void
    {
        $this->requireAdmin();
        (new RefProduct())->delete((int)$p['id']);
        Response::ok(['deleted' => (int)$p['id']]);
    }

    // ---- helpers -----------------------------------------------------------

    /** Build the column data (everything except images) from request input. */
    private function payload(array $d): array
    {
        return [
            'category_id'             => $this->filled($d, 'category_id') ? (int)$d['category_id'] : null,
            'product_name'            => (string)($d['product_name'] ?? ''),
            'short_description'        => $this->strOrNull($d, 'short_description'),
            'product_description'      => $this->strOrNull($d, 'product_description'),
            'piece_price'             => (float)($d['piece_price'] ?? 0),
            'box_price'               => (float)($d['box_price'] ?? 0),
            'cotton_price'            => (float)($d['cotton_price'] ?? 0),
            'packet_price'            => $this->numOrNull($d, 'packet_price'),
            'dozen_price'             => $this->numOrNull($d, 'dozen_price'),
            'bundle_price'            => $this->numOrNull($d, 'bundle_price'),
            'unit_types'              => RefProduct::normalizeUnitTypes($d['unit_types'] ?? []),
            'production_piece_price'  => $this->numOrNull($d, 'production_piece_price'),
            'production_box_price'    => $this->numOrNull($d, 'production_box_price'),
            'production_cotton_price' => $this->numOrNull($d, 'production_cotton_price'),
            'production_packet_price' => $this->numOrNull($d, 'production_packet_price'),
            'production_dozen_price'  => $this->numOrNull($d, 'production_dozen_price'),
            'production_bundle_price' => $this->numOrNull($d, 'production_bundle_price'),
            'dozen_in_box'            => (float)($d['dozen_in_box'] ?? 0),
            'boxes_in_cotton'         => (int)($d['boxes_in_cotton'] ?? 0),
            'pieces_per_bundle'       => $this->numOrNull($d, 'pieces_per_bundle'),
            'pieces_per_packet'       => $this->numOrNull($d, 'pieces_per_packet'),
            'total_stock_cotton'      => (float)($d['total_stock_cotton'] ?? 0),
            'mrp_piece'               => $this->numOrNull($d, 'mrp_piece'),
            'mrp_box'                 => $this->numOrNull($d, 'mrp_box'),
            'mrp_carton'              => $this->numOrNull($d, 'mrp_carton'),
            'mrp_packet'              => $this->numOrNull($d, 'mrp_packet'),
            'mrp_dozen'               => $this->numOrNull($d, 'mrp_dozen'),
            'mrp_bundle'              => $this->numOrNull($d, 'mrp_bundle'),
            'show_profit_breakdown'   => $this->boolInt($d, 'show_profit_breakdown', true),
            'is_featured'             => $this->boolInt($d, 'is_featured', false),
            'is_active'               => $this->boolInt($d, 'is_active', true),
        ];
    }

    private function filled(array $d, string $k): bool
    {
        return isset($d[$k]) && trim((string)$d[$k]) !== '';
    }

    private function strOrNull(array $d, string $k): ?string
    {
        return $this->filled($d, $k) ? (string)$d[$k] : null;
    }

    private function numOrNull(array $d, string $k): ?float
    {
        return $this->filled($d, $k) ? (float)$d[$k] : null;
    }

    private function boolInt(array $d, string $k, bool $default): int
    {
        if (!array_key_exists($k, $d)) {
            return $default ? 1 : 0;
        }
        $v = $d[$k];
        return in_array($v, [true, 1, '1', 'true', 'on', 'yes'], true) ? 1 : 0;
    }
}

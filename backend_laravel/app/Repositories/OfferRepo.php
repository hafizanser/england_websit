<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\Uploads;

/**
 * Offers in the shared order_system database (offers table). Product-linked
 * buy/free deals. Port of Models\RefOffer.
 */
class OfferRepo extends BaseRepo
{
    protected string $table = 'offers';

    private const WRITABLE = [
        'banner_image', 'main_product_id', 'main_unit_type', 'main_quantity',
        'is_other_product_free', 'free_product_id', 'free_unit_type', 'free_quantity', 'is_active',
    ];

    public function all(): array
    {
        $sql = "SELECT o.*, mp.product_name AS main_product_name, fp.product_name AS free_product_name
                FROM offers o
                LEFT JOIN tbl_product mp ON mp.id = o.main_product_id
                LEFT JOIN tbl_product fp ON fp.id = o.free_product_id
                ORDER BY o.id DESC";
        return array_map([$this, 'decorate'], $this->select($sql));
    }

    public function getById(int $id): ?array
    {
        $sql = "SELECT o.*, mp.product_name AS main_product_name, fp.product_name AS free_product_name
                FROM offers o
                LEFT JOIN tbl_product mp ON mp.id = o.main_product_id
                LEFT JOIN tbl_product fp ON fp.id = o.free_product_id
                WHERE o.id = ? LIMIT 1";
        $row = $this->first($sql, [$id]);
        return $row ? $this->decorate($row) : null;
    }

    public function storefront(): array
    {
        $sql = "SELECT o.*, mp.product_name AS main_product_name, fp.product_name AS free_product_name
                FROM offers o
                LEFT JOIN tbl_product mp ON mp.id = o.main_product_id
                LEFT JOIN tbl_product fp ON fp.id = o.free_product_id
                WHERE o.is_active = 1
                ORDER BY o.id DESC";
        $rows = $this->select($sql);
        $rp = new ProductRepo();
        $out = [];
        foreach ($rows as $i => $row) {
            $o = $this->toStorefront($this->decorate($row), $rp);
            $o['featured'] = $i === 0 ? 'lg' : 'sm';
            $out[] = $o;
        }
        return $out;
    }

    public function storefrontFeatured(): array
    {
        $all = $this->storefront();
        return ['hero' => $all[0] ?? null, 'sides' => array_slice($all, 1, 2)];
    }

    public function storefrontBySlug(string $slug): ?array
    {
        foreach ($this->storefront() as $o) {
            if ($o['slug'] === $slug) {
                return $o;
            }
        }
        return null;
    }

    private function toStorefront(array $row, ProductRepo $rp): array
    {
        $mainId = $row['main_product_id'] ?? null;
        $freeId = $row['free_product_id'] ?? null;
        $otherFree = (int) ($row['is_other_product_free'] ?? 0) === 1 && $freeId;

        $buyQty   = (int) ($row['main_quantity'] ?? 0);
        $freeQty  = (int) ($row['free_quantity'] ?? 0);
        $grantsFree = $buyQty > 0 && $freeQty > 0;

        $mainProduct = $mainId ? $rp->storefrontById((string) $mainId) : null;
        $freeProduct = !$grantsFree ? null : ($otherFree ? $rp->storefrontById((string) $freeId) : $mainProduct);

        $mainName = $row['main_product_name'] ?: ($mainProduct['name'] ?? 'Product');
        $freeName = $otherFree ? ($row['free_product_name'] ?: ($freeProduct['name'] ?? $mainName)) : $mainName;
        $mainUnit = (string) ($row['main_unit_type'] ?? 'unit');
        $freeUnit = (string) ($row['free_unit_type'] ?? $mainUnit);
        $unitLabel = fn (string $u) => ['cotton' => 'Carton', 'box' => 'Box', 'piece' => 'Piece', 'packet' => 'Packet', 'dozen' => 'Dozen', 'bundle' => 'Bundle'][$u] ?? ucfirst($u);

        $save  = $freeQty > 0 ? ($freeQty . ' ' . $unitLabel($freeUnit) . ' FREE') : 'Special deal';
        $title = $grantsFree
            ? "Buy {$buyQty} {$unitLabel($mainUnit)}, get {$freeQty} {$unitLabel($freeUnit)} FREE"
            : ($mainName . ' — khaas offer');
        $desc  = $grantsFree
            ? ($otherFree
                ? "{$mainName} ke {$buyQty} {$unitLabel($mainUnit)} khareedein aur {$freeName} ke {$freeQty} {$unitLabel($freeUnit)} bilkul free payein."
                : "{$mainName} ke {$buyQty} {$unitLabel($mainUnit)} khareedein, {$freeQty} {$unitLabel($freeUnit)} bilkul free.")
            : "{$mainName} par khaas thok deal — abhi cart mein daalein.";

        return [
            'id'          => 'deal-' . $row['id'],
            'slug'        => 'deal-' . $row['id'],
            'type'        => 'bxgy',
            'kicker'      => 'Special Offer',
            'tag'         => 'Deal',
            'title'       => $title,
            'desc'        => $desc,
            'description' => $desc,
            'save'        => $save,
            'save_label'  => $save,
            'code'        => null,
            'seed'        => 'offer-' . $row['id'],
            'theme'       => 'from-brand-900 via-brand-800 to-saffron-700',
            'banner'      => $row['banner_image_url'] ?? null,
            'productIds'  => $mainId ? [(string) $mainId] : [],
            'config'      => [
                'banner'        => $row['banner_image_url'] ?? null,
                'buyQty'        => $buyQty,
                'freeQty'       => $freeQty,
                'mainUnit'      => $mainUnit,
                'freeUnit'      => $freeUnit,
                'freeProductId' => $otherFree ? (string) $freeId : ($mainId ? (string) $mainId : null),
                'isFreeOffer'   => $grantsFree,
                'sameProduct'   => !$otherFree,
            ],
            'mainProduct' => $mainProduct,
            'freeProduct' => $freeProduct,
            'terms'       => array_values(array_filter([
                $buyQty > 0 ? "{$buyQty} {$unitLabel($mainUnit)} {$mainName} khareedein" : null,
                $grantsFree ? "{$freeQty} {$unitLabel($freeUnit)} {$freeName} bilkul free" : null,
                'Stock khatam hone tak — abhi order karein',
            ])),
            'expiry'      => 'Limited time offer',
            'featured'    => null,
            'active'      => (int) ($row['is_active'] ?? 0),
        ];
    }

    public function insert(array $data): array
    {
        $row = $this->prepareRow($data);
        $now = date('Y-m-d H:i:s');
        $row['created_at'] = $now;
        $row['updated_at'] = $now;
        $cols = array_keys($row);
        $place = implode(', ', array_map(fn ($c) => ':' . $c, $cols));
        $this->exec("INSERT INTO {$this->table} (" . implode(', ', $cols) . ") VALUES ($place)", $row);
        return $this->getById($this->lastId());
    }

    public function update(int $id, array $data): array
    {
        $row = $this->prepareRow($data);
        $row['updated_at'] = date('Y-m-d H:i:s');
        $set = implode(', ', array_map(fn ($c) => "$c = :$c", array_keys($row)));
        $row['__id'] = $id;
        $this->exec("UPDATE {$this->table} SET $set WHERE id = :__id", $row);
        return $this->getById($id);
    }

    public function delete(int $id): void
    {
        $o = $this->first("SELECT banner_image FROM {$this->table} WHERE id = ?", [$id]);
        if ($o) {
            Uploads::delete($o['banner_image'] ?? null);
        }
        $this->exec("DELETE FROM {$this->table} WHERE id = ?", [$id]);
    }

    private function prepareRow(array $data): array
    {
        $row = [];
        foreach (self::WRITABLE as $col) {
            if (array_key_exists($col, $data)) {
                $row[$col] = $data[$col];
            }
        }
        return $row;
    }

    private function decorate(array $row): array
    {
        $row['banner_image_url'] = Uploads::url($row['banner_image'] ?? null);
        foreach (['is_other_product_free', 'is_active'] as $b) {
            $row[$b] = (int) ($row[$b] ?? 0);
        }
        foreach (['main_product_id', 'free_product_id', 'main_quantity', 'free_quantity'] as $n) {
            $row[$n] = isset($row[$n]) && $row[$n] !== null ? (int) $row[$n] : null;
        }
        return $row;
    }
}

<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\MysqlModel;
use App\Core\Uploads;

/**
 * Offers in the shared order_system database (offers table).
 * Product-linked "buy X, optionally get Y free" deals — mirrors the
 * reference order_management schema exactly.
 */
class RefOffer extends MysqlModel
{
    protected string $table = 'offers';

    /** Columns this dashboard writes (everything except id / timestamps). */
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
        return array_map([$this, 'decorate'], $this->run($sql)->fetchAll());
    }

    public function getById(int $id): ?array
    {
        $sql = "SELECT o.*, mp.product_name AS main_product_name, fp.product_name AS free_product_name
                FROM offers o
                LEFT JOIN tbl_product mp ON mp.id = o.main_product_id
                LEFT JOIN tbl_product fp ON fp.id = o.free_product_id
                WHERE o.id = ? LIMIT 1";
        $row = $this->run($sql, [$id])->fetch();
        return $row ? $this->decorate($row) : null;
    }

    // -----------------------------------------------------------------------
    // Storefront projection — maps the BXGY admin offer (main/free product +
    // quantities) onto the rich offer shape the public /offers page expects,
    // and embeds the resolved storefront products so the cards can add the
    // paid + free items straight to the cart.
    // -----------------------------------------------------------------------

    /** Active admin offers, transformed for the storefront (hero first). */
    public function storefront(): array
    {
        $sql = "SELECT o.*, mp.product_name AS main_product_name, fp.product_name AS free_product_name
                FROM offers o
                LEFT JOIN tbl_product mp ON mp.id = o.main_product_id
                LEFT JOIN tbl_product fp ON fp.id = o.free_product_id
                WHERE o.is_active = 1
                ORDER BY o.id DESC";
        $rows = $this->run($sql)->fetchAll();
        $rp = new RefProduct();
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

    private function toStorefront(array $row, RefProduct $rp): array
    {
        $mainId = $row['main_product_id'] ?? null;
        $freeId = $row['free_product_id'] ?? null;
        $otherFree = (int)($row['is_other_product_free'] ?? 0) === 1 && $freeId;

        $buyQty   = (int)($row['main_quantity'] ?? 0);
        $freeQty  = (int)($row['free_quantity'] ?? 0);
        // Every BXGY admin offer grants free units; only the free PRODUCT differs:
        // a different ("other") product, or the same main product otherwise.
        $grantsFree = $buyQty > 0 && $freeQty > 0;

        $mainProduct = $mainId ? $rp->storefrontById((string)$mainId) : null;
        $freeProduct = !$grantsFree ? null : ($otherFree ? $rp->storefrontById((string)$freeId) : $mainProduct);

        $mainName = $row['main_product_name'] ?: ($mainProduct['name'] ?? 'Product');
        $freeName = $otherFree ? ($row['free_product_name'] ?: ($freeProduct['name'] ?? $mainName)) : $mainName;
        $mainUnit = (string)($row['main_unit_type'] ?? 'unit');
        $freeUnit = (string)($row['free_unit_type'] ?? $mainUnit);
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
            'productIds'  => $mainId ? [(string)$mainId] : [],
            'config'      => [
                'banner'        => $row['banner_image_url'] ?? null,
                'buyQty'        => $buyQty,
                'freeQty'       => $freeQty,
                'mainUnit'      => $mainUnit,
                'freeUnit'      => $freeUnit,
                'freeProductId' => $otherFree ? (string)$freeId : ($mainId ? (string)$mainId : null),
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
            'active'      => (int)($row['is_active'] ?? 0),
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
        $this->run("INSERT INTO {$this->table} (" . implode(', ', $cols) . ") VALUES ($place)", $row);
        return $this->getById((int) $this->lastInsertId());
    }

    public function update(int $id, array $data): array
    {
        $row = $this->prepareRow($data);
        $row['updated_at'] = date('Y-m-d H:i:s');
        $set = implode(', ', array_map(fn ($c) => "$c = :$c", array_keys($row)));
        $row['__id'] = $id;
        $this->run("UPDATE {$this->table} SET $set WHERE id = :__id", $row);
        return $this->getById($id);
    }

    public function delete(int $id): void
    {
        $o = $this->run("SELECT banner_image FROM {$this->table} WHERE id = ?", [$id])->fetch();
        if ($o) {
            Uploads::delete($o['banner_image'] ?? null);
        }
        $this->run("DELETE FROM {$this->table} WHERE id = ?", [$id]);
    }

    /** Filter incoming data to known columns only. */
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

    /** Attach absolute banner URL + cast flags/ids for the SPA. */
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

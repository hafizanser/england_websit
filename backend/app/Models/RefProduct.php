<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\MysqlModel;
use App\Core\Uploads;

/**
 * Products in the shared order_system database (tbl_product).
 * Mirrors the field set & logic of the reference order_management app.
 */
class RefProduct extends MysqlModel
{
    protected string $table = 'tbl_product';

    public const UNIT_TYPES = ['box', 'cotton', 'packet', 'dozen', 'bundle'];

    /** Columns this dashboard writes (everything except id / timestamps). */
    private const WRITABLE = [
        'category_id', 'product_name', 'short_description', 'product_description',
        'piece_price', 'box_price', 'cotton_price', 'packet_price', 'dozen_price', 'bundle_price',
        'unit_types',
        'production_piece_price', 'production_box_price', 'production_cotton_price',
        'production_packet_price', 'production_dozen_price', 'production_bundle_price',
        'dozen_in_box', 'boxes_in_cotton', 'pieces_per_bundle', 'pieces_per_packet',
        'total_stock_cotton', 'product_image', 'multiple_images',
        'mrp_piece', 'mrp_box', 'mrp_carton', 'mrp_packet', 'mrp_dozen', 'mrp_bundle',
        'show_profit_breakdown', 'is_featured', 'is_active',
    ];

    private const JSON_COLS = ['unit_types', 'multiple_images'];

    public function all(): array
    {
        $sql = "SELECT p.*, c.name AS category_name
                FROM tbl_product p
                LEFT JOIN categories c ON c.id = p.category_id
                ORDER BY p.id DESC";
        return array_map([$this, 'decorate'], $this->run($sql)->fetchAll());
    }

    public function getById(int $id): ?array
    {
        $sql = "SELECT p.*, c.name AS category_name
                FROM tbl_product p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.id = ? LIMIT 1";
        $row = $this->run($sql, [$id])->fetch();
        return $row ? $this->decorate($row) : null;
    }

    // -----------------------------------------------------------------------
    // Storefront projection — maps the rich dashboard schema (per-unit pricing,
    // mrp, images) onto the flat product shape the public React storefront and
    // the authoritative PricingService both expect.
    // -----------------------------------------------------------------------

    /** Active products for the public catalog, filtered + sorted. */
    public function storefront(array $opts = []): array
    {
        $cat  = $opts['cat'] ?? 'all';
        $q    = trim((string)($opts['q'] ?? ''));
        $sort = $opts['sort'] ?? 'popular';

        $sql = "SELECT p.*, c.name AS category_name
                FROM tbl_product p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.is_active = 1";
        $params = [];
        if ($cat !== '' && $cat !== 'all') {
            $sql .= " AND p.category_id = ?";
            $params[] = $cat;
        }
        if ($q !== '') {
            $sql .= " AND (LOWER(p.product_name) LIKE ? OR LOWER(c.name) LIKE ?)";
            $needle = '%' . strtolower($q) . '%';
            $params[] = $needle;
            $params[] = $needle;
        }
        $sql .= " ORDER BY p.is_featured DESC, p.id DESC";

        $items = array_map(
            [self::class, 'toStorefront'],
            array_map([$this, 'decorate'], $this->run($sql, $params)->fetchAll())
        );

        // Price sorts use the unit-resolved wholesale, so sort after mapping.
        if ($sort === 'priceLow') {
            usort($items, fn ($a, $b) => $a['wholesale'] <=> $b['wholesale']);
        } elseif ($sort === 'priceHigh') {
            usort($items, fn ($a, $b) => $b['wholesale'] <=> $a['wholesale']);
        }
        return $items;
    }

    /** Featured-first active products for the "Top selling" home rail. */
    public function storefrontFeatured(int $limit = 8): array
    {
        $sql = "SELECT p.*, c.name AS category_name
                FROM tbl_product p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.is_active = 1
                ORDER BY p.is_featured DESC, p.id DESC
                LIMIT " . max(1, $limit);
        return array_map(
            [self::class, 'toStorefront'],
            array_map([$this, 'decorate'], $this->run($sql)->fetchAll())
        );
    }

    public function storefrontById($id): ?array
    {
        $row = $this->getById((int)$id);
        return $row ? self::toStorefront($row) : null;
    }

    /** Storefront items keyed by string id — used by the pricing engine. */
    public function byStorefrontIds(array $ids): array
    {
        $ids = array_values(array_filter(array_map('intval', $ids)));
        if (!$ids) {
            return [];
        }
        $place = implode(',', array_fill(0, count($ids), '?'));
        $sql = "SELECT p.*, c.name AS category_name
                FROM tbl_product p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.id IN ($place)";
        $out = [];
        foreach ($this->run($sql, $ids)->fetchAll() as $row) {
            $sf = self::toStorefront($this->decorate($row));
            $out[$sf['id']] = $sf;
        }
        return $out;
    }

    /** unit key => [wholesale price column, mrp column, display label] */
    private const UNIT_PRICE_MAP = [
        'piece'  => ['piece_price',  'mrp_piece',  'pc'],
        'box'    => ['box_price',    'mrp_box',    'box'],
        'cotton' => ['cotton_price', 'mrp_carton', 'carton'],
        'packet' => ['packet_price', 'mrp_packet', 'packet'],
        'dozen'  => ['dozen_price',  'mrp_dozen',  'dozen'],
        'bundle' => ['bundle_price', 'mrp_bundle', 'bundle'],
    ];

    /** Pick the primary sell unit (first declared unit with a real price). */
    private static function primaryPricing(array $r, array $units): array
    {
        $order = array_merge($units, array_keys(self::UNIT_PRICE_MAP));
        foreach ($order as $u) {
            $map = self::UNIT_PRICE_MAP[$u] ?? null;
            if (!$map) {
                continue;
            }
            $wholesale = (int)round((float)($r[$map[0]] ?? 0));
            if ($wholesale > 0) {
                $mrp = (int)round((float)($r[$map[1]] ?? 0));
                return [$map[2], $wholesale, $mrp > $wholesale ? $mrp : $wholesale];
            }
        }
        return ['pc', 0, 0];
    }

    private static function seedFrom(string $name): string
    {
        $slug = strtolower((string)preg_replace('/[^a-z0-9]+/i', '-', $name));
        return trim($slug, '-') ?: 'product';
    }

    /** Map a decorated dashboard row to the flat storefront product shape. */
    public static function toStorefront(array $r): array
    {
        $units = is_array($r['unit_types'] ?? null) ? $r['unit_types'] : [];
        [$unit, $wholesale, $retail] = self::primaryPricing($r, $units);
        $name = (string)($r['product_name'] ?? '');

        // Per-unit options (all enabled unit types with a real price) so the
        // storefront card can list them and price the chosen one.
        $unitLabels = ['piece' => 'Piece', 'box' => 'Box', 'cotton' => 'Carton', 'packet' => 'Packet', 'dozen' => 'Dozen', 'bundle' => 'Bundle'];
        $unitOptions = [];
        foreach ($units as $u) {
            $map = self::UNIT_PRICE_MAP[$u] ?? null;
            if (!$map) {
                continue;
            }
            $price = (int)round((float)($r[$map[0]] ?? 0));
            if ($price <= 0) {
                continue;
            }
            $mrp = (int)round((float)($r[$map[1]] ?? 0));
            $unitOptions[] = [
                'unit'   => $u,
                'label'  => $unitLabels[$u] ?? ucfirst($u),
                'price'  => $price,
                'retail' => $mrp > $price ? $mrp : $price,
            ];
        }
        if (!$unitOptions) {
            $unitOptions[] = ['unit' => $unit, 'label' => ucfirst($unit), 'price' => $wholesale, 'retail' => $retail];
        }

        // Image gallery: primary image first, then any additional uploads.
        $gallery = [];
        if (!empty($r['product_image_url'])) {
            $gallery[] = $r['product_image_url'];
        }
        foreach (($r['multiple_images_urls'] ?? []) as $u) {
            if ($u) {
                $gallery[] = $u;
            }
        }
        $gallery = array_values(array_unique($gallery));

        // Unit conversion factors saved in the dashboard, so the storefront can
        // roll smaller units up into larger ones (e.g. 10 Box = 1 Carton).
        $conversions = [
            'piecesPerBox'    => (int)round((float)($r['dozen_in_box'] ?? 0)) * 12,
            'boxesPerCarton'  => (int)round((float)($r['boxes_in_cotton'] ?? 0)),
            'piecesPerPacket' => (int)round((float)($r['pieces_per_packet'] ?? 0)),
            'piecesPerBundle' => (int)round((float)($r['pieces_per_bundle'] ?? 0)),
            'piecesPerDozen'  => 12,
        ];

        return [
            'id'          => (string)$r['id'],
            'name'        => $name,
            'sub'         => trim((string)($r['short_description'] ?? '')),
            'description' => trim((string)($r['product_description'] ?? '')),
            'category'    => (string)($r['category_name'] ?? ''),
            'category_id' => (string)($r['category_id'] ?? ''),
            'categoryId'  => (string)($r['category_id'] ?? ''),
            'image'       => $r['product_image_url'] ?? null,
            'images'      => $gallery,
            'seed'        => self::seedFrom($name),
            'unit'        => $unit,
            'units'       => $units,
            'unitOptions' => $unitOptions,
            'conversions' => $conversions,
            'wholesale'   => $wholesale,
            'retail'      => $retail,
            'rating'      => 5,
            'sold'        => '',
            'badge'       => ((int)($r['is_featured'] ?? 0)) ? 'Featured' : '',
            'stock'       => (int)round((float)($r['total_stock_cotton'] ?? 0)),
            'active'      => (int)($r['is_active'] ?? 0),
        ];
    }

    public function insert(array $data): array
    {
        $row = $this->prepareRow($data, true);
        $now = date('Y-m-d H:i:s');
        $row['created_at'] = $now;
        $row['updated_at'] = $now;
        $cols = array_keys($row);
        $place = implode(', ', array_map(fn ($c) => ':' . $c, $cols));
        $sql = "INSERT INTO {$this->table} (" . implode(', ', $cols) . ") VALUES ($place)";
        $this->run($sql, $row);
        return $this->getById((int)$this->lastInsertId());
    }

    public function update(int $id, array $data): array
    {
        $row = $this->prepareRow($data, false);
        $row['updated_at'] = date('Y-m-d H:i:s');
        $set = implode(', ', array_map(fn ($c) => "$c = :$c", array_keys($row)));
        $row['__id'] = $id;
        $this->run("UPDATE {$this->table} SET $set WHERE id = :__id", $row);
        return $this->getById($id);
    }

    public function delete(int $id): void
    {
        $product = $this->run("SELECT product_image, multiple_images FROM {$this->table} WHERE id = ?", [$id])->fetch();
        if ($product) {
            Uploads::delete($product['product_image'] ?? null);
            foreach (json_decode((string)($product['multiple_images'] ?? '[]'), true) ?: [] as $img) {
                Uploads::delete($img);
            }
        }
        $this->run("DELETE FROM {$this->table} WHERE id = ?", [$id]);
    }

    /** @return string[] filtered to the allowed unit types, original order preserved */
    public static function normalizeUnitTypes($raw): array
    {
        if (!is_array($raw)) {
            $raw = $raw === null || $raw === '' ? [] : [$raw];
        }
        return array_values(array_intersect(self::UNIT_TYPES, array_map('strval', $raw)));
    }

    /** Filter incoming data to known columns and JSON-encode array columns. */
    private function prepareRow(array $data, bool $forInsert): array
    {
        $row = [];
        foreach (self::WRITABLE as $col) {
            if (!array_key_exists($col, $data)) {
                continue;
            }
            $val = $data[$col];
            if (in_array($col, self::JSON_COLS, true)) {
                $val = json_encode(is_array($val) ? array_values($val) : []);
            }
            $row[$col] = $val;
        }

        // NOT NULL columns without a DB default — guarantee a value on insert.
        if ($forInsert) {
            foreach (['piece_price' => 0, 'cotton_price' => 0, 'box_price' => 0, 'product_name' => ''] as $col => $default) {
                if (!array_key_exists($col, $row) || $row[$col] === null) {
                    $row[$col] = $default;
                }
            }
            if (!array_key_exists('unit_types', $row)) {
                $row['unit_types'] = json_encode([]);
            }
        }
        return $row;
    }

    /** Decode JSON columns and attach absolute image URLs for the SPA. */
    private function decorate(array $row): array
    {
        $row['unit_types'] = json_decode((string)($row['unit_types'] ?? '[]'), true) ?: [];
        $gallery = json_decode((string)($row['multiple_images'] ?? '[]'), true) ?: [];
        $row['multiple_images'] = $gallery;
        $row['product_image_url'] = Uploads::url($row['product_image'] ?? null);
        $row['multiple_images_urls'] = array_map(fn ($n) => Uploads::url($n), $gallery);

        foreach (['show_profit_breakdown', 'is_featured', 'is_active'] as $b) {
            $row[$b] = (int)($row[$b] ?? 0);
        }
        return $row;
    }
}

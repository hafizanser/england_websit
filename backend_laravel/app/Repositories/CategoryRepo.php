<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\Uploads;

/** Categories in the shared order_system database. Port of Models\RefCategory. */
class CategoryRepo extends BaseRepo
{
    protected string $table = 'categories';

    public function all(): array
    {
        $sql = "SELECT c.*, (SELECT COUNT(*) FROM tbl_product p WHERE p.category_id = c.id) AS products_count
                FROM categories c
                ORDER BY c.display_order ASC, c.id ASC";
        return array_map([$this, 'decorate'], $this->select($sql));
    }

    public function getById(int $id): ?array
    {
        $row = $this->first("SELECT * FROM {$this->table} WHERE id = ? LIMIT 1", [$id]);
        return $row ? $this->decorate($row) : null;
    }

    public function storefront(): array
    {
        $sql = "SELECT c.*, (SELECT COUNT(*) FROM tbl_product p WHERE p.category_id = c.id AND p.is_active = 1) AS products_count
                FROM categories c
                WHERE c.is_active = 1
                ORDER BY c.display_order ASC, c.id ASC";
        return array_map(function ($r) {
            $d = $this->decorate($r);
            return [
                'id'    => (string) $d['id'],
                'name'  => (string) ($d['name'] ?? ''),
                'slug'  => (string) ($d['slug'] ?? ''),
                'seed'  => (string) ($d['slug'] ?? 'category'),
                'urdu'  => '',
                'image' => $d['image_url'],
                'items' => (int) ($d['products_count'] ?? 0),
            ];
        }, $this->select($sql));
    }

    public function nameExists(string $name, ?int $exceptId = null): bool
    {
        $sql = "SELECT COUNT(*) AS c FROM {$this->table} WHERE name = ?";
        $params = [$name];
        if ($exceptId !== null) {
            $sql .= " AND id != ?";
            $params[] = $exceptId;
        }
        return (int) $this->scalar($sql, $params) > 0;
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
        unset($row['slug']);
        if (isset($data['slug'])) {
            $row['slug'] = $data['slug'];
        }
        $row['updated_at'] = date('Y-m-d H:i:s');
        $set = implode(', ', array_map(fn ($c) => "$c = :$c", array_keys($row)));
        $row['__id'] = $id;
        $this->exec("UPDATE {$this->table} SET $set WHERE id = :__id", $row);
        return $this->getById($id);
    }

    public function delete(int $id): void
    {
        $cat = $this->first("SELECT image_path FROM {$this->table} WHERE id = ?", [$id]);
        if ($cat) {
            Uploads::delete($cat['image_path'] ?? null);
        }
        $this->exec("DELETE FROM {$this->table} WHERE id = ?", [$id]);
    }

    public static function slugify(string $name): string
    {
        $slug = strtolower(trim($name));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        return trim($slug, '-');
    }

    private const WRITABLE = ['name', 'slug', 'image_path', 'display_order', 'is_active'];

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
        $row['image_url'] = Uploads::url($row['image_path'] ?? null);
        $row['is_active'] = (int) ($row['is_active'] ?? 0);
        $row['display_order'] = (int) ($row['display_order'] ?? 0);
        $row['products_count'] = (int) ($row['products_count'] ?? 0);
        return $row;
    }
}

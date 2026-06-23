<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

class Product extends Model
{
    protected string $table = 'products';

    public function query(array $opts = []): array
    {
        $cat = $opts['cat'] ?? 'all';
        $q = trim((string)($opts['q'] ?? ''));
        $sort = $opts['sort'] ?? 'popular';
        $includeInactive = !empty($opts['all']);

        $sql = "SELECT * FROM products WHERE 1=1";
        $params = [];
        if (!$includeInactive) {
            $sql .= " AND active = 1";
        }
        if ($cat && $cat !== 'all') {
            $sql .= " AND category_id = ?";
            $params[] = $cat;
        }
        if ($q !== '') {
            $sql .= " AND (LOWER(name) LIKE ? OR LOWER(category) LIKE ?)";
            $needle = '%' . strtolower($q) . '%';
            $params[] = $needle;
            $params[] = $needle;
        }
        $rows = $this->run($sql, $params)->fetchAll();

        $soldNum = static function ($s): float {
            $n = (float)str_replace('k', '', (string)$s);
            return str_contains((string)$s, 'k') ? $n * 1000 : $n;
        };
        usort($rows, function ($a, $b) use ($sort, $soldNum) {
            return match ($sort) {
                'priceLow'  => $a['wholesale'] <=> $b['wholesale'],
                'priceHigh' => $b['wholesale'] <=> $a['wholesale'],
                'rating'    => $b['rating'] <=> $a['rating'],
                default     => $soldNum($b['sold']) <=> $soldNum($a['sold']),
            };
        });
        return array_map([$this, 'cast'], $rows);
    }

    public function getById(string $id): ?array
    {
        $row = $this->find('id', $id);
        return $row ? $this->cast($row) : null;
    }

    public function byIds(array $ids): array
    {
        if (!$ids) return [];
        $place = implode(',', array_fill(0, count($ids), '?'));
        $rows = $this->run("SELECT * FROM products WHERE id IN ($place)", $ids)->fetchAll();
        return array_map([$this, 'cast'], $rows);
    }

    public function topSelling(array $ids): array
    {
        $map = [];
        foreach ($this->byIds($ids) as $p) {
            $map[$p['id']] = $p;
        }
        $out = [];
        foreach ($ids as $id) {
            if (isset($map[$id])) $out[] = $map[$id];
        }
        return $out;
    }

    public function upsert(array $d): array
    {
        $id = $d['id'] ?? ('p' . substr(uniqid(), -6));
        $exists = $this->find('id', $id);
        $fields = ['name', 'sub', 'category', 'category_id', 'seed', 'retail', 'wholesale', 'unit', 'rating', 'sold', 'badge', 'stock', 'active'];
        $vals = [];
        foreach ($fields as $f) {
            $vals[$f] = $d[$f] ?? ($exists[$f] ?? self::defaultFor($f));
        }
        if ($exists) {
            $set = implode(', ', array_map(fn ($f) => "$f = ?", $fields));
            $params = array_values($vals);
            $params[] = $id;
            $this->run("UPDATE products SET $set WHERE id = ?", $params);
        } else {
            $cols = implode(', ', array_merge(['id'], $fields));
            $place = implode(', ', array_fill(0, count($fields) + 1, '?'));
            $this->run("INSERT INTO products ($cols) VALUES ($place)", array_merge([$id], array_values($vals)));
        }
        return $this->getById($id);
    }

    public function remove(string $id): void
    {
        $this->run('DELETE FROM products WHERE id = ?', [$id]);
    }

    private static function defaultFor(string $f)
    {
        return match ($f) {
            'retail', 'wholesale', 'stock' => 0,
            'rating' => 4.5,
            'active' => 1,
            'unit' => 'pc',
            'sold' => '0',
            default => '',
        };
    }

    private function cast(array $r): array
    {
        $r['retail'] = (int)$r['retail'];
        $r['wholesale'] = (int)$r['wholesale'];
        $r['stock'] = (int)$r['stock'];
        $r['rating'] = (float)$r['rating'];
        $r['active'] = (int)$r['active'];
        $r['categoryId'] = $r['category_id']; // camelCase alias for the React layer
        return $r;
    }
}

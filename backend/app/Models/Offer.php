<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

class Offer extends Model
{
    protected string $table = 'offers';

    public function list(bool $includeInactive = false): array
    {
        $sql = 'SELECT * FROM offers';
        if (!$includeInactive) {
            $sql .= ' WHERE active = 1';
        }
        $sql .= ' ORDER BY rowid ASC';
        return array_map([$this, 'cast'], $this->db->query($sql)->fetchAll());
    }

    public function bySlug(string $slug): ?array
    {
        $row = $this->find('slug', $slug);
        return $row ? $this->cast($row) : null;
    }

    public function byCode(string $code): ?array
    {
        $row = $this->run('SELECT * FROM offers WHERE UPPER(code) = ? AND active = 1 LIMIT 1', [strtoupper(trim($code))])->fetch();
        return $row ? $this->cast($row) : null;
    }

    public function featured(): array
    {
        $all = $this->list();
        $hero = null;
        $sides = [];
        foreach ($all as $o) {
            if ($o['featured'] === 'lg' && !$hero) $hero = $o;
            elseif ($o['featured'] === 'sm') $sides[] = $o;
        }
        if (!$hero && $all) $hero = $all[0];
        return ['hero' => $hero, 'sides' => array_slice($sides, 0, 2)];
    }

    public function upsert(array $d): array
    {
        $id = $d['id'] ?? ('o-' . substr(uniqid(), -6));
        $exists = $this->find('id', $id);
        $fields = ['slug', 'type', 'kicker', 'tag', 'title', 'description', 'save_label', 'code', 'seed', 'theme', 'featured', 'product_ids', 'config', 'expiry', 'terms', 'active'];
        $jsonFields = ['product_ids', 'config', 'terms'];
        $vals = [];
        foreach ($fields as $f) {
            $v = $d[$f] ?? null;
            if ($v === null && $exists) {
                $vals[$f] = $exists[$f];
            } elseif (in_array($f, $jsonFields, true)) {
                $vals[$f] = is_string($v) ? $v : json_encode($v ?? ($f === 'config' ? new \stdClass() : []));
            } else {
                $vals[$f] = $v ?? ($f === 'active' ? 1 : '');
            }
        }
        if ($exists) {
            $set = implode(', ', array_map(fn ($f) => "$f = ?", $fields));
            $this->run("UPDATE offers SET $set WHERE id = ?", array_merge(array_values($vals), [$id]));
        } else {
            $cols = implode(', ', array_merge(['id'], $fields));
            $place = implode(', ', array_fill(0, count($fields) + 1, '?'));
            $this->run("INSERT INTO offers ($cols) VALUES ($place)", array_merge([$id], array_values($vals)));
        }
        return $this->cast($this->find('id', $id));
    }

    public function remove(string $id): void
    {
        $this->run('DELETE FROM offers WHERE id = ?', [$id]);
    }

    public function cast(array $r): array
    {
        $r['productIds'] = json_decode($r['product_ids'] ?? '[]', true) ?: [];
        $r['config'] = json_decode($r['config'] ?? '{}', true) ?: [];
        $r['terms'] = json_decode($r['terms'] ?? '[]', true) ?: [];
        $r['save'] = $r['save_label'];
        $r['desc'] = $r['description'];
        $r['active'] = (int)$r['active'];
        return $r;
    }
}

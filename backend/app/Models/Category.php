<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

class Category extends Model
{
    protected string $table = 'categories';

    public function list(bool $includeInactive = false): array
    {
        $sql = 'SELECT * FROM categories';
        if (!$includeInactive) {
            $sql .= ' WHERE active = 1';
        }
        $sql .= ' ORDER BY rowid ASC';
        return array_map([$this, 'cast'], $this->db->query($sql)->fetchAll());
    }

    public function upsert(array $d): array
    {
        $id = $d['id'] ?? strtolower(preg_replace('/[^a-z0-9]+/i', '', $d['name'] ?? 'cat'));
        $exists = $this->find('id', $id);
        $fields = ['name', 'urdu', 'items', 'seed', 'tint', 'active'];
        $vals = [];
        foreach ($fields as $f) {
            $vals[$f] = $d[$f] ?? ($exists[$f] ?? ($f === 'active' ? 1 : ($f === 'items' ? 0 : '')));
        }
        if ($exists) {
            $set = implode(', ', array_map(fn ($f) => "$f = ?", $fields));
            $this->run("UPDATE categories SET $set WHERE id = ?", array_merge(array_values($vals), [$id]));
        } else {
            $cols = implode(', ', array_merge(['id'], $fields));
            $place = implode(', ', array_fill(0, count($fields) + 1, '?'));
            $this->run("INSERT INTO categories ($cols) VALUES ($place)", array_merge([$id], array_values($vals)));
        }
        return $this->cast($this->find('id', $id));
    }

    public function remove(string $id): void
    {
        $this->run('DELETE FROM categories WHERE id = ?', [$id]);
    }

    private function cast(array $r): array
    {
        $r['items'] = (int)$r['items'];
        $r['active'] = (int)$r['active'];
        return $r;
    }
}

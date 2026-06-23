<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\Uploads;

/** Blog posts (shared order_system `blogs` table, with an added excerpt column). Port of Models\Blog. */
class BlogRepo extends BaseRepo
{
    public function list(): array
    {
        return array_map([$this, 'decorate'], $this->select("SELECT * FROM blogs ORDER BY created_at DESC, id DESC"));
    }

    public function published(): array
    {
        return array_map([$this, 'decorate'], $this->select("SELECT * FROM blogs WHERE status = 'published' ORDER BY created_at DESC, id DESC"));
    }

    public function getById(int $id): ?array
    {
        $row = $this->first('SELECT * FROM blogs WHERE id = ? LIMIT 1', [$id]);
        return $row ? $this->decorate($row) : null;
    }

    public function getBySlug(string $slug): ?array
    {
        $row = $this->first('SELECT * FROM blogs WHERE slug = ? LIMIT 1', [$slug]);
        return $row ? $this->decorate($row) : null;
    }

    public function insert(array $d): array
    {
        $now = date('Y-m-d H:i:s');
        $slug = $this->uniqueSlug($d['slug'] ?? ($d['title'] ?? 'post'));
        $this->exec(
            "INSERT INTO blogs (title, slug, excerpt, content, image, author, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (string) ($d['title'] ?? ''),
                $slug,
                (string) ($d['excerpt'] ?? ''),
                (string) ($d['content'] ?? ''),
                $d['image'] ?? null,
                (string) ($d['author'] ?? 'England'),
                $this->normalizeStatus($d['status'] ?? 'published'),
                $now,
                $now,
            ]
        );
        return $this->getById($this->lastId());
    }

    public function update(int $id, array $d): array
    {
        $existing = $this->first('SELECT * FROM blogs WHERE id = ? LIMIT 1', [$id]);
        if (!$existing) {
            return [];
        }
        $slug = array_key_exists('slug', $d) && trim((string) $d['slug']) !== ''
            ? $this->uniqueSlug($d['slug'], $id)
            : $existing['slug'];

        $fields = [
            'title'   => $d['title']   ?? $existing['title'],
            'slug'    => $slug,
            'excerpt' => $d['excerpt'] ?? ($existing['excerpt'] ?? ''),
            'content' => $d['content'] ?? $existing['content'],
            'image'   => array_key_exists('image', $d) ? $d['image'] : $existing['image'],
            'author'  => $d['author']  ?? $existing['author'],
            'status'  => $this->normalizeStatus($d['status'] ?? $existing['status']),
        ];
        $set = implode(', ', array_map(fn ($f) => "$f = ?", array_keys($fields)));
        $params = array_values($fields);
        $params[] = date('Y-m-d H:i:s');
        $params[] = $id;
        $this->exec("UPDATE blogs SET $set, updated_at = ? WHERE id = ?", $params);
        return $this->getById($id);
    }

    public function remove(int $id): void
    {
        $blog = $this->first('SELECT image FROM blogs WHERE id = ? LIMIT 1', [$id]);
        if ($blog && !empty($blog['image'])) {
            Uploads::delete($blog['image']);
        }
        $this->exec('DELETE FROM blogs WHERE id = ?', [$id]);
    }

    private function normalizeStatus($v): string
    {
        return in_array($v, ['draft', 'Draft', '0', 0, false], true) ? 'draft' : 'published';
    }

    public static function slugify(string $text): string
    {
        $slug = strtolower(trim($text));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        return trim($slug, '-') ?: 'post';
    }

    private function uniqueSlug(string $base, ?int $exceptId = null): string
    {
        $slug = self::slugify($base);
        $candidate = $slug;
        $n = 2;
        while (true) {
            $row = $exceptId !== null
                ? $this->first('SELECT id FROM blogs WHERE slug = ? AND id != ? LIMIT 1', [$candidate, $exceptId])
                : $this->first('SELECT id FROM blogs WHERE slug = ? LIMIT 1', [$candidate]);
            if (!$row) {
                return $candidate;
            }
            $candidate = $slug . '-' . $n;
            $n++;
        }
    }

    private function decorate(array $r): array
    {
        $r['id'] = (int) $r['id'];
        $r['excerpt'] = $r['excerpt'] ?? '';
        $r['image_url'] = Uploads::url($r['image'] ?? null);
        return $r;
    }
}

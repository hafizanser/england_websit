<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Model;
use App\Core\Uploads;

/** Blog posts (stored in the local SQLite db). */
class Blog extends Model
{
    protected string $table = 'blogs';

    /** All posts, newest first (admin listing). */
    public function list(): array
    {
        $rows = $this->db->query("SELECT * FROM blogs ORDER BY datetime(created_at) DESC, id DESC")->fetchAll();
        return array_map([$this, 'decorate'], $rows);
    }

    /** Published posts only, newest first (public website). */
    public function published(): array
    {
        $rows = $this->run("SELECT * FROM blogs WHERE status = 'published' ORDER BY datetime(created_at) DESC, id DESC")->fetchAll();
        return array_map([$this, 'decorate'], $rows);
    }

    public function getById(int $id): ?array
    {
        $row = $this->find('id', $id);
        return $row ? $this->decorate($row) : null;
    }

    public function getBySlug(string $slug): ?array
    {
        $row = $this->find('slug', $slug);
        return $row ? $this->decorate($row) : null;
    }

    public function insert(array $d): array
    {
        $now = date('Y-m-d H:i:s');
        $slug = $this->uniqueSlug($d['slug'] ?? ($d['title'] ?? 'post'));
        $this->run(
            "INSERT INTO blogs (title, slug, excerpt, content, image, author, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (string)($d['title'] ?? ''),
                $slug,
                (string)($d['excerpt'] ?? ''),
                (string)($d['content'] ?? ''),
                $d['image'] ?? null,
                (string)($d['author'] ?? 'England'),
                $this->normalizeStatus($d['status'] ?? 'published'),
                $now,
                $now,
            ]
        );
        return $this->getById((int)$this->lastInsertId());
    }

    public function update(int $id, array $d): array
    {
        $existing = $this->find('id', $id);
        if (!$existing) {
            return [];
        }
        $slug = array_key_exists('slug', $d) && trim((string)$d['slug']) !== ''
            ? $this->uniqueSlug($d['slug'], $id)
            : $existing['slug'];

        $fields = [
            'title'   => $d['title']   ?? $existing['title'],
            'slug'    => $slug,
            'excerpt' => $d['excerpt'] ?? $existing['excerpt'],
            'content' => $d['content'] ?? $existing['content'],
            'image'   => array_key_exists('image', $d) ? $d['image'] : $existing['image'],
            'author'  => $d['author']  ?? $existing['author'],
            'status'  => $this->normalizeStatus($d['status'] ?? $existing['status']),
        ];
        $set = implode(', ', array_map(fn ($f) => "$f = ?", array_keys($fields)));
        $params = array_values($fields);
        $params[] = date('Y-m-d H:i:s'); // updated_at
        $params[] = $id;
        $this->run("UPDATE blogs SET $set, updated_at = ? WHERE id = ?", $params);
        return $this->getById($id);
    }

    public function remove(int $id): void
    {
        $blog = $this->find('id', $id);
        if ($blog && !empty($blog['image'])) {
            Uploads::delete($blog['image']);
        }
        $this->run('DELETE FROM blogs WHERE id = ?', [$id]);
    }

    // ---- helpers -----------------------------------------------------------

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

    /** Ensure a unique slug (append -2, -3, … on collision). */
    private function uniqueSlug(string $base, ?int $exceptId = null): string
    {
        $slug = self::slugify($base);
        $candidate = $slug;
        $n = 2;
        while (true) {
            $row = $exceptId !== null
                ? $this->run('SELECT id FROM blogs WHERE slug = ? AND id != ? LIMIT 1', [$candidate, $exceptId])->fetch()
                : $this->run('SELECT id FROM blogs WHERE slug = ? LIMIT 1', [$candidate])->fetch();
            if (!$row) {
                return $candidate;
            }
            $candidate = $slug . '-' . $n;
            $n++;
        }
    }

    private function decorate(array $r): array
    {
        $r['id'] = (int)$r['id'];
        $r['image_url'] = Uploads::url($r['image'] ?? null);
        return $r;
    }
}

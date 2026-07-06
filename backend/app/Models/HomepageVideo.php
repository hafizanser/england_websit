<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Model;
use App\Core\VideoStorage;

/**
 * Homepage "See the products in action" reels (local SQLite). The table is
 * self-creating + self-seeding on first use, so no separate migration step is
 * needed for the legacy backend. Seed rows mirror the reels shipped in
 * /public/videos so the existing carousel keeps working with no re-add.
 */
class HomepageVideo extends Model
{
    protected string $table = 'homepage_videos';

    public function __construct()
    {
        parent::__construct();
        $this->ensureSchema();
    }

    private function ensureSchema(): void
    {
        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS homepage_videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                source_type TEXT NOT NULL DEFAULT 'upload',
                video_file TEXT,
                poster_file TEXT,
                drive_url TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            )"
        );

        $count = (int)$this->db->query('SELECT COUNT(*) FROM homepage_videos')->fetchColumn();
        if ($count === 0) {
            // Mirrors VideoReviews.jsx REEL_NUMS — the exact on-screen order.
            $reelNums = [1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
            $now = date('Y-m-d H:i:s');
            $pos = 1;
            foreach ($reelNums as $n) {
                $nn = str_pad((string)$n, 2, '0', STR_PAD_LEFT);
                $this->run(
                    "INSERT INTO homepage_videos
                        (title, position, source_type, video_file, poster_file, drive_url, is_active, created_at, updated_at)
                     VALUES (NULL, ?, 'upload', ?, ?, NULL, 1, ?, ?)",
                    [$pos, "/videos/dvreel-{$nn}.mp4", "/videos/dvreel-{$nn}.jpg", $now, $now]
                );
                $pos++;
            }
        }
    }

    public function all(string $orderBy = 'position ASC, id ASC'): array
    {
        $rows = $this->db->query("SELECT * FROM homepage_videos ORDER BY {$orderBy}")->fetchAll();
        return array_map([$this, 'decorate'], $rows);
    }

    public function active(): array
    {
        $rows = $this->run('SELECT * FROM homepage_videos WHERE is_active = 1 ORDER BY position ASC, id ASC')->fetchAll();
        return array_map([$this, 'decorate'], $rows);
    }

    public function getById(int $id): ?array
    {
        $row = $this->find('id', $id);
        return $row ? $this->decorate($row) : null;
    }

    public function insert(array $d): array
    {
        $now = date('Y-m-d H:i:s');
        $position = array_key_exists('position', $d) && $d['position'] !== null
            ? (int)$d['position']
            : $this->nextPosition();
        $this->run(
            "INSERT INTO homepage_videos
                (title, position, source_type, video_file, poster_file, drive_url, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                self::nullableStr($d['title'] ?? null),
                $position,
                (string)($d['source_type'] ?? 'upload'),
                self::nullableStr($d['video_file'] ?? null),
                self::nullableStr($d['poster_file'] ?? null),
                self::nullableStr($d['drive_url'] ?? null),
                array_key_exists('is_active', $d) ? (int)(bool)$d['is_active'] : 1,
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
        $fields = [
            'title'       => array_key_exists('title', $d) ? self::nullableStr($d['title']) : ($existing['title'] ?? null),
            'position'    => array_key_exists('position', $d) && $d['position'] !== null ? (int)$d['position'] : (int)$existing['position'],
            'source_type' => $d['source_type'] ?? $existing['source_type'],
            'video_file'  => array_key_exists('video_file', $d) ? self::nullableStr($d['video_file']) : ($existing['video_file'] ?? null),
            'poster_file' => array_key_exists('poster_file', $d) ? self::nullableStr($d['poster_file']) : ($existing['poster_file'] ?? null),
            'drive_url'   => array_key_exists('drive_url', $d) ? self::nullableStr($d['drive_url']) : ($existing['drive_url'] ?? null),
            'is_active'   => array_key_exists('is_active', $d) ? (int)(bool)$d['is_active'] : (int)$existing['is_active'],
        ];
        $set = implode(', ', array_map(fn ($f) => "$f = ?", array_keys($fields)));
        $params = array_values($fields);
        $params[] = date('Y-m-d H:i:s'); // updated_at
        $params[] = $id;
        $this->run("UPDATE homepage_videos SET $set, updated_at = ? WHERE id = ?", $params);
        return $this->getById($id);
    }

    public function remove(int $id): void
    {
        $row = $this->find('id', $id);
        if ($row) {
            VideoStorage::delete($row['video_file'] ?? null);
            VideoStorage::delete($row['poster_file'] ?? null);
        }
        $this->run('DELETE FROM homepage_videos WHERE id = ?', [$id]);
    }

    /** Reassign positions from an ordered list of ids (1-based). */
    public function reorder(array $orderedIds): array
    {
        $pos = 1;
        $now = date('Y-m-d H:i:s');
        foreach ($orderedIds as $id) {
            $id = (int)$id;
            if ($id <= 0) {
                continue;
            }
            $this->run('UPDATE homepage_videos SET position = ?, updated_at = ? WHERE id = ?', [$pos, $now, $id]);
            $pos++;
        }
        return $this->all();
    }

    private function nextPosition(): int
    {
        $max = $this->run('SELECT MAX(position) FROM homepage_videos')->fetchColumn();
        return (int)$max + 1;
    }

    private static function nullableStr($v): ?string
    {
        if ($v === null) {
            return null;
        }
        $v = trim((string)$v);
        return $v === '' ? null : $v;
    }

    private function decorate(array $r): array
    {
        $r['id']         = (int)$r['id'];
        $r['position']   = (int)$r['position'];
        $r['is_active']  = (int)$r['is_active'];
        $r['title']      = $r['title'] ?? '';
        $r['video_url']  = VideoStorage::url($r['video_file'] ?? null);
        $r['poster_url'] = VideoStorage::url($r['poster_file'] ?? null);
        return $r;
    }
}

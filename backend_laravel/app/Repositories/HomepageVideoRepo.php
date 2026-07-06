<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Support\VideoStorage;

/** Homepage reel videos — CRUD + reordering for the "products in action" carousel. */
class HomepageVideoRepo extends BaseRepo
{
    /** All videos (admin view), in card order. */
    public function all(): array
    {
        return array_map(
            [$this, 'decorate'],
            $this->select('SELECT * FROM homepage_videos ORDER BY position ASC, id ASC')
        );
    }

    /** Active videos only (public homepage), in card order. */
    public function active(): array
    {
        return array_map(
            [$this, 'decorate'],
            $this->select('SELECT * FROM homepage_videos WHERE is_active = 1 ORDER BY position ASC, id ASC')
        );
    }

    public function getById(int $id): ?array
    {
        $row = $this->first('SELECT * FROM homepage_videos WHERE id = ? LIMIT 1', [$id]);
        return $row ? $this->decorate($row) : null;
    }

    public function insert(array $d): array
    {
        $now = date('Y-m-d H:i:s');
        $position = array_key_exists('position', $d) && $d['position'] !== null
            ? (int) $d['position']
            : $this->nextPosition();
        $this->exec(
            'INSERT INTO homepage_videos
                (title, position, source_type, video_file, poster_file, drive_url, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                self::nullableStr($d['title'] ?? null),
                $position,
                (string) ($d['source_type'] ?? 'upload'),
                self::nullableStr($d['video_file'] ?? null),
                self::nullableStr($d['poster_file'] ?? null),
                self::nullableStr($d['drive_url'] ?? null),
                array_key_exists('is_active', $d) ? (int) (bool) $d['is_active'] : 1,
                $now,
                $now,
            ]
        );
        return $this->getById($this->lastId());
    }

    public function update(int $id, array $d): array
    {
        $existing = $this->first('SELECT * FROM homepage_videos WHERE id = ? LIMIT 1', [$id]);
        if (!$existing) {
            return [];
        }
        $fields = [
            'title'       => array_key_exists('title', $d) ? self::nullableStr($d['title']) : ($existing['title'] ?? null),
            'position'    => array_key_exists('position', $d) && $d['position'] !== null ? (int) $d['position'] : (int) $existing['position'],
            'source_type' => $d['source_type'] ?? $existing['source_type'],
            'video_file'  => array_key_exists('video_file', $d) ? self::nullableStr($d['video_file']) : ($existing['video_file'] ?? null),
            'poster_file' => array_key_exists('poster_file', $d) ? self::nullableStr($d['poster_file']) : ($existing['poster_file'] ?? null),
            'drive_url'   => array_key_exists('drive_url', $d) ? self::nullableStr($d['drive_url']) : ($existing['drive_url'] ?? null),
            'is_active'   => array_key_exists('is_active', $d) ? (int) (bool) $d['is_active'] : (int) $existing['is_active'],
        ];
        $set = implode(', ', array_map(fn ($f) => "$f = ?", array_keys($fields)));
        $params = array_values($fields);
        $params[] = date('Y-m-d H:i:s');
        $params[] = $id;
        $this->exec("UPDATE homepage_videos SET $set, updated_at = ? WHERE id = ?", $params);
        return $this->getById($id);
    }

    public function remove(int $id): void
    {
        $row = $this->first('SELECT video_file, poster_file FROM homepage_videos WHERE id = ? LIMIT 1', [$id]);
        if ($row) {
            VideoStorage::delete($row['video_file'] ?? null);
            VideoStorage::delete($row['poster_file'] ?? null);
        }
        $this->exec('DELETE FROM homepage_videos WHERE id = ?', [$id]);
    }

    /** Reassign positions from an ordered list of ids (1-based). Unknown ids are ignored. */
    public function reorder(array $orderedIds): array
    {
        $pos = 1;
        foreach ($orderedIds as $id) {
            $id = (int) $id;
            if ($id <= 0) {
                continue;
            }
            $this->exec(
                'UPDATE homepage_videos SET position = ?, updated_at = ? WHERE id = ?',
                [$pos, date('Y-m-d H:i:s'), $id]
            );
            $pos++;
        }
        return $this->all();
    }

    private function nextPosition(): int
    {
        $max = $this->scalar('SELECT MAX(position) FROM homepage_videos');
        return (int) $max + 1;
    }

    private static function nullableStr($v): ?string
    {
        if ($v === null) {
            return null;
        }
        $v = trim((string) $v);
        return $v === '' ? null : $v;
    }

    private function decorate(array $r): array
    {
        $r['id']         = (int) $r['id'];
        $r['position']   = (int) $r['position'];
        $r['is_active']  = (int) $r['is_active'];
        $r['title']      = $r['title'] ?? '';
        $r['video_url']  = VideoStorage::url($r['video_file'] ?? null);
        $r['poster_url'] = VideoStorage::url($r['poster_file'] ?? null);
        return $r;
    }
}

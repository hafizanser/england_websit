<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\MysqlModel;
use App\Core\PdfStorage;

class PdfDocument extends MysqlModel
{
    protected string $table = 'pdf_documents';

    /**
     * @return array<int, array{
     *     id: int,
     *     title: string,
     *     file_path: ?string,
     *     file_url: ?string,
     *     position: int,
     *     created_at: string,
     *     updated_at: string
     * }>
     */
    public function all(): array
    {
        $rows = $this->select('SELECT * FROM pdf_documents ORDER BY position ASC, id ASC');
        return array_map([$this, 'decorate'], $rows);
    }

    public function getById(int $id): ?array
    {
        $row = $this->first('SELECT * FROM pdf_documents WHERE id = ? LIMIT 1', [$id]);
        return $row ? $this->decorate($row) : null;
    }

    public function insert(array $d): array
    {
        $now = date('Y-m-d H:i:s');
        $position = array_key_exists('position', $d) && $d['position'] !== null
            ? (int)$d['position']
            : $this->nextPosition();
        $this->exec(
            'INSERT INTO pdf_documents
                (title, file_path, position, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)',
            [
                self::nullableStr($d['title'] ?? ''),
                self::nullableStr($d['file_path'] ?? null),
                $position,
                $now,
                $now,
            ]
        );
        return $this->getById($this->lastId());
    }

    public function update(int $id, array $d): array
    {
        $existing = $this->first('SELECT * FROM pdf_documents WHERE id = ? LIMIT 1', [$id]);
        if (!$existing) {
            return [];
        }
        $fields = [
            'title'       => array_key_exists('title', $d) ? self::nullableStr($d['title']) : ($existing['title'] ?? ''),
            'file_path'   => array_key_exists('file_path', $d) ? self::nullableStr($d['file_path']) : ($existing['file_path'] ?? null),
            'position'    => array_key_exists('position', $d) && $d['position'] !== null ? (int)$d['position'] : (int)$existing['position'],
        ];
        $set = implode(', ', array_map(fn ($f) => "$f = ?", array_keys($fields)));
        $params = array_values($fields);
        $params[] = date('Y-m-d H:i:s');
        $params[] = $id;
        $this->exec("UPDATE pdf_documents SET $set, updated_at = ? WHERE id = ?", $params);
        return $this->getById($id);
    }

    public function remove(int $id): void
    {
        $row = $this->first('SELECT file_path FROM pdf_documents WHERE id = ? LIMIT 1', [$id]);
        if ($row) {
            PdfStorage::delete($row['file_path'] ?? null);
        }
        $this->exec('DELETE FROM pdf_documents WHERE id = ?', [$id]);
    }

    private function nextPosition(): int
    {
        $max = $this->scalar('SELECT MAX(position) FROM pdf_documents');
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
        $r['file_url']   = PdfStorage::url($r['file_path'] ?? null);
        return $r;
    }
}

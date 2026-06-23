<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

/** Lightweight base model with shared query helpers. */
abstract class Model
{
    protected PDO $db;
    protected string $table = '';

    public function __construct()
    {
        $this->db = Database::pdo();
    }

    protected function run(string $sql, array $params = []): \PDOStatement
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public function all(string $orderBy = 'rowid ASC'): array
    {
        return $this->db->query("SELECT * FROM {$this->table} ORDER BY {$orderBy}")->fetchAll();
    }

    public function find(string $column, $value): ?array
    {
        $row = $this->run("SELECT * FROM {$this->table} WHERE {$column} = ? LIMIT 1", [$value])->fetch();
        return $row ?: null;
    }

    public function lastInsertId(): string
    {
        return $this->db->lastInsertId();
    }
}

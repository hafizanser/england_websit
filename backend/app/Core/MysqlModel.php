<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

/** Base model for tables living in the shared MySQL reference database. */
abstract class MysqlModel
{
    protected PDO $db;
    protected string $table = '';

    public function __construct()
    {
        $this->db = MysqlDatabase::pdo();
    }

    protected function run(string $sql, array $params = []): \PDOStatement
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public function lastInsertId(): string
    {
        return $this->db->lastInsertId();
    }
}

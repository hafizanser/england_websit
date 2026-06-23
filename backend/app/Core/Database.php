<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

/** SQLite connection singleton + first-run migrate/seed. */
class Database
{
    private static ?PDO $pdo = null;

    public static function connect(string $path): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $fresh = !is_file($path) || filesize($path) === 0;
        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $pdo = new PDO('sqlite:' . $path);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');

        self::$pdo = $pdo;

        if ($fresh) {
            self::migrate($pdo);
            \App\Database\Seeder::run($pdo);
        } else {
            self::migrate($pdo); // idempotent (IF NOT EXISTS)
        }

        return $pdo;
    }

    public static function pdo(): PDO
    {
        if (!self::$pdo) {
            throw new \RuntimeException('Database not connected');
        }
        return self::$pdo;
    }

    private static function migrate(PDO $pdo): void
    {
        $schema = file_get_contents(__DIR__ . '/../../database/schema.sql');
        if ($schema !== false && trim($schema) !== '') {
            $pdo->exec($schema);
        }
        self::ensureColumns($pdo);
    }

    /** Idempotent column additions for databases created before a column existed. */
    private static function ensureColumns(PDO $pdo): void
    {
        $columns = $pdo->query('PRAGMA table_info(orders)')->fetchAll(PDO::FETCH_COLUMN, 1);
        if (!in_array('source', $columns, true)) {
            $pdo->exec("ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT 'website'");
        }

        // Customer accounts: password + auth token (added for customer login).
        $custCols = $pdo->query('PRAGMA table_info(customers)')->fetchAll(PDO::FETCH_COLUMN, 1);
        if (!in_array('password_hash', $custCols, true)) {
            $pdo->exec('ALTER TABLE customers ADD COLUMN password_hash TEXT');
        }
        if (!in_array('token', $custCols, true)) {
            $pdo->exec('ALTER TABLE customers ADD COLUMN token TEXT');
        }
    }
}

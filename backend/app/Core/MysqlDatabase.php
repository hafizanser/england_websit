<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

/**
 * Lazy MySQL connection singleton for the shared reference catalogue
 * (order_system). Only the admin product / category / customer / profit
 * modules touch this; everything else stays on SQLite.
 */
class MysqlDatabase
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $cfg = $GLOBALS['__config']['mysql'] ?? [];
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $cfg['host'] ?? '127.0.0.1',
            $cfg['port'] ?? '3306',
            $cfg['database'] ?? 'order_system'
        );

        $pdo = new PDO($dsn, $cfg['username'] ?? 'root', $cfg['password'] ?? '', [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);

        self::$pdo = $pdo;
        return $pdo;
    }
}

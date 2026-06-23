<?php
declare(strict_types=1);

namespace App\Core;

/** Tiny JSON response helper with CORS headers. */
class Response
{
    public static function cors(string $origin = '*'): void
    {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Max-Age: 86400');
    }

    public static function json($data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $message, int $status = 400, array $extra = []): void
    {
        self::json(array_merge(['ok' => false, 'error' => $message], $extra), $status);
    }

    public static function ok($data = [], int $status = 200): void
    {
        if (is_array($data) && !isset($data['ok'])) {
            $data = array_merge(['ok' => true], $data);
        }
        self::json($data, $status);
    }
}

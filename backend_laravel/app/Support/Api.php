<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;

/**
 * JSON response helper reproducing the legacy backend's response envelope:
 *   success → {"ok": true, ...payload}
 *   error   → {"ok": false, "error": "...", ...extra}
 * Uses the same JSON flags (unescaped unicode + slashes) so Urdu text and URLs
 * serialize identically to the old PHP backend.
 */
class Api
{
    public const FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    public static function json(mixed $data, int $status = 200): JsonResponse
    {
        return new JsonResponse($data, $status, [], self::FLAGS);
    }

    public static function ok(array $data = [], int $status = 200): JsonResponse
    {
        if (!array_key_exists('ok', $data)) {
            $data = array_merge(['ok' => true], $data);
        }
        return self::json($data, $status);
    }

    public static function fail(string $message, int $status = 400, array $extra = []): JsonResponse
    {
        return self::json(array_merge(['ok' => false, 'error' => $message], $extra), $status);
    }

    /** Immediately stop the request with an error envelope (mirrors Response::error + exit). */
    public static function halt(string $message, int $status = 400, array $extra = []): never
    {
        throw new HttpResponseException(self::fail($message, $status, $extra));
    }
}

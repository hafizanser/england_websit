<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;

/**
 * Response envelope of the England Orders staff app API (/app/*), the same shape
 * the Masoom app API uses:
 *
 *   success → {"error": false, "message": "...", "code": 200, "data": {...}}
 *   failure → {"error": true,  "message": "...", "code": 4xx, "data": {"reason": "...", ...}}
 *
 * `code` always equals the HTTP status. `data.reason` is a stable machine key the app
 * branches on (the English `message` is for logs and API readers; the app shows Urdu).
 * `data` is always an object, never null. The website's own {ok:...} envelope (Api)
 * is untouched.
 */
class AppApi
{
    public static function ok(string $message, array $data = [], int $code = 200): JsonResponse
    {
        return new JsonResponse(
            ['error' => false, 'message' => $message, 'code' => $code, 'data' => (object) $data],
            $code,
            [],
            Api::FLAGS
        );
    }

    public static function fail(string $message, int $code, string $reason, array $data = []): JsonResponse
    {
        return new JsonResponse(
            ['error' => true, 'message' => $message, 'code' => $code, 'data' => ['reason' => $reason] + $data],
            $code,
            [],
            Api::FLAGS
        );
    }

    public static function halt(string $message, int $code, string $reason, array $data = []): never
    {
        throw new HttpResponseException(self::fail($message, $code, $reason, $data));
    }

    /** Validation failure: one message per field under data.fields. */
    public static function invalid(array $fields, string $message = 'Please check the highlighted fields.'): never
    {
        self::halt($message, 422, 'validation_failed', ['fields' => $fields]);
    }
}

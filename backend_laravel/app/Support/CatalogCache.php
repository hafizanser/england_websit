<?php

declare(strict_types=1);

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Server-side cache for the PUBLIC catalogue reads (products, categories,
 * offers, blogs, reels, review summaries).
 *
 * Everything is stored under a shared VERSION token:
 *
 *     catalog:v<token>:<key>
 *
 * so a single `bump()` retires the whole catalogue at once instead of forcing
 * every write path to know which of a dozen derived keys it just invalidated.
 * `BumpCatalogVersion` calls it after any successful admin write, checkout, or
 * review submission — the three things that can change what a shopper sees.
 *
 * The same token is folded into the ETag of every cached response (see
 * `CacheHeaders`) and echoed as `X-Catalog-Version`, so a bump simultaneously:
 *   • misses the server cache,
 *   • changes the ETag, so a browser's conditional GET gets 200 + new bytes
 *     instead of a 304,
 *   • tells the SPA's own cache to drop what it is holding.
 * One write, three layers invalidated, no manual cache clearing anywhere.
 *
 * TTLs stay short (minutes). The version token is the real freshness mechanism;
 * the TTL only bounds how long a stale entry can survive a bump that never
 * happened (e.g. a row edited straight in phpMyAdmin), and it is what lets the
 * version-keyed orphans left behind by a bump expire out of the file store on
 * their own.
 */
class CatalogCache
{
    /** Where the current version token lives. Deliberately NOT version-scoped. */
    private const VERSION_KEY = 'catalog:version';

    /** Per-request memo so one request reads the token from the store once. */
    private static ?string $version = null;

    /** Current catalogue version token — stable until something writes. */
    public static function version(): string
    {
        if (self::$version !== null) {
            return self::$version;
        }

        try {
            $token = Cache::get(self::VERSION_KEY);
            if (!is_string($token) || $token === '') {
                $token = self::freshToken();
                Cache::forever(self::VERSION_KEY, $token);
            }
        } catch (\Throwable) {
            // An unwritable cache dir must never take the API down — fall back to
            // a per-request token, which simply means "cache nothing this time".
            $token = self::freshToken();
        }

        return self::$version = $token;
    }

    /**
     * Retire every cached catalogue entry + every ETag derived from them.
     * Safe to call more than once per request; the extra writes are harmless.
     */
    public static function bump(): void
    {
        try {
            $token = self::freshToken();
            Cache::forever(self::VERSION_KEY, $token);
            self::$version = $token;
        } catch (\Throwable) {
            self::$version = null;
        }
    }

    /**
     * Cache a public catalogue read under the current version.
     *
     * `$ttl` is in seconds. A cache backend that is down or read-only degrades to
     * calling `$fn` every time rather than erroring — a slow storefront beats a
     * broken one.
     */
    public static function remember(string $key, int $ttl, Closure $fn): mixed
    {
        $full = 'catalog:v' . self::version() . ':' . $key;

        try {
            return Cache::remember($full, $ttl, $fn);
        } catch (\Throwable) {
            return $fn();
        }
    }

    private static function freshToken(): string
    {
        return substr(bin2hex(random_bytes(8)), 0, 12);
    }
}

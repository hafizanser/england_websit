<?php

// CORS origins are env-driven: dev defaults to `*`, production locks to the
// storefront domain(s) via CORS_ALLOWED_ORIGINS (comma-separated) in .env.
$origins = array_values(array_filter(array_map('trim', explode(
    ',',
    (string) env('CORS_ALLOWED_ORIGINS', '')
))));

// Fail CLOSED in production: if no origins are configured we must NOT fall back
// to the `*` wildcard (that would expose the admin API to any site). Locally we
// keep `*` so the Vite dev server and file previews work without setup.
$fallback = env('APP_ENV') === 'production' ? [] : ['*'];

return [
    'paths' => ['*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $origins ?: $fallback,
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    // The storefront runs on a different origin to the API, so a cross-origin
    // response hides every header that is not on this list. `X-Catalog-Version`
    // is how the SPA's own cache learns that an admin saved something and drops
    // what it is holding (src/lib/queryCache.js); ETag is exposed alongside it
    // for diagnosis. Neither is sensitive.
    'exposed_headers' => ['ETag', 'X-Catalog-Version'],
    'max_age' => 86400,
    'supports_credentials' => false,
];

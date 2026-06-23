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
    'exposed_headers' => [],
    'max_age' => 86400,
    'supports_credentials' => false,
];

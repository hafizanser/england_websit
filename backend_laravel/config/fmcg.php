<?php

// Central configuration for the Barkat / FMCG backend (ported from the legacy
// PHP backend's config/config.php).
return [
    // Default admin account, seeded on first run; change after deploy.
    'admin' => [
        'username' => env('FMCG_ADMIN_USERNAME', 'admin'),
        'password' => env('FMCG_ADMIN_PASSWORD', 'admin123'),
    ],

    // Allowed order statuses (storefront/admin order lifecycle).
    'order_statuses' => ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'],

    // 4-digit PIN protecting the Profit Breakdown pages.
    'profit_pin' => env('FMCG_PROFIT_PIN', '2244'),

    // Product / category / offer / blog images live in the order_management
    // public/uploads folder, served by Apache. New uploads from this dashboard
    // are written there too so both projects stay in sync. They are streamed
    // back through this backend's GET /image route.
    'uploads_path' => env('FMCG_UPLOADS_PATH') ?: base_path('uploads'),

    // Homepage video reels (uploaded or re-hosted from Google Drive). These are
    // NOT web-served directly — they stream back through this backend's
    // GET /video route (with HTTP range support) so playback matches the
    // self-hosted <video> behaviour on the homepage. Kept separate from the
    // image uploads folder so a stray .mp4 never lands in an Apache-served dir.
    'videos_path' => env('FMCG_VIDEOS_PATH', base_path('uploads/videos')),

    // PDF documents storage, streamed through GET /pdf route.
    'pdfs_path' => env('FMCG_PDFS_PATH', base_path('uploads/pdfs')),

    // ffmpeg / ffprobe binaries used to optimise/compress uploaded (or
    // Drive-fetched) reels. Defaults to the PATH lookup; set an absolute path if
    // they aren't on PATH. If ffmpeg is unavailable the original file is stored
    // as-is (no compression) so the feature still works.
    'ffmpeg_path'  => env('FMCG_FFMPEG_PATH', 'ffmpeg'),
    'ffprobe_path' => env('FMCG_FFPROBE_PATH', 'ffprobe'),
];

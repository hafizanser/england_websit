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
    'uploads_path' => env('FMCG_UPLOADS_PATH', 'D:/xamp/htdocs/order_management/public/uploads'),
];

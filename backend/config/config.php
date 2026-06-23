<?php
// Central configuration for the Barkat backend.
return [
    'db_path'   => __DIR__ . '/../database/data.sqlite',
    'cors'      => '*', // dev-friendly; lock to your domain in production
    'admin'     => [
        'username' => 'admin',
        'password' => 'admin123', // seeded on first run; change after deploy
    ],
    'order_statuses' => ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'],

    // ---- Reference catalogue database (shared with the order_management app) ----
    // Admin product / category / customer modules read & write these MySQL tables.
    'mysql' => [
        'host'     => '127.0.0.1',
        'port'     => '3306',
        'database' => 'order_system',
        'username' => 'root',
        'password' => '',
    ],

    // Product / category images live in the order_management public/uploads folder,
    // served by Apache. New uploads from this dashboard are written there too so
    // both projects stay in sync.
    'uploads_path' => 'D:/xamp/htdocs/order_management/public/uploads',
    'uploads_url'  => 'http://localhost/order_management/public/uploads',

    // 4-digit PIN protecting the Profit Breakdown page.
    'profit_pin'   => '2244',
];

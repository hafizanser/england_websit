<?php
/**
 * Front controller — single entry point for the JSON API.
 * Works both under Apache (.htaccess rewrite) and `php -S`.
 */
declare(strict_types=1);

error_reporting(E_ALL & ~E_WARNING & ~E_DEPRECATED);

// --- PSR-4-ish autoloader for the App\ namespace -> app/ ---------------------
spl_autoload_register(function (string $class): void {
    $prefix = 'App\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = __DIR__ . '/../app/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

use App\Core\App;

$config = require __DIR__ . '/../config/config.php';

(new App($config))->run();

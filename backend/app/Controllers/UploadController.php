<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Uploads;

/** Streams product / category images from the shared uploads folder (public). */
class UploadController extends Controller
{
    private const MIME = [
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
        'gif' => 'image/gif', 'webp' => 'image/webp', 'svg' => 'image/svg+xml', 'bmp' => 'image/bmp',
    ];

    public function show(array $p = []): void
    {
        $name = basename(rawurldecode((string)($this->request->query['file'] ?? '')));
        $path = Uploads::dir() . '/' . $name;

        if ($name === '' || !is_file($path)) {
            http_response_code(404);
            header('Content-Type: text/plain');
            echo 'Image not found';
            exit;
        }

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        http_response_code(200);
        header('Content-Type: ' . (self::MIME[$ext] ?? 'application/octet-stream'));
        header('Content-Length: ' . (string)filesize($path));
        header('Cache-Control: public, max-age=86400');
        readfile($path);
        exit;
    }
}

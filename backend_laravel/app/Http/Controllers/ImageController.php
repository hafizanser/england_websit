<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Uploads;
use Illuminate\Http\Request;

/** Streams product / category / offer / blog images from the shared uploads folder (public). */
class ImageController extends Controller
{
    private const MIME = [
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
        'gif' => 'image/gif', 'webp' => 'image/webp', 'svg' => 'image/svg+xml', 'bmp' => 'image/bmp',
    ];

    public function show(Request $request)
    {
        $name = basename(rawurldecode((string) $request->query('file', '')));
        $path = Uploads::dir() . '/' . $name;

        if ($name === '' || !is_file($path)) {
            return response('Image not found', 404)->header('Content-Type', 'text/plain');
        }

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));

        return response()->file($path, [
            'Content-Type'  => self::MIME[$ext] ?? 'application/octet-stream',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}

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

        // Stored filenames are content-immutable: App\Support\Uploads::save()
        // stamps every upload with `time()_<random>`, so replacing a product photo
        // produces a NEW filename and therefore a NEW URL in the catalogue JSON.
        // A given /image?file=X can never change, which is exactly the condition
        // `immutable` asks for — the browser may keep it for a year and skip even
        // the conditional request. (The old max-age=86400 made every shopper
        // re-validate all ~60 catalogue photos once a day for nothing.)
        $response = response()->file($path, [
            'Content-Type'  => self::MIME[$ext] ?? 'application/octet-stream',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);

        // Last-Modified + a 304 for If-Modified-Since covers the caches that
        // ignore `immutable` and the shopper who hard-refreshes.
        $response->setAutoLastModified();
        $response->isNotModified($request);

        return $response;
    }
}

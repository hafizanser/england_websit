<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\HomepageVideoRepo;
use App\Support\Api;
use App\Support\CatalogCache;
use App\Support\VideoStorage;
use Illuminate\Http\Request;

/**
 * Public homepage reels: the ordered list the front-end carousel renders, plus
 * the range-aware file streamer that serves uploaded/re-hosted clips (and their
 * posters) so playback matches the self-hosted <video> behaviour.
 */
class HomepageVideoController extends Controller
{
    public function index()
    {
        // The reel ORDER, not the clips themselves. Tiny payload, but it gates the
        // homepage carousel, so serving it from cache pulls the reels forward.
        $data = CatalogCache::remember('homepage-videos', 900, fn () => (new HomepageVideoRepo())->active());

        return Api::ok(['data' => $data]);
    }

    /** GET /video?file=NAME — streams a stored reel/poster with HTTP range support. */
    public function stream(Request $request)
    {
        $name = basename(rawurldecode((string) $request->query('file', '')));
        $path = VideoStorage::dir() . '/' . $name;

        if ($name === '' || !is_file($path)) {
            return response('Video not found', 404)->header('Content-Type', 'text/plain');
        }

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));

        // Symfony's BinaryFileResponse (returned by response()->file) sets
        // Accept-Ranges: bytes and honours the Range header during prepare(), so
        // seeking / partial fetches work out of the box for the <video> element.
        //
        // Reels are stored as `time()_<random>.mp4` (VideoStorage::save), so a
        // re-uploaded clip lands on a new filename and a given URL is immutable —
        // safe to cache for a year. These are the heaviest bytes on the site, so
        // this is the single biggest repeat-visit win.
        //
        // No isNotModified() here on purpose: a conditional check against a Range
        // request is where video seeking goes wrong, and `immutable` means the
        // browser will not send one anyway.
        $response = response()->file($path, [
            'Content-Type'  => VideoStorage::MIME[$ext] ?? 'application/octet-stream',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
        $response->setAutoLastModified();

        return $response;
    }
}

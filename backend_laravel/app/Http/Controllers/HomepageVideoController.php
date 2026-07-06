<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\HomepageVideoRepo;
use App\Support\Api;
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
        return Api::ok(['data' => (new HomepageVideoRepo())->active()]);
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
        return response()->file($path, [
            'Content-Type'  => VideoStorage::MIME[$ext] ?? 'application/octet-stream',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}

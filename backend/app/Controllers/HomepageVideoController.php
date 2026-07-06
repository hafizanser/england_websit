<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Response;
use App\Core\VideoStorage;
use App\Models\HomepageVideo;

/**
 * Public homepage reels: the ordered list the front-end carousel renders, plus a
 * range-aware file streamer that serves uploaded/re-hosted clips (and their
 * posters) so playback matches the self-hosted <video> behaviour.
 */
class HomepageVideoController extends Controller
{
    public function index(array $p = []): void
    {
        Response::ok(['data' => (new HomepageVideo())->active()]);
    }

    /** GET /video?file=NAME — streams a stored reel/poster with HTTP range support. */
    public function stream(array $p = []): void
    {
        $name = basename(rawurldecode((string)($this->request->query['file'] ?? '')));
        $path = VideoStorage::dir() . '/' . $name;

        if ($name === '' || !is_file($path)) {
            http_response_code(404);
            header('Content-Type: text/plain');
            echo 'Video not found';
            exit;
        }

        $ext  = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $mime = VideoStorage::MIME[$ext] ?? 'application/octet-stream';
        $size = (int)filesize($path);
        $start = 0;
        $end = $size - 1;

        header('Content-Type: ' . $mime);
        header('Accept-Ranges: bytes');
        header('Cache-Control: public, max-age=86400');

        $range = (string)($_SERVER['HTTP_RANGE'] ?? '');
        if ($range !== '' && preg_match('/bytes=(\d*)-(\d*)/', $range, $m)) {
            if ($m[1] !== '') {
                $start = (int)$m[1];
            }
            if ($m[2] !== '') {
                $end = (int)$m[2];
            }
            if ($start > $end || $start >= $size) {
                http_response_code(416);
                header("Content-Range: bytes */$size");
                exit;
            }
            http_response_code(206);
            header("Content-Range: bytes $start-$end/$size");
        } else {
            http_response_code(200);
        }

        $length = $end - $start + 1;
        header('Content-Length: ' . $length);

        // Stream the requested byte range in chunks so large reels don't buffer
        // entirely into memory.
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        $fp = fopen($path, 'rb');
        if ($fp === false) {
            exit;
        }
        fseek($fp, $start);
        $remaining = $length;
        while ($remaining > 0 && !feof($fp)) {
            $chunk = fread($fp, (int)min(8192, $remaining));
            if ($chunk === false) {
                break;
            }
            echo $chunk;
            $remaining -= strlen($chunk);
            flush();
        }
        fclose($fp);
        exit;
    }
}

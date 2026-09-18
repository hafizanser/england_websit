<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\UploadedFile;

/**
 * A product video uploaded in pieces, each piece its own short request.
 *
 * WHY A VIDEO IS NOT SENT IN ONE REQUEST
 * ---------------------------------------------------------------------------
 * Measured against the live host (Bluehost, Apache) in September 2026:
 *
 *   1. The host ends ANY request that has been open for ~300 seconds, and
 *      answers with Apache's own HTML "503 Service Unavailable". Upload time
 *      counts: a request whose body is still arriving at 300 s is cut off
 *      before PHP has run a single line, so no php.ini value can move it.
 *   2. Browsers talk HTTP/2 to this host, and its Apache gives every request
 *      stream a 64 KB flow-control window. Only 64 KB can be in flight per
 *      round trip, so from Pakistan (~275 ms away) one request uploads at about
 *      135 KB/s however fast the connection is.
 *
 * Together: a 64 MB clip in one request needs ~8 minutes and was always cut off
 * at 5 — reproduced without logging in, 42.7 MB in, 503, Laravel never saw it.
 *
 * In pieces, every request is small enough to finish in well under a minute.
 * And because the window is per stream, several pieces go up at once: four
 * streams on one connection measured 4.3x the throughput of one.
 *
 * LAYOUT  storage/app/video-uploads/<id>/
 *   meta.json   what the browser announced: name, size, piece size, count
 *   data        the file itself — each piece is written straight to its own
 *               offset, so nothing has to be stitched together at the end
 *   <n>.ok      piece n has been written in full
 *
 * The product save then names the upload (`product_video_upload=<id>`), and
 * finish() hands the assembled file to VideoStorage like any other upload.
 */
final class ChunkedUpload
{
    /** The largest clip accepted — a product preview, not a film. */
    public const MAX_BYTES = 256 * 1024 * 1024;

    /** Piece size asked for, when PHP's own limits allow it. */
    private const PIECE_BYTES = 4 * 1024 * 1024;

    /** Headroom under upload_max_filesize / post_max_size for the multipart framing. */
    private const FRAMING_BYTES = 64 * 1024;

    /** An upload nobody finished is swept after a day. */
    private const STALE_AFTER = 86400;

    /**
     * Open an upload. Everything is checked here, before a byte of the file is
     * sent — a wrong type or an oversized clip is refused in a second, not after
     * minutes of uploading.
     *
     * @return array{id:string, chunk_bytes:int, chunks:int}
     */
    public static function start(string $name, int $size): array
    {
        $name = self::cleanName($name);
        $ext  = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!in_array($ext, VideoStorage::VIDEO_EXT, true)) {
            Api::halt('Sirf video files allowed hain (mp4, webm, mov, m4v, ogg).', 422);
        }
        if ($size <= 0) {
            Api::halt('Video file khali hai.', 422);
        }
        if ($size > self::MAX_BYTES) {
            Api::halt(
                'Video ' . intdiv(self::MAX_BYTES, 1024 * 1024) . ' MB se bari nahi ho sakti — '
                . 'chhoti ya kam lambi clip use karein.',
                413
            );
        }

        self::sweep();

        $id  = bin2hex(random_bytes(16));
        $dir = self::dir($id);
        if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
            Api::halt('Server video ke liye folder nahi bana saka (storage writable nahi).', 500);
        }

        $piece = self::pieceBytes();
        $meta  = [
            'name'    => $name,
            'size'    => $size,
            'piece'   => $piece,
            'count'   => (int) ceil($size / $piece),
            'created' => time(),
        ];
        if (@file_put_contents("{$dir}/meta.json", json_encode($meta)) === false || !@touch("{$dir}/data")) {
            self::discard($id);
            Api::halt('Server video ke liye jagah nahi bana saka (storage writable nahi).', 500);
        }

        return ['id' => $id, 'chunk_bytes' => $piece, 'chunks' => $meta['count']];
    }

    /**
     * Write piece $index of upload $id. Pieces arrive in any order and several
     * at once; each one only ever touches its own byte range of `data`. Sending
     * the same piece twice (a retry) writes the same bytes again — harmless.
     */
    public static function put(string $id, int $index, UploadedFile $piece): void
    {
        $meta = self::meta($id);
        if ($index < 0 || $index >= $meta['count']) {
            Api::halt('Video ka yeh hissa is upload ka nahi hai.', 422);
        }

        $offset   = $index * $meta['piece'];
        $expected = min($meta['piece'], $meta['size'] - $offset);
        if ($piece->getSize() !== $expected) {
            // 409, not 422: the browser retries this one — a piece cut short on
            // the way is sent again whole.
            Api::halt('Video ka hissa adhoora pohncha.', 409);
        }

        $dir = self::dir($id);
        $in  = @fopen($piece->getRealPath(), 'rb');
        // 'c': create if missing, NEVER truncate — other pieces are being written
        // into this same file at the same moment by other requests.
        $out = @fopen("{$dir}/data", 'c+b');
        $ok  = false;
        if ($in && $out) {
            $ok = fseek($out, $offset) === 0
                && stream_copy_to_stream($in, $out) === $expected
                && fflush($out);
        }
        if ($in) {
            fclose($in);
        }
        if ($out) {
            fclose($out);
        }
        if (!$ok || !@touch("{$dir}/{$index}.ok")) {
            Api::halt('Server video ka hissa save nahi kar saka (disk full ya storage writable nahi).', 500);
        }
    }

    /**
     * The finished file, ready for VideoStorage::storeProductUpload(). Refuses an
     * upload with any piece missing — a clip with a hole in it would store fine
     * and then fail to play, which is worse than an error now.
     *
     * The caller discards the upload afterwards, whatever happened.
     */
    public static function finish(string $id): UploadedFile
    {
        $meta = self::meta($id);
        $dir  = self::dir($id);
        clearstatcache();
        for ($i = 0; $i < $meta['count']; $i++) {
            if (!is_file("{$dir}/{$i}.ok")) {
                Api::halt('Video poori upload nahi hui — dobara Save karein.', 422);
            }
        }
        if (@filesize("{$dir}/data") !== $meta['size']) {
            Api::halt('Video poori upload nahi hui — dobara Save karein.', 422);
        }

        // "Test mode" only means move() renames the file rather than insisting
        // it came through PHP's own upload handling — which it did, piece by
        // piece, in the requests before this one.
        return new UploadedFile("{$dir}/data", $meta['name'], null, null, true);
    }

    /** Drop an upload and everything it wrote. Unknown ids are ignored. */
    public static function discard(string $id): void
    {
        if (!self::validId($id)) {
            return;
        }
        $dir = self::dir($id);
        foreach (glob("{$dir}/*") ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($dir);
    }

    /**
     * The piece size: 4 MB — at ~135 KB/s per stream that is ~30 s a request,
     * comfortably inside the host's 300 s — unless PHP's limits are smaller.
     */
    public static function pieceBytes(): int
    {
        $limit = (int) min(UploadedFile::getMaxFilesize(), PHP_INT_MAX) - self::FRAMING_BYTES;

        return max(256 * 1024, min(self::PIECE_BYTES, $limit));
    }

    /** @return array{name:string,size:int,piece:int,count:int,created:int} */
    private static function meta(string $id): array
    {
        if (!self::validId($id)) {
            Api::halt('Video upload nahi mila — dobara Save karein.', 404);
        }
        $raw  = @file_get_contents(self::dir($id) . '/meta.json');
        $meta = $raw === false ? null : json_decode($raw, true);
        if (!is_array($meta) || !isset($meta['name'], $meta['size'], $meta['piece'], $meta['count'])) {
            Api::halt('Video upload nahi mila ya purana ho gaya — dobara Save karein.', 404);
        }

        return $meta;
    }

    /** Remove uploads that were started and never finished. */
    private static function sweep(): void
    {
        $cutoff = time() - self::STALE_AFTER;
        foreach (glob(self::root() . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
            $stamp = @filemtime("{$dir}/meta.json") ?: @filemtime($dir);
            if ($stamp !== false && $stamp < $cutoff) {
                self::discard(basename($dir));
            }
        }
    }

    private static function root(): string
    {
        return rtrim(str_replace('\\', '/', storage_path('app/video-uploads')), '/');
    }

    private static function dir(string $id): string
    {
        return self::root() . '/' . $id;
    }

    private static function validId(string $id): bool
    {
        return (bool) preg_match('/^[a-f0-9]{32}$/', $id);
    }

    /** Only the name's extension is ever used — keep it short and harmless. */
    private static function cleanName(string $name): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $name = preg_replace('/[^A-Za-z0-9._-]+/', '_', $name) ?? '';

        return substr($name, -120) ?: 'video';
    }
}

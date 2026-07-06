<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Stores homepage reel videos for the legacy backend (native PHP — no Composer).
 * Uploaded files (and files re-hosted from Google Drive) are optimised/compressed
 * with ffmpeg to web H.264 + a poster JPG, then streamed back through GET /video
 * (range-aware) so they play byte-for-byte like the existing self-hosted reels.
 * If ffmpeg is unavailable the original file is kept as-is so the feature works.
 */
class VideoStorage
{
    private const VIDEO_EXT = ['mp4', 'webm', 'mov', 'm4v', 'ogg', 'ogv'];

    public const MIME = [
        'mp4'  => 'video/mp4',
        'm4v'  => 'video/mp4',
        'webm' => 'video/webm',
        'ogv'  => 'video/ogg',
        'ogg'  => 'video/ogg',
        'mov'  => 'video/quicktime',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'webp' => 'image/webp',
    ];

    public static function dir(): string
    {
        return rtrim(str_replace('\\', '/', (string)($GLOBALS['__config']['videos_path'] ?? '')), '/');
    }

    public static function baseUrl(): string
    {
        return rtrim((string)($GLOBALS['__config']['videos_url'] ?? ''), '/');
    }

    /**
     * Public URL for a stored video/poster value. Passthrough for absolute URLs
     * (Drive fallback) and site-relative paths (legacy /videos/... reels); bare
     * stored filenames resolve to this backend's GET /video route.
     */
    public static function url(?string $name): ?string
    {
        $name = trim((string)$name);
        if ($name === '') {
            return null;
        }
        if (preg_match('#^https?://#i', $name)) {
            return $name;      // absolute (Drive direct-stream fallback)
        }
        if (str_starts_with($name, '/')) {
            return $name;      // site-relative (SPA-hosted legacy reel)
        }
        return self::baseUrl() . '?file=' . rawurlencode($name);
    }

    private static function ensureDir(): string
    {
        $dir = self::dir();
        if ($dir === '') {
            throw new \RuntimeException('Videos path not configured');
        }
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        return $dir;
    }

    /**
     * Persist an uploaded reel ($_FILES entry). Returns
     * ['video_file' => ..., 'poster_file' => ...] with stored filenames.
     */
    public static function saveUpload(array $file): array
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'] ?? '')) {
            throw new \RuntimeException('Video upload failed');
        }
        $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION) ?: 'mp4');
        if (!in_array($ext, self::VIDEO_EXT, true)) {
            throw new \RuntimeException('Sirf video files allowed hain (mp4, webm, mov, m4v, ogg).');
        }
        $dir = self::ensureDir();
        $tmp = $dir . '/tmp_' . bin2hex(random_bytes(6)) . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $tmp)) {
            throw new \RuntimeException('Could not store uploaded video');
        }
        try {
            return self::optimiseInto($tmp);
        } finally {
            @unlink($tmp);
        }
    }

    /**
     * Download a publicly-shared Google Drive video, then optimise & store it —
     * so it plays identically to an upload. Returns the same shape as saveUpload,
     * or null if the download failed (caller falls back to a direct Drive URL).
     */
    public static function saveFromDrive(string $driveUrl): ?array
    {
        $id = self::driveId($driveUrl);
        if ($id === null) {
            return null;
        }
        $dir = self::ensureDir();
        $tmp = $dir . '/tmp_' . bin2hex(random_bytes(6)) . '.bin';
        if (!self::downloadDrive($id, $tmp)) {
            @unlink($tmp);
            return null;
        }
        try {
            return self::optimiseInto($tmp);
        } catch (\Throwable $e) {
            return null;
        } finally {
            @unlink($tmp);
        }
    }

    /** Direct-stream URL for a Drive file (fallback when re-hosting fails). */
    public static function driveDirectUrl(string $driveUrl): ?string
    {
        $id = self::driveId($driveUrl);
        return $id ? "https://drive.usercontent.google.com/download?id={$id}&export=download&confirm=t" : null;
    }

    /** Extract the file id from the common Drive share URL shapes. */
    public static function driveId(string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }
        if (preg_match('#/file/d/([a-zA-Z0-9_-]+)#', $url, $m)) {
            return $m[1];
        }
        if (preg_match('#[?&](?:id|ids)=([a-zA-Z0-9_-]+)#', $url, $m)) {
            return $m[1];
        }
        if (preg_match('#/d/([a-zA-Z0-9_-]+)#', $url, $m)) {
            return $m[1];
        }
        if (preg_match('#^[a-zA-Z0-9_-]{20,}$#', $url)) {
            return $url; // a bare id was pasted
        }
        return null;
    }

    /** Best-effort download of a public Drive file to $dest (native cURL). */
    private static function downloadDrive(string $id, string $dest): bool
    {
        $candidates = [
            "https://drive.usercontent.google.com/download?id={$id}&export=download&confirm=t",
            "https://drive.google.com/uc?export=download&id={$id}&confirm=t",
        ];
        foreach ($candidates as $url) {
            $fh = @fopen($dest, 'wb');
            if (!$fh) {
                return false;
            }
            $ok = false;
            if (function_exists('curl_init')) {
                $ch = curl_init($url);
                curl_setopt_array($ch, [
                    CURLOPT_FILE           => $fh,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_TIMEOUT        => 180,
                    CURLOPT_USERAGENT      => 'Mozilla/5.0',
                    CURLOPT_SSL_VERIFYPEER => false,
                ]);
                $ok = curl_exec($ch) !== false;
                curl_close($ch);
            } else {
                $ctx = stream_context_create(['http' => ['header' => "User-Agent: Mozilla/5.0\r\n", 'timeout' => 180]]);
                $data = @file_get_contents($url, false, $ctx);
                if ($data !== false) {
                    fwrite($fh, $data);
                    $ok = true;
                }
            }
            fclose($fh);

            if (!$ok || !is_file($dest) || filesize($dest) < 1024) {
                continue;
            }
            // Google returns an HTML "can't scan for viruses" interstitial for big
            // files — detect it and treat as a failed attempt.
            $head = (string)@file_get_contents($dest, false, null, 0, 512);
            if (stripos($head, '<!DOCTYPE html') !== false || stripos($head, '<html') !== false) {
                continue;
            }
            return true;
        }
        return false;
    }

    /**
     * Optimise $srcPath into the videos dir + generate a poster. Falls back to
     * copying the original bytes when ffmpeg is unavailable or fails.
     */
    private static function optimiseInto(string $srcPath): array
    {
        $dir = self::ensureDir();
        $stamp = time() . '_' . bin2hex(random_bytes(4));
        $outVideo = $dir . '/' . $stamp . '.mp4';
        $outPoster = $dir . '/' . $stamp . '.jpg';

        $ffmpeg = (string)($GLOBALS['__config']['ffmpeg_path'] ?? 'ffmpeg');
        $ok = self::runFfmpeg([
            $ffmpeg, '-y', '-i', $srcPath,
            '-vf', "scale='min(1280,iw)':-2",
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
            '-profile:v', 'high', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            '-c:a', 'aac', '-b:a', '128k',
            $outVideo,
        ]);

        if (!$ok || !is_file($outVideo) || filesize($outVideo) < 1024) {
            // ffmpeg missing/failed → keep the original bytes as the stored file.
            @copy($srcPath, $outVideo);
        }

        // Poster from an early frame of the stored clip (best-effort).
        self::runFfmpeg([
            $ffmpeg, '-y', '-ss', '0.5', '-i', $outVideo,
            '-vframes', '1', '-vf', "scale='min(1280,iw)':-2", $outPoster,
        ]);

        return [
            'video_file'  => basename($outVideo),
            'poster_file' => is_file($outPoster) ? basename($outPoster) : null,
        ];
    }

    private static function runFfmpeg(array $args): bool
    {
        $cmd = implode(' ', array_map('escapeshellarg', $args)) . ' 2>&1';
        $out = [];
        $code = 1;
        @exec($cmd, $out, $code);
        return $code === 0;
    }

    /** Delete stored files (best-effort). Passthrough URLs/site paths are left alone. */
    public static function delete(?string $name): void
    {
        $name = trim((string)$name);
        if ($name === '' || preg_match('#^https?://#i', $name) || str_starts_with($name, '/')) {
            return;
        }
        $path = self::dir() . '/' . basename($name);
        if (is_file($path)) {
            @unlink($path);
        }
    }
}

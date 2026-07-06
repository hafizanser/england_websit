<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

/**
 * Stores homepage reel videos. Uploaded files (and files re-hosted from Google
 * Drive) are optimised/compressed with ffmpeg to web H.264 720p + a poster JPG,
 * then streamed back through GET /video (range-aware) so they play byte-for-byte
 * like the existing self-hosted reels. If ffmpeg is unavailable the original file
 * is kept as-is so the feature still works.
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
        return rtrim(str_replace('\\', '/', (string) config('fmcg.videos_path', '')), '/');
    }

    public static function baseUrl(): string
    {
        return rtrim(url('/video'), '/');
    }

    /**
     * Public URL for a stored video/poster value. Passthrough for absolute URLs
     * (Drive fallback) and site-relative paths (legacy /videos/... reels); bare
     * stored filenames resolve to this backend's GET /video route.
     */
    public static function url(?string $name): ?string
    {
        $name = trim((string) $name);
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
     * Persist an uploaded reel. Returns ['video_file' => ..., 'poster_file' => ...]
     * with stored filenames (relative to the videos dir).
     */
    public static function saveUpload(UploadedFile $file): array
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: 'mp4');
        if (!in_array($ext, self::VIDEO_EXT, true)) {
            throw new \RuntimeException('Sirf video files allowed hain (mp4, webm, mov, m4v, ogg).');
        }
        $dir = self::ensureDir();
        $tmp = $dir . '/tmp_' . bin2hex(random_bytes(6)) . '.' . $ext;
        $file->move($dir, basename($tmp));

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
        // A bare id was pasted.
        if (preg_match('#^[a-zA-Z0-9_-]{20,}$#', $url)) {
            return $url;
        }
        return null;
    }

    /** Best-effort download of a public Drive file to $dest. */
    private static function downloadDrive(string $id, string $dest): bool
    {
        $candidates = [
            "https://drive.usercontent.google.com/download?id={$id}&export=download&confirm=t",
            "https://drive.google.com/uc?export=download&id={$id}&confirm=t",
        ];
        foreach ($candidates as $url) {
            try {
                $res = Http::withOptions(['sink' => $dest, 'timeout' => 180])
                    ->withHeaders(['User-Agent' => 'Mozilla/5.0'])
                    ->get($url);
            } catch (\Throwable $e) {
                continue;
            }
            if (!$res->successful() || !is_file($dest) || filesize($dest) < 1024) {
                continue;
            }
            // Google returns an HTML "can't scan for viruses" interstitial for big
            // files — detect it and treat as a failed attempt.
            $head = (string) @file_get_contents($dest, false, null, 0, 512);
            if (stripos($head, '<!DOCTYPE html') !== false || stripos($head, '<html') !== false) {
                continue;
            }
            return true;
        }
        return false;
    }

    /**
     * Optimise $srcPath into the videos dir + generate a poster. Falls back to
     * copying the original (transcoded to .mp4 container name kept as source) when
     * ffmpeg is not available or fails.
     */
    private static function optimiseInto(string $srcPath): array
    {
        $dir = self::ensureDir();
        $stamp = time() . '_' . bin2hex(random_bytes(4));
        $outVideo = $dir . '/' . $stamp . '.mp4';
        $outPoster = $dir . '/' . $stamp . '.jpg';

        $ffmpeg = (string) config('fmcg.ffmpeg_path', 'ffmpeg');
        $ok = self::runFfmpeg([
            $ffmpeg, '-y', '-i', $srcPath,
            // scale to max 720 height, keep even width, good-quality H.264:
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
            self::runFfmpeg([
                $ffmpeg, '-y', '-ss', '0.5', '-i', $outVideo,
                '-vframes', '1', '-vf', "scale='min(1280,iw)':-2", $outPoster,
            ]);
            return [
                'video_file'  => basename($outVideo),
                'poster_file' => is_file($outPoster) ? basename($outPoster) : null,
            ];
        }

        // Poster from an early frame of the optimised clip.
        self::runFfmpeg([
            $ffmpeg, '-y', '-ss', '0.5', '-i', $outVideo,
            '-vframes', '1', '-vf', "scale='min(1280,iw)':-2", $outPoster,
        ]);

        return [
            'video_file'  => basename($outVideo),
            'poster_file' => is_file($outPoster) ? basename($outPoster) : null,
        ];
    }

    private static function runFfmpeg(array $cmd): bool
    {
        try {
            $proc = new Process($cmd);
            $proc->setTimeout(600);
            $proc->run();
            return $proc->isSuccessful();
        } catch (ProcessFailedException|\Throwable $e) {
            return false;
        }
    }

    /** Delete stored files (best-effort). Passthrough URLs/site paths are left alone. */
    public static function delete(?string $name): void
    {
        $name = trim((string) $name);
        if ($name === '' || preg_match('#^https?://#i', $name) || str_starts_with($name, '/')) {
            return;
        }
        $path = self::dir() . '/' . basename($name);
        if (is_file($path)) {
            @unlink($path);
        }
    }
}

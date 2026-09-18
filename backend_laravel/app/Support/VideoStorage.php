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

    // =======================================================================
    // Product videos: stored FAST, finished in the background.
    // =======================================================================
    //
    // saveUpload() above transcodes INSIDE the HTTP request. That is tolerable
    // for a short homepage reel and fatal for a phone clip: on shared cPanel
    // hosting PHP runs behind FastCGI, and a request that produces no output
    // for roughly 40-60 seconds is killed by the web server and reported to the
    // browser as 503 — no matter how high max_execution_time is set. That is
    // precisely the error product-video saves were failing with. A large iPhone
    // HEVC clip takes minutes to transcode on a shared CPU allowance.
    //
    // So a product upload does only cheap, BOUNDED work in the request — a
    // move, an ffprobe, at most a stream-copy remux and one poster frame, each
    // capped at QUICK_TIMEOUT, far below any FastCGI limit — and anything heavier
    // is handed to a detached process that outlives the request:
    //
    //   already web-ready   H.264 (4:2:0, <=1920px) with AAC or no audio, in an
    //                       MP4 box. This is exactly what the admin panel's
    //                       in-browser compressor produces, so the common case
    //                       stores the file as-is: no transcode, nothing to
    //                       time out, and the audio is never touched.
    //   same, in a .MOV     remuxed to MP4 by stream copy — I/O bound, seconds.
    //                       Firefox cannot play QuickTime; every browser plays
    //                       the MP4.
    //   anything else       HEVC, ProRes, 4K, PCM audio... stored as
    //                       <stem>_src.<ext> and served as-is IMMEDIATELY, while
    //                       a background ffmpeg writes <stem>.mp4.
    //                       resolveProduct() switches to it the moment it
    //                       exists — no database write, no queue, no cron.

    private const PRODUCT_SRC = '/^(.+)_src\.[A-Za-z0-9]+$/';

    // Seconds any synchronous ffmpeg/ffprobe call may take inside a request.
    private const QUICK_TIMEOUT = 20;

    /**
     * Store a product clip without transcoding it in the request.
     *
     * @return array{video_file:string, poster_file:?string, pending:bool}
     *   `pending` is true when a background transcode was started and the
     *   stored file is the original, pending replacement.
     */
    public static function storeProductUpload(UploadedFile $file): array
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: 'mp4');
        if (!in_array($ext, self::VIDEO_EXT, true)) {
            throw new \RuntimeException('Sirf video files allowed hain (mp4, webm, mov, m4v, ogg).');
        }

        $dir  = self::ensureDir();
        $stem = time() . '_' . bin2hex(random_bytes(4));
        $src  = "{$stem}_src.{$ext}";
        $file->move($dir, $src);
        $srcPath = "{$dir}/{$src}";

        $info  = self::probe($srcPath);
        $final = null;

        if ($info !== null && self::isWebReady($info)) {
            if ($ext === 'mp4' || $ext === 'm4v') {
                if (@rename($srcPath, "{$dir}/{$stem}.mp4")) {
                    $final = "{$stem}.mp4";
                }
            } elseif (self::remuxToMp4($srcPath, "{$dir}/{$stem}.mp4")) {
                @unlink($srcPath);
                $final = "{$stem}.mp4";
            }
        } elseif ($info === null && $ext === 'mp4') {
            // No ffprobe on this host, so the codecs cannot be checked. An .mp4 is
            // overwhelmingly H.264/AAC — and always is when it came through the
            // admin panel's compressor — so it is stored as a finished file.
            if (@rename($srcPath, "{$dir}/{$stem}.mp4")) {
                $final = "{$stem}.mp4";
            }
        }

        $video  = $final ?? $src;
        $poster = self::grabPoster("{$dir}/{$video}", "{$dir}/{$stem}.jpg") ? "{$stem}.jpg" : null;

        $pending = false;
        if ($final === null) {
            $pending = self::ffmpegWorks() && self::startBackgroundTranscode($srcPath, $dir, $stem, $info);

            // No job is coming — no ffmpeg on this host, proc_open disabled, no
            // shell. Then the original IS the final file, and its name must say
            // so: a "_src" name is a promise that an MP4 is on the way, and the
            // dashboard would report "processing" for a clip nobody is
            // processing, forever.
            if (!$pending && @rename($srcPath, "{$dir}/{$stem}.{$ext}")) {
                $video = "{$stem}.{$ext}";
            }
        }

        return ['video_file' => $video, 'poster_file' => $poster, 'pending' => $pending];
    }

    /**
     * The file that should actually be served for a stored product video name:
     * the background transcode's MP4 once it exists, else the name as stored.
     */
    public static function resolveProduct(?string $name): ?string
    {
        $name = basename(trim((string) $name));
        if ($name === '') {
            return null;
        }
        if (preg_match(self::PRODUCT_SRC, $name, $m) && is_file(self::dir() . "/{$m[1]}.mp4")) {
            return "{$m[1]}.mp4";
        }
        return $name;
    }

    /** True while a stored product clip is still the original awaiting its MP4. */
    public static function isPendingProduct(?string $name): bool
    {
        $name = basename(trim((string) $name));
        return preg_match(self::PRODUCT_SRC, $name, $m) === 1
            && !is_file(self::dir() . "/{$m[1]}.mp4");
    }

    /** True for a transitional original (`<stem>_src.<ext>`). */
    public static function isProductSource(string $name): bool
    {
        return preg_match(self::PRODUCT_SRC, basename($name)) === 1;
    }

    /** Streams, codecs and sizes via ffprobe — or null if it is unavailable. */
    private static function probe(string $path): ?array
    {
        $ffprobe = (string) config('fmcg.ffprobe_path', 'ffprobe');
        try {
            $p = new Process([$ffprobe, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', $path]);
            $p->setTimeout(self::QUICK_TIMEOUT);
            $p->run();
            if (!$p->isSuccessful()) {
                return null;
            }
            $data = json_decode($p->getOutput(), true);
            return is_array($data) && !empty($data['streams']) ? $data : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** H.264 4:2:0 at <=1920px, with AAC audio or none: plays in every browser. */
    private static function isWebReady(array $info): bool
    {
        $video = null;
        foreach ($info['streams'] ?? [] as $s) {
            $type = $s['codec_type'] ?? '';
            // Cover art is carried as a one-frame "video" stream; it is not the clip.
            if ($type === 'video' && $video === null && empty($s['disposition']['attached_pic'])) {
                $video = $s;
            }
            if ($type === 'audio' && ($s['codec_name'] ?? '') !== 'aac') {
                return false;
            }
        }
        if (!$video || ($video['codec_name'] ?? '') !== 'h264') {
            return false;
        }
        if (!in_array($video['pix_fmt'] ?? '', ['yuv420p', 'yuvj420p'], true)) {
            return false;
        }
        return max((int) ($video['width'] ?? 0), (int) ($video['height'] ?? 0)) <= 1920;
    }

    private static function allAudioIs(?array $info, string $codec): bool
    {
        if ($info === null) {
            return false;
        }
        foreach ($info['streams'] ?? [] as $s) {
            if (($s['codec_type'] ?? '') === 'audio' && ($s['codec_name'] ?? '') !== $codec) {
                return false;
            }
        }
        return true;
    }

    /** QuickTime -> MP4 by stream copy: no re-encode, audio bytes untouched. */
    private static function remuxToMp4(string $src, string $out): bool
    {
        $ok = self::runQuick([
            self::ffmpeg(), '-nostdin', '-y', '-i', $src,
            '-map', '0:v:0', '-map', '0:a?', '-c', 'copy', '-movflags', '+faststart', $out,
        ]);
        if ($ok && is_file($out) && filesize($out) > 1024) {
            return true;
        }
        @unlink($out);
        return false;
    }

    /** One frame, upright (ffmpeg applies the rotation matrix), <=720px wide. */
    private static function grabPoster(string $video, string $poster): bool
    {
        foreach (['0.5', '0'] as $at) {
            $ok = self::runQuick([
                self::ffmpeg(), '-nostdin', '-y', '-ss', $at, '-i', $video,
                '-frames:v', '1', '-vf', "scale='min(720,iw)':-2", $poster,
            ]);
            if ($ok && is_file($poster) && filesize($poster) > 0) {
                return true;
            }
        }
        @unlink($poster);
        return false;
    }

    /**
     * Start the full transcode in a process DETACHED from this request, so the
     * web server's timeout no longer applies to it. Pure shell — no PHP CLI
     * binary, queue worker or cron job is needed on the host.
     *
     * The job publishes <stem>.mp4 only if the uploaded original still exists
     * when it finishes: if the admin replaced or removed the clip meanwhile, the
     * result is discarded rather than left behind as an orphan.
     */
    private static function startBackgroundTranscode(string $srcPath, string $dir, string $stem, ?array $info): bool
    {
        $q = static fn (string $s): string => "'" . str_replace("'", "'\\''", $s) . "'";

        $ffmpeg = $q(self::ffmpeg());
        // The source's AAC is copied, not re-encoded — the same rule the browser
        // follows. Anything else (PCM, Opus...) becomes AAC.
        $audio = self::allAudioIs($info, 'aac') ? '-c:a copy' : '-c:a aac -b:a 128k';
        // Long edge capped at 1280 with even dimensions. ffmpeg has already
        // applied any rotation matrix by this point, so iw/ih are the upright
        // picture.
        $vf = $q("scale='if(gte(iw,ih),min(1280,iw),-2)':'if(gte(iw,ih),-2,min(1280,ih))'");
        $posterVf = $q("scale='min(720,iw)':-2");
        $job = "{$dir}/{$stem}.job.sh";

        // The body is ONE brace group, so the shell parses the whole script into
        // memory before it runs any of it. A shell otherwise reads a script a
        // line at a time as it goes, and if the file disappears mid-run it
        // silently stops at whatever it had read — which on Windows skipped the
        // cleanup and left a cancel marker behind for ever.
        $script = implode("\n", [
            '#!/bin/sh',
            '# Written by App\\Support\\VideoStorage::startBackgroundTranscode. Deletes itself.',
            '{',
            'src=' . $q($srcPath),
            'part=' . $q("{$dir}/{$stem}.part.mp4"),
            'out=' . $q("{$dir}/{$stem}.mp4"),
            'poster=' . $q("{$dir}/{$stem}.jpg"),
            'cancel=' . $q("{$dir}/{$stem}.cancel"),
            // Lowest priority: this shares the account's CPU allowance with the
            // live site, and a shopper's page load matters more than this.
            'NICE=""; command -v nice >/dev/null 2>&1 && NICE="nice -n 15"',
            '$NICE ' . $ffmpeg . ' -nostdin -y -i "$src" -map 0:v:0 -map "0:a?" -vf ' . $vf
                . ' -c:v libx264 -preset veryfast -crf 26 -profile:v high -pix_fmt yuv420p -threads 2 '
                . $audio . ' -movflags +faststart "$part" </dev/null',
            'status=$?',
            // Publish only if nobody cancelled this clip (see delete()) while the
            // encode ran — and look again AFTER the move, because a cancel can
            // land in between and the result must not outlive it.
            'if [ "$status" -eq 0 ] && [ -f "$src" ] && [ ! -f "$cancel" ] && [ -s "$part" ]; then',
            '  mv -f "$part" "$out"',
            '  if [ -f "$cancel" ]; then',
            '    rm -f "$out"',
            '  else',
            '    [ -f "$poster" ] || ' . $ffmpeg . ' -nostdin -y -ss 0.5 -i "$out" -frames:v 1 -vf ' . $posterVf . ' "$poster" </dev/null',
            '    rm -f "$src"',
            '  fi',
            'fi',
            // A cancelled clip's original may have been undeletable while ffmpeg
            // held it open (Windows); it is closed now.
            '[ -f "$cancel" ] && rm -f "$src"',
            'rm -f "$part" "$cancel" "$0"',
            '}',
        ]) . "\n";

        if (@file_put_contents($job, $script) === false) {
            return false;
        }

        // setsid (Linux) gives the job its own session, so nothing the web server
        // does to this request's process group can reach it; nohup covers hosts
        // without it. All three standard streams go to /dev/null, which is what
        // lets this launcher return immediately instead of waiting on the child.
        $launch = 'if command -v setsid >/dev/null 2>&1; then '
            . 'setsid nohup sh "$1" </dev/null >/dev/null 2>&1 & '
            . 'else nohup sh "$1" </dev/null >/dev/null 2>&1 & fi';

        try {
            $p = new Process(['sh', '-c', $launch, 'sh', $job]);
            $p->setTimeout(10);
            $p->run();
            if ($p->isSuccessful()) {
                return true;
            }
        } catch (\Throwable $e) {
            // proc_open disabled, no /bin/sh... the original simply stays as-is.
        }
        @unlink($job);
        return false;
    }

    private static function ffmpeg(): string
    {
        return (string) config('fmcg.ffmpeg_path', 'ffmpeg');
    }

    /** Can this host actually run ffmpeg? (~50 ms, and only asked when needed.) */
    private static function ffmpegWorks(): bool
    {
        return self::runQuick([self::ffmpeg(), '-hide_banner', '-version']);
    }

    private static function runQuick(array $cmd): bool
    {
        try {
            $p = new Process($cmd);
            $p->setTimeout(self::QUICK_TIMEOUT);
            $p->run();
            return $p->isSuccessful();
        } catch (\Throwable $e) {
            // Includes ProcessTimedOutException: Symfony kills the process first.
            return false;
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
        $dir = self::dir();
        $base = basename($name);
        $paths = [$dir . '/' . $base];

        // A product clip still stored as its original also owns the MP4 its
        // background job produced (or is producing) and that job's leftovers.
        if (preg_match(self::PRODUCT_SRC, $base, $m)) {
            // If that job is still running it must not publish its result. The
            // original disappearing is NOT a reliable signal on its own: Windows
            // refuses to delete a file ffmpeg has open, so the job would find it
            // still there and publish an orphan. An explicit marker works on
            // every OS. Written BEFORE anything is removed, so there is no moment
            // at which the job could see neither.
            if (is_file("{$dir}/{$m[1]}.job.sh")) {
                @touch("{$dir}/{$m[1]}.cancel");
            }
            $paths[] = "{$dir}/{$m[1]}.mp4";
            $paths[] = "{$dir}/{$m[1]}.part.mp4";
            // NOT the job's own script: the job removes it as its last act, and
            // deleting a script out from under the shell running it is what cut
            // that shell short on Windows.
        }

        foreach ($paths as $path) {
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }
}

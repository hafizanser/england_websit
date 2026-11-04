<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\UploadedFile;
use RuntimeException;

/**
 * Pandi delivery-slip photos. Files live outside the web root (config fmcg.slips_path),
 * one folder per order, and are only ever streamed to a signed-in admin.
 *
 * The app already shrinks a photo before sending it; here the file is checked again
 * (real image content, allowed type, size, dimensions). When GD is available a very
 * large image is scaled down to MAX_EDGE pixels at a quality that keeps handwriting
 * readable; without GD the checked original is kept as-is.
 */
class SlipStorage
{
    public const MIMES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    public const MAX_EDGE = 2400;
    public const MIN_EDGE = 200;

    public static function root(): string
    {
        return rtrim((string) config('fmcg.slips_path'), '/\\');
    }

    /** Absolute path of a stored slip (relative path from the DB); null if it escapes the root. */
    public static function absolute(string $relative): ?string
    {
        if ($relative === '' || str_contains($relative, '..')) {
            return null;
        }
        return self::root() . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relative);
    }

    /**
     * Validate an uploaded slip. Returns [mime, width, height] or throws RuntimeException
     * with a message the app can show as-is.
     */
    public static function inspect(UploadedFile $file): array
    {
        if (!$file->isValid()) {
            throw new RuntimeException('Upload incomplete. Please try again.');
        }
        $maxBytes = (int) config('fmcg.slip_max_kb', 10240) * 1024;
        if ($file->getSize() <= 0 || $file->getSize() > $maxBytes) {
            throw new RuntimeException('Photo is too large (max ' . round($maxBytes / 1048576) . ' MB).');
        }
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
        if (!isset(self::MIMES[$mime])) {
            throw new RuntimeException('Only JPG, PNG or WebP photos can be uploaded.');
        }
        $info = @getimagesize($file->getRealPath());
        if (!$info || ($info[0] ?? 0) <= 0 || ($info[1] ?? 0) <= 0) {
            throw new RuntimeException('This file is not a readable image.');
        }
        if (max($info[0], $info[1]) < self::MIN_EDGE) {
            throw new RuntimeException('Photo is too small to read. Please take a clearer photo.');
        }
        return [$mime, (int) $info[0], (int) $info[1]];
    }

    /**
     * Store a validated slip for an order. Returns metadata for the DB row.
     * The file is written under a new unique name, so the previous slip stays intact
     * until the caller has saved the new row (and then deletes it).
     */
    public static function store(UploadedFile $file, int $orderId, string $orderCode): array
    {
        [$mime, $w, $h] = self::inspect($file);
        $dir = self::root() . DIRECTORY_SEPARATOR . $orderId;
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('Server storage is not writable.');
        }
        $safeCode = preg_replace('/[^A-Za-z0-9-]/', '', $orderCode) ?: 'order';
        $base = $safeCode . '-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4));

        $bytes = null;
        if (max($w, $h) > self::MAX_EDGE && function_exists('imagecreatefromstring')) {
            [$bytes, $w, $h] = self::downscale((string) file_get_contents($file->getRealPath()), $w, $h);
            if ($bytes !== null) {
                $mime = 'image/jpeg';
            }
        }
        $ext = self::MIMES[$mime];
        $relative = $orderId . '/' . $base . '.' . $ext;
        $target = self::absolute($relative);
        $tmp = $target . '.part';
        $ok = $bytes !== null ? file_put_contents($tmp, $bytes) !== false : @copy($file->getRealPath(), $tmp);
        if (!$ok || !@rename($tmp, $target)) {
            @unlink($tmp);
            throw new RuntimeException('Could not save the photo on the server.');
        }
        return [
            'slip_path' => $relative,
            'slip_mime' => $mime,
            'slip_size' => (int) filesize($target),
            'slip_width' => $w,
            'slip_height' => $h,
            'slip_sha256' => hash_file('sha256', $target),
        ];
    }

    /** @return array{0:?string,1:int,2:int} JPEG bytes (or null if GD failed) and the new size. */
    private static function downscale(string $data, int $w, int $h): array
    {
        $src = @imagecreatefromstring($data);
        if (!$src) {
            return [null, $w, $h];
        }
        $scale = self::MAX_EDGE / max($w, $h);
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));
        $dst = imagecreatetruecolor($nw, $nh);
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255)); // flatten PNG transparency onto white
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
        ob_start();
        imagejpeg($dst, null, 85);
        $out = (string) ob_get_clean();
        imagedestroy($src);
        imagedestroy($dst);
        return [$out !== '' ? $out : null, $nw, $nh];
    }

    public static function delete(?string $relative): void
    {
        if ($relative && ($abs = self::absolute($relative)) && is_file($abs)) {
            @unlink($abs);
        }
    }
}

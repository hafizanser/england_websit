<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\UploadedFile;
use RuntimeException;

/**
 * Builty (Pandi delivery-slip) photos — front and back. Files live outside the web root (config fmcg.slips_path),
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

    /** RuntimeException codes, so the API can name the reason (data.reason) without parsing text. */
    public const E_INCOMPLETE = 1;
    public const E_TOO_LARGE = 2;
    public const E_TYPE = 3;
    public const E_UNREADABLE = 4;
    public const E_TOO_SMALL = 5;
    public const E_STORAGE = 9;

    public const REASONS = [
        self::E_INCOMPLETE => 'upload_incomplete',
        self::E_TOO_LARGE => 'image_too_large',
        self::E_TYPE => 'image_type_not_allowed',
        self::E_UNREADABLE => 'image_unreadable',
        self::E_TOO_SMALL => 'image_too_small',
        self::E_STORAGE => 'storage_failed',
    ];

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
            throw new RuntimeException('Upload incomplete. Please try again.', self::E_INCOMPLETE);
        }
        $maxBytes = (int) config('fmcg.slip_max_kb', 10240) * 1024;
        if ($file->getSize() <= 0 || $file->getSize() > $maxBytes) {
            throw new RuntimeException('Photo is too large (max ' . round($maxBytes / 1048576) . ' MB).', self::E_TOO_LARGE);
        }
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
        if (!isset(self::MIMES[$mime])) {
            throw new RuntimeException('Only JPG, PNG or WebP photos can be uploaded.', self::E_TYPE);
        }
        $info = @getimagesize($file->getRealPath());
        if (!$info || ($info[0] ?? 0) <= 0 || ($info[1] ?? 0) <= 0) {
            throw new RuntimeException('This file is not a readable image.', self::E_UNREADABLE);
        }
        if (max($info[0], $info[1]) < self::MIN_EDGE) {
            throw new RuntimeException('Photo is too small to read. Please take a clearer photo.', self::E_TOO_SMALL);
        }
        return [$mime, (int) $info[0], (int) $info[1]];
    }

    /**
     * Store a validated Builty image (side "front" or "back") for an order. Returns
     * path / mime / size / width / height / sha256 for the DB row. The file is written
     * under a new unique name, so the previous image of that side stays intact until
     * the caller has saved the new row (and then deletes the old file).
     */
    public static function store(UploadedFile $file, int $orderId, string $orderCode, string $side = 'front', ?string $folder = null): array
    {
        [$mime, $w, $h] = self::inspect($file);
        // Website orders keep their images under "<order id>/"; ERP sales under "erp-<id>/".
        $folder = $folder ?? (string) $orderId;
        $dir = self::root() . DIRECTORY_SEPARATOR . $folder;
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('Server storage is not writable.', self::E_STORAGE);
        }
        $safeCode = preg_replace('/[^A-Za-z0-9-]/', '', $orderCode) ?: 'order';
        $side = $side === 'back' ? 'back' : 'front';
        $base = $safeCode . '-builty-' . $side . '-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4));

        $bytes = null;
        if (max($w, $h) > self::MAX_EDGE && function_exists('imagecreatefromstring')) {
            [$bytes, $w, $h] = self::downscale((string) file_get_contents($file->getRealPath()), $w, $h);
            if ($bytes !== null) {
                $mime = 'image/jpeg';
            }
        }
        $ext = self::MIMES[$mime];
        $relative = $folder . '/' . $base . '.' . $ext;
        $target = self::absolute($relative);
        $tmp = $target . '.part';
        $ok = $bytes !== null ? file_put_contents($tmp, $bytes) !== false : @copy($file->getRealPath(), $tmp);
        if (!$ok || !@rename($tmp, $target)) {
            @unlink($tmp);
            throw new RuntimeException('Could not save the photo on the server.', self::E_STORAGE);
        }
        return [
            'path' => $relative,
            'mime' => $mime,
            'size' => (int) filesize($target),
            'width' => $w,
            'height' => $h,
            'sha256' => hash_file('sha256', $target),
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

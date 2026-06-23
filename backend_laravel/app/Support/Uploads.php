<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\UploadedFile;

/**
 * Stores & links product / category / offer / blog images in the shared
 * order_management uploads folder (port of the legacy Core\Uploads). Images are
 * streamed back to the SPA through this backend's GET /image route.
 */
class Uploads
{
    public static function dir(): string
    {
        return rtrim(str_replace('\\', '/', (string) config('fmcg.uploads_path', '')), '/');
    }

    /** Base URL of the image-serving route on THIS backend. */
    public static function baseUrl(): string
    {
        return rtrim(url('/image'), '/');
    }

    /** Public URL for a stored filename (null/empty stays null). */
    public static function url(?string $name): ?string
    {
        $name = trim((string) $name);
        if ($name === '') {
            return null;
        }
        if (preg_match('#^https?://#i', $name)) {
            return $name; // already absolute
        }
        return self::baseUrl() . '?file=' . rawurlencode($name);
    }

    /**
     * Move an uploaded file into the shared uploads folder.
     * @param string $prefix optional token in the filename (mirrors the reference app)
     * @param bool   $random use a random token + extension (used for category/blog images)
     * @return string the stored filename
     */
    public static function save(UploadedFile $file, string $prefix = '', bool $random = false): string
    {
        $dir = self::dir();
        if ($dir === '') {
            throw new \RuntimeException('Uploads path not configured');
        }
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        // Only allow real image extensions into the public uploads folder — never
        // .php/.phtml/.htaccess etc. (the folder is served directly by Apache).
        $allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        if (!in_array($ext, $allowedExt, true)) {
            throw new \RuntimeException('Sirf image files allowed hain (jpg, png, gif, webp, svg, bmp).');
        }

        if ($random) {
            $name = time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        } else {
            // Sanitise the client filename: drop the path, strip anything unsafe,
            // and force the validated image extension (so "x.php.jpg" can't slip).
            $base = pathinfo(basename($file->getClientOriginalName()), PATHINFO_FILENAME);
            $base = preg_replace('/[^A-Za-z0-9 ._-]/', '', $base);
            $base = trim((string) $base) !== '' ? $base : 'image';
            $token = $prefix !== '' ? $prefix . '_' : '';
            $name = time() . '_' . $token . $base . '.' . $ext;
        }

        $file->move($dir, $name);
        return $name;
    }

    /** Delete a stored file if it exists (best-effort). */
    public static function delete(?string $name): void
    {
        $name = trim((string) $name);
        if ($name === '' || preg_match('#^https?://#i', $name)) {
            return;
        }
        $path = self::dir() . '/' . $name;
        if (is_file($path)) {
            @unlink($path);
        }
    }
}

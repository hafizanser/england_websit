<?php
declare(strict_types=1);

namespace App\Core;

/** Helpers for storing & linking product / category images in the shared uploads folder. */
class Uploads
{
    public static function dir(): string
    {
        return rtrim(str_replace('\\', '/', (string)($GLOBALS['__config']['uploads_path'] ?? '')), '/');
    }

    public static function baseUrl(): string
    {
        return rtrim((string)($GLOBALS['__config']['uploads_url'] ?? ''), '/');
    }

    /** Public URL for a stored filename (null/empty stays null). */
    public static function url(?string $name): ?string
    {
        $name = trim((string)$name);
        if ($name === '') {
            return null;
        }
        // Already an absolute URL? leave it alone.
        if (preg_match('#^https?://#i', $name)) {
            return $name;
        }
        // Served by this backend's image route: /image?file=<name>
        return self::baseUrl() . '?file=' . rawurlencode($name);
    }

    /**
     * Move an uploaded file into the shared uploads folder.
     * @param array  $file   one entry from $_FILES
     * @param string $prefix optional extra token in the filename (mirrors the reference app)
     * @param bool   $random use a random token + extension (used for category images)
     * @return string the stored filename
     */
    public static function save(array $file, string $prefix = '', bool $random = false): string
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'] ?? '')) {
            throw new \RuntimeException('Image upload failed');
        }

        $dir = self::dir();
        if ($dir === '') {
            throw new \RuntimeException('Uploads path not configured');
        }
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        if ($random) {
            $ext  = pathinfo((string)$file['name'], PATHINFO_EXTENSION) ?: 'jpg';
            $name = time() . '_' . bin2hex(random_bytes(4)) . '.' . strtolower($ext);
        } else {
            $orig = basename((string)$file['name']);
            $token = $prefix !== '' ? $prefix . '_' : '';
            $name = time() . '_' . $token . $orig;
        }

        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) {
            throw new \RuntimeException('Could not store uploaded image');
        }
        return $name;
    }

    /** Delete a stored file if it exists (best-effort). */
    public static function delete(?string $name): void
    {
        $name = trim((string)$name);
        if ($name === '' || preg_match('#^https?://#i', $name)) {
            return;
        }
        $path = self::dir() . '/' . $name;
        if (is_file($path)) {
            @unlink($path);
        }
    }
}

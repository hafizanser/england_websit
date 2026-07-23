<?php
declare(strict_types=1);

namespace App\Core;

use App\Core\Uploads;

/**
 * Stores PDF documents.
 */
class PdfStorage
{
    public static function dir(): string
    {
        return Uploads::dir() . '/pdfs';
    }

    public static function url(?string $name): ?string
    {
        $name = trim((string)$name);
        if ($name === '') {
            return null;
        }
        if (preg_match('#^https?://#i', $name)) {
            return $name;
        }
        if (str_starts_with($name, '/')) {
            return $name;
        }
        return '/pdf?file=' . rawurlencode($name);
    }

    private static function ensureDir(): void
    {
        $dir = self::dir();
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
    }

    public static function saveUpload(array $file): string
    {
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if ($ext !== 'pdf') {
            throw new \RuntimeException('Sirf PDF files allowed hain.');
        }
        self::ensureDir();
        $stamp = time() . '_' . bin2hex(random_bytes(6));
        $fileName = $stamp . '.pdf';
        $dest = self::dir() . '/' . $fileName;
        move_uploaded_file($file['tmp_name'], $dest);
        return $fileName;
    }

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

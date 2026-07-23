<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\UploadedFile;

/**
 * Stores PDF documents.
 */
class PdfStorage
{
    public const MIME = [
        'pdf' => 'application/pdf',
    ];

    public static function dir(): string
    {
        return rtrim(str_replace('\\', '/', (string) config('fmcg.pdfs_path', base_path('uploads/pdfs'))), '/');
    }

    public static function baseUrl(): string
    {
        return rtrim(url('/pdf'), '/');
    }

    /**
     * Public URL for a stored PDF document.
     */
    public static function url(?string $name): ?string
    {
        $name = trim((string) $name);
        if ($name === '') {
            return null;
        }
        return self::baseUrl() . '?file=' . rawurlencode($name);
    }

    private static function ensureDir(): string
    {
        $dir = self::dir();
        if ($dir === '') {
            throw new \RuntimeException('PDFs path not configured');
        }
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        return $dir;
    }

    public static function saveUpload(UploadedFile $file): string
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: 'pdf');
        if ($ext !== 'pdf') {
            throw new \RuntimeException('Sirf PDF files allowed hain.');
        }
        $dir = self::ensureDir();
        $stamp = time() . '_' . bin2hex(random_bytes(6));
        $fileName = $stamp . '.pdf';
        $file->move($dir, $fileName);
        return $fileName;
    }

    public static function delete(?string $name): void
    {
        $name = trim((string) $name);
        if ($name === '') {
            return;
        }
        $path = self::dir() . '/' . basename($name);
        if (is_file($path)) {
            @unlink($path);
        }
    }
}

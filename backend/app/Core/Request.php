<?php
declare(strict_types=1);

namespace App\Core;

/** Wraps the incoming HTTP request (method, path, query, JSON body, auth token). */
class Request
{
    public string $method;
    public string $path;
    public array $query;
    private array $body;
    private array $headers;

    public function __construct()
    {
        $this->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $this->query = $_GET ?? [];
        $this->headers = $this->parseHeaders();
        $this->path = $this->resolvePath();
        $this->body = $this->parseBody();
    }

    private function resolvePath(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $script = $_SERVER['SCRIPT_NAME'] ?? '';
        $base = rtrim(str_replace('\\', '/', dirname($script)), '/');
        if ($base !== '' && $base !== '/' && str_starts_with($uri, $base)) {
            $uri = substr($uri, strlen($base));
        }
        // strip a trailing /index.php if present
        $uri = preg_replace('#/index\.php#', '', $uri) ?? $uri;
        $uri = '/' . trim($uri, '/');
        return $uri === '' ? '/' : $uri;
    }

    private function parseBody(): array
    {
        $raw = file_get_contents('php://input') ?: '';
        if ($raw === '') {
            return $_POST ?? [];
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : ($_POST ?? []);
    }

    private function parseHeaders(): array
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $name = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$name] = $value;
            }
        }
        return $headers;
    }

    public function input(string $key, $default = null)
    {
        return $this->body[$key] ?? $default;
    }

    public function all(): array
    {
        return $this->body;
    }

    public function bearerToken(): ?string
    {
        $auth = $this->headers['authorization'] ?? '';
        if (preg_match('/Bearer\s+(.+)/i', $auth, $m)) {
            return trim($m[1]);
        }
        return null;
    }

    /** Absolute base URL of this backend (scheme://host[/base]) for building asset links. */
    public function appBaseUrl(): string
    {
        $scheme = (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $script = $_SERVER['SCRIPT_NAME'] ?? '';
        $base = rtrim(str_replace('\\', '/', dirname($script)), '/');
        // Under Apache without rewrite the front controller is reached via index.php;
        // keep it in the asset base so /uploads/* routes resolve there too.
        if (str_ends_with($script, '/index.php') && $base !== '') {
            $base .= '/index.php';
        }
        return $scheme . '://' . $host . ($base === '/' ? '' : $base);
    }

    /** A single uploaded file entry from $_FILES, or null. */
    public function file(string $key): ?array
    {
        $f = $_FILES[$key] ?? null;
        if (!is_array($f) || is_array($f['name'] ?? null)) {
            return null; // missing, or this is a multi-file field (use files()).
        }
        return ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK ? $f : null;
    }

    public function hasFile(string $key): bool
    {
        return $this->file($key) !== null;
    }

    /** Normalised list of uploaded files for a multi-file field (name="foo[]"). */
    public function files(string $key): array
    {
        $f = $_FILES[$key] ?? null;
        if (!is_array($f)) {
            return [];
        }
        // Single file submitted under this key.
        if (!is_array($f['name'])) {
            return ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK ? [$f] : [];
        }
        // Multi-file: pivot the column arrays into a list of file entries.
        $out = [];
        foreach ($f['name'] as $i => $name) {
            if (($f['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                continue;
            }
            $out[] = [
                'name'     => $name,
                'type'     => $f['type'][$i] ?? '',
                'tmp_name' => $f['tmp_name'][$i] ?? '',
                'error'    => $f['error'][$i],
                'size'     => $f['size'][$i] ?? 0,
            ];
        }
        return $out;
    }
}

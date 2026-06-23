<?php
declare(strict_types=1);

namespace App\Core;

/** Application bootstrap: CORS, DB, routing, dispatch. */
class App
{
    private array $config;

    public function __construct(array $config)
    {
        $this->config = $config;
    }

    public function run(): void
    {
        Response::cors($this->config['cors'] ?? '*');

        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
            http_response_code(204);
            exit;
        }

        try {
            Database::connect($this->config['db_path']);
        } catch (\Throwable $e) {
            Response::error('Database error: ' . $e->getMessage(), 500);
        }

        $GLOBALS['__config'] = $this->config;

        $request = new Request();
        // Serve product/category images through this backend so image links work
        // regardless of how the reference app's Apache vhost is configured.
        $GLOBALS['__config']['uploads_url'] = $request->appBaseUrl() . '/image';
        $router = new Router();
        (require __DIR__ . '/../Routes/api.php')($router);

        $match = $router->match($request->method, $request->path);
        if ($match === null) {
            Response::error('Route not found: ' . $request->method . ' ' . $request->path, 404);
        }

        [$handler, $params] = $match;
        [$class, $method] = $handler;

        try {
            $controller = new $class($request);
            $controller->{$method}($params);
        } catch (\Throwable $e) {
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
}

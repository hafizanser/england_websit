<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Response;
use App\Models\Blog;

/** Public blog endpoints — published posts only. */
class BlogController extends Controller
{
    public function index(): void
    {
        Response::ok(['data' => (new Blog())->published()]);
    }

    public function show(array $p): void
    {
        $blog = (new Blog())->getBySlug((string)$p['slug']);
        if (!$blog || ($blog['status'] ?? '') !== 'published') {
            Response::error('Blog nahi mila', 404);
        }
        Response::ok(['data' => $blog]);
    }
}

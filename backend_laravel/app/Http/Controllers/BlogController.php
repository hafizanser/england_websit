<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\BlogRepo;
use App\Support\Api;
use App\Support\CatalogCache;
use Illuminate\Http\Request;

/** Public blog endpoints — published posts only. */
class BlogController extends Controller
{
    /** Posts change rarely; a save bumps the version token and retires this at once. */
    private const TTL = 900;

    public function index()
    {
        $data = CatalogCache::remember('blogs', self::TTL, fn () => (new BlogRepo())->published());

        return Api::ok(['data' => $data]);
    }

    public function show(Request $request, string $slug)
    {
        // Only a PUBLISHED post is ever written to the cache. Caching the row and
        // checking the status afterwards would leave a post readable through the
        // cache for a whole TTL after it was pulled back to draft.
        $blog = CatalogCache::remember('blog:' . $slug, self::TTL, function () use ($slug) {
            $found = (new BlogRepo())->getBySlug($slug);
            return ($found && ($found['status'] ?? '') === 'published') ? $found : false;
        });

        if (!$blog) {
            Api::halt('Blog nahi mila', 404);
        }
        return Api::ok(['data' => $blog]);
    }
}

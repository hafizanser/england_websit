<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\BlogRepo;
use App\Support\Api;
use Illuminate\Http\Request;

/** Public blog endpoints — published posts only. */
class BlogController extends Controller
{
    public function index()
    {
        return Api::ok(['data' => (new BlogRepo())->published()]);
    }

    public function show(Request $request, string $slug)
    {
        $blog = (new BlogRepo())->getBySlug($slug);
        if (!$blog || ($blog['status'] ?? '') !== 'published') {
            Api::halt('Blog nahi mila', 404);
        }
        return Api::ok(['data' => $blog]);
    }
}

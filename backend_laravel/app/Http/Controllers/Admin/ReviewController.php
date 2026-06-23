<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Repositories\ReviewRepo;
use App\Support\Api;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function index()
    {
        return Api::ok(['data' => (new ReviewRepo())->all()]);
    }

    public function update(Request $request, string $id)
    {
        $review = (new ReviewRepo())->update((int) $id, $request->all());
        if (!$review) {
            Api::halt('Review nahi mila', 404);
        }
        return Api::ok(['data' => $review]);
    }

    public function destroy(Request $request, string $id)
    {
        (new ReviewRepo())->delete((int) $id);
        return Api::ok(['deleted' => (int) $id]);
    }
}

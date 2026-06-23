<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Controller;
use App\Core\Response;
use App\Models\RefReview;

class ReviewController extends Controller
{
    public function index(): void
    {
        $this->requireAdmin();
        Response::ok(['data' => (new RefReview())->all()]);
    }

    public function update(array $p): void
    {
        $this->requireAdmin();
        $review = (new RefReview())->update((int)$p['id'], $this->request->all());
        if (!$review) {
            Response::error('Review nahi mila', 404);
        }
        Response::ok(['data' => $review]);
    }

    public function destroy(array $p): void
    {
        $this->requireAdmin();
        (new RefReview())->delete((int)$p['id']);
        Response::ok(['deleted' => (int)$p['id']]);
    }
}

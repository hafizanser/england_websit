<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Response;
use App\Models\RefReview;

class ReviewController extends Controller
{
    /** Public: approved reviews + rating summary for a product. */
    public function index(array $p): void
    {
        $model = new RefReview();
        $pid = $p['id'];
        Response::ok(['data' => [
            'reviews' => $model->forProduct($pid),
            'summary' => $model->summary($pid),
        ]]);
    }

    /** Public: recent approved reviews across all products (homepage slider). */
    public function featured(): void
    {
        $limit = (int)($this->request->query['limit'] ?? 12);
        Response::ok(['data' => (new RefReview())->approvedFeatured($limit > 0 ? $limit : 12)]);
    }

    /**
     * Submit a review — open to everyone (no login required). A guest provides
     * their name; logged-in customers have it filled automatically. Reviews are
     * published immediately (status = approved).
     */
    public function store(array $p): void
    {
        $customer = $this->optionalCustomer();
        $pid = (int)$p['id'];
        $rating = (int)$this->request->input('rating', 0);
        $comment = trim((string)$this->request->input('comment', ''));
        $name = trim((string)$this->request->input('customer_name', ''));
        if ($name === '' && $customer) {
            $name = trim((string)($customer['name'] ?? ''));
        }

        $fields = [];
        if ($name === '' || mb_strlen($name) < 2) {
            $fields['customer_name'] = 'Apna naam likhein.';
        }
        if ($rating < 1 || $rating > 5) {
            $fields['rating'] = 'Star rating dein (1–5).';
        }
        if (mb_strlen($comment) < 3) {
            $fields['comment'] = 'Apni raye likhein (kam az kam 3 harf).';
        }
        if ($fields) {
            Response::error('Form mukammal karein', 422, ['fields' => $fields]);
        }

        $model = new RefReview();
        // Only block duplicates for a logged-in customer (guests may post freely).
        if ($customer && $model->existsForCustomer($pid, (int)$customer['id'])) {
            Response::error('Aap is product ka review pehle de chuke hain.', 409);
        }

        $review = $model->create([
            'product_id'    => $pid,
            'customer_name' => $name ?: 'Customer',
            'customer_id'   => $customer ? (int)$customer['id'] : null,
            'rating'        => $rating,
            'comment'       => $comment,
        ]);
        Response::ok(['data' => $review], 201);
    }
}

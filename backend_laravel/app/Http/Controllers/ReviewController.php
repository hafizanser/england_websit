<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\ReviewRepo;
use App\Support\Api;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    /** Public: approved reviews + rating summary for a product. */
    public function index(Request $request, string $id)
    {
        $model = new ReviewRepo();
        return Api::ok(['data' => [
            'reviews' => $model->forProduct($id),
            'summary' => $model->summary($id),
        ]]);
    }

    /** Public: recent approved reviews across all products (homepage slider). */
    public function featured(Request $request)
    {
        $limit = (int) $request->query('limit', 12);
        return Api::ok(['data' => (new ReviewRepo())->approvedFeatured($limit > 0 ? $limit : 12)]);
    }

    /** Submit a review — open to everyone (guests provide a name); published immediately. */
    public function store(Request $request, string $id)
    {
        $customer = $this->optionalCustomer($request);
        $pid = (int) $id;
        $rating = (int) $request->input('rating', 0);
        $comment = trim((string) $request->input('comment', ''));
        $name = trim((string) $request->input('customer_name', ''));
        if ($name === '' && $customer) {
            $name = trim((string) ($customer->name ?? ''));
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
            Api::halt('Form mukammal karein', 422, ['fields' => $fields]);
        }

        $model = new ReviewRepo();
        if ($customer && $model->existsForCustomer($pid, (int) $customer->id)) {
            Api::halt('Aap is product ka review pehle de chuke hain.', 409);
        }

        $review = $model->create([
            'product_id'    => $pid,
            'customer_name' => $name ?: 'Customer',
            'customer_id'   => $customer ? (int) $customer->id : null,
            'rating'        => $rating,
            'comment'       => $comment,
        ]);
        return Api::ok(['data' => $review], 201);
    }
}

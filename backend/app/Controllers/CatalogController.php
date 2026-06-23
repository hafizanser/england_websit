<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Response;
use App\Models\RefProduct;
use App\Models\RefCategory;
use App\Models\Offer;
use App\Models\RefOffer;
use App\Services\OrderService;

class CatalogController extends Controller
{
    public function products(): void
    {
        $list = (new RefProduct())->storefront([
            'cat'  => $this->request->query['cat'] ?? 'all',
            'q'    => $this->request->query['q'] ?? '',
            'sort' => $this->request->query['sort'] ?? 'popular',
        ]);
        Response::ok(['data' => $list]);
    }

    public function topSelling(): void
    {
        Response::ok(['data' => (new RefProduct())->storefrontFeatured(8)]);
    }

    public function product(array $p): void
    {
        $found = (new RefProduct())->storefrontById($p['id']);
        if (!$found) {
            Response::error('Product nahi mila', 404);
        }
        Response::ok(['data' => $found]);
    }

    public function categories(): void
    {
        Response::ok(['data' => (new RefCategory())->storefront()]);
    }

    // Offers come from the admin dashboard (MySQL order_system.offers). When the
    // dashboard has no active offers we fall back to the seeded SQLite offers so
    // the page is never empty.
    public function offers(): void
    {
        $admin = (new RefOffer())->storefront();
        Response::ok(['data' => $admin ?: (new Offer())->list()]);
    }

    public function featuredOffers(): void
    {
        $admin = (new RefOffer())->storefrontFeatured();
        if (!empty($admin['hero'])) {
            Response::ok(['data' => $admin]);
        }
        Response::ok(['data' => (new Offer())->featured()]);
    }

    public function offer(array $p): void
    {
        $found = (new RefOffer())->storefrontBySlug($p['slug']) ?? (new Offer())->bySlug($p['slug']);
        if (!$found) {
            Response::error('Offer nahi mili', 404);
        }
        Response::ok(['data' => $found]);
    }

    /** Validate a promo code against an optional cart. */
    public function validateCode(): void
    {
        $code = (string)$this->request->input('code', '');
        $rows = $this->request->input('items', []);
        $totals = (new OrderService())->quote(is_array($rows) ? $rows : [], $code ?: null);
        $status = $totals['codeStatus'];
        if (!$code) {
            Response::ok(['valid' => false, 'reason' => 'Code likhein']);
        }
        if ($status && ($status['ok'] ?? false)) {
            Response::ok(['valid' => true, 'code' => $status['code'], 'totals' => $totals]);
        }
        Response::ok(['valid' => false, 'reason' => $status['reason'] ?? 'Yeh code maujood nahi hai']);
    }

    /** Re-price a cart server-side (authoritative). */
    public function quote(): void
    {
        $rows = $this->request->input('items', []);
        $code = $this->request->input('code', null);
        Response::ok(['totals' => (new OrderService())->quote(is_array($rows) ? $rows : [], $code)]);
    }
}

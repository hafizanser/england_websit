<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\CategoryRepo;
use App\Repositories\OfferRepo;
use App\Repositories\ProductRepo;
use App\Services\OrderService;
use App\Support\Api;
use App\Support\SeedOffers;
use Illuminate\Http\Request;

class CatalogController extends Controller
{
    public function products(Request $request)
    {
        $list = (new ProductRepo())->storefront([
            'cat'  => $request->query('cat', 'all'),
            'q'    => $request->query('q', ''),
            'sort' => $request->query('sort', 'popular'),
        ]);
        return Api::ok(['data' => $list]);
    }

    public function topSelling()
    {
        return Api::ok(['data' => (new ProductRepo())->storefrontFeatured(8)]);
    }

    public function product(Request $request, string $id)
    {
        $found = (new ProductRepo())->storefrontById($id);
        if (!$found) {
            Api::halt('Product nahi mila', 404);
        }
        return Api::ok(['data' => $found]);
    }

    public function categories()
    {
        return Api::ok(['data' => (new CategoryRepo())->storefront()]);
    }

    public function offers()
    {
        $admin = (new OfferRepo())->storefront();
        return Api::ok(['data' => $admin ?: SeedOffers::list()]);
    }

    public function featuredOffers()
    {
        $admin = (new OfferRepo())->storefrontFeatured();
        if (!empty($admin['hero'])) {
            return Api::ok(['data' => $admin]);
        }
        return Api::ok(['data' => SeedOffers::featured()]);
    }

    public function offer(Request $request, string $slug)
    {
        $found = (new OfferRepo())->storefrontBySlug($slug) ?? SeedOffers::bySlug($slug);
        if (!$found) {
            Api::halt('Offer nahi mili', 404);
        }
        return Api::ok(['data' => $found]);
    }

    /** Validate a promo code against an optional cart. */
    public function validateCode(Request $request)
    {
        $code = (string) $request->input('code', '');
        $rows = $request->input('items', []);
        $totals = (new OrderService())->quote(is_array($rows) ? $rows : [], $code ?: null);
        $status = $totals['codeStatus'];
        if (!$code) {
            return Api::ok(['valid' => false, 'reason' => 'Code likhein']);
        }
        if ($status && ($status['ok'] ?? false)) {
            return Api::ok(['valid' => true, 'code' => $status['code'], 'totals' => $totals]);
        }
        return Api::ok(['valid' => false, 'reason' => $status['reason'] ?? 'Yeh code maujood nahi hai']);
    }

    /** Re-price a cart server-side (authoritative). */
    public function quote(Request $request)
    {
        $rows = $request->input('items', []);
        $code = $request->input('code', null);
        return Api::ok(['totals' => (new OrderService())->quote(is_array($rows) ? $rows : [], $code)]);
    }
}

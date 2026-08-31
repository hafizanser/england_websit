<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\CategoryRepo;
use App\Repositories\OfferRepo;
use App\Repositories\ProductRepo;
use App\Services\OrderService;
use App\Support\Api;
use App\Support\CatalogCache;
use App\Support\SeedOffers;
use Illuminate\Http\Request;

class CatalogController extends Controller
{
    /**
     * How long a computed catalogue projection may be reused. Short on purpose —
     * the real invalidation is CatalogCache's version token, bumped the moment an
     * admin saves; this only bounds staleness for a row edited outside the app.
     */
    private const TTL_PRODUCTS = 300;
    private const TTL_SLOW     = 900;   // categories/offers change far less often

    public function products(Request $request)
    {
        // The projection is expensive relative to the payload: every row is
        // decorated, priced across six unit tiers and re-sorted in PHP. Caching
        // it keyed by the exact filter triple means the Products page, the
        // "related products" rail on every detail page and the admin order
        // builder all share one computation.
        $cat  = (string) $request->query('cat', 'all');
        $q    = (string) $request->query('q', '');
        $sort = (string) $request->query('sort', 'popular');

        $list = CatalogCache::remember(
            'products:' . md5($cat . '|' . $q . '|' . $sort),
            self::TTL_PRODUCTS,
            fn () => (new ProductRepo())->storefront(['cat' => $cat, 'q' => $q, 'sort' => $sort]),
        );

        return Api::ok(['data' => $list]);
    }

    public function topSelling()
    {
        $data = CatalogCache::remember(
            'products:top-selling:8',
            self::TTL_PRODUCTS,
            fn () => (new ProductRepo())->storefrontFeatured(8),
        );

        return Api::ok(['data' => $data]);
    }

    public function product(Request $request, string $id)
    {
        // A miss is cached as `false` rather than skipped, so a bot walking
        // /products/1..9999 cannot turn every 404 into a database round-trip.
        $found = CatalogCache::remember(
            'product:' . $id,
            self::TTL_PRODUCTS,
            fn () => (new ProductRepo())->storefrontById($id) ?? false,
        );

        if (!$found) {
            Api::halt('Product nahi mila', 404);
        }
        return Api::ok(['data' => $found]);
    }

    public function categories()
    {
        $data = CatalogCache::remember(
            'categories',
            self::TTL_SLOW,
            fn () => (new CategoryRepo())->storefront(),
        );

        return Api::ok(['data' => $data]);
    }

    public function offers()
    {
        $data = CatalogCache::remember('offers', self::TTL_SLOW, function () {
            $admin = (new OfferRepo())->storefront();
            return $admin ?: SeedOffers::list();
        });

        return Api::ok(['data' => $data]);
    }

    public function featuredOffers()
    {
        $data = CatalogCache::remember('offers:featured', self::TTL_SLOW, function () {
            $admin = (new OfferRepo())->storefrontFeatured();
            return !empty($admin['hero']) ? $admin : SeedOffers::featured();
        });

        return Api::ok(['data' => $data]);
    }

    public function offer(Request $request, string $slug)
    {
        $found = CatalogCache::remember(
            'offer:' . $slug,
            self::TTL_SLOW,
            fn () => (new OfferRepo())->storefrontBySlug($slug) ?? SeedOffers::bySlug($slug) ?? false,
        );

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

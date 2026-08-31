<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\CatalogCache;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Invalidation, attached to the write PATHS rather than sprinkled through the
 * controllers.
 *
 * Any successful non-GET under this middleware retires the whole catalogue
 * version (see App\Support\CatalogCache). Wrapping the route groups instead of
 * editing twenty controller methods means a route added next month is covered
 * the day it is written — the failure mode of the per-controller approach is a
 * new endpoint that silently serves stale data for a whole TTL, and that failure
 * is invisible until a shopkeeper complains.
 *
 * Deliberately scoped: it is NOT on the whole API. `/cart/quote` and
 * `/promo/validate` are POSTs fired repeatedly from the cart and change nothing
 * anybody else can see — bumping on those would flush the catalogue cache on
 * every keystroke in the promo box.
 */
class BumpCatalogVersion
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($request->isMethodCacheable()) {
            return $response; // GET / HEAD / OPTIONS change nothing
        }

        $status = $response->getStatusCode();
        if ($status >= 200 && $status < 300) {
            CatalogCache::bump();
        }

        return $response;
    }
}

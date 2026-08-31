<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\CatalogCache;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Browser/CDN caching for the PUBLIC catalogue reads.
 *
 *     Route::get('/products', ...)->middleware('cache.public:15');
 *                                                           └── max-age, seconds
 *
 * Laravel answers API routes with `Cache-Control: no-cache, private` by default,
 * which is why every single navigation used to go all the way to MySQL.
 *
 * WHY max-age IS SMALL, AND WHY THAT IS NOT A CONTRADICTION.
 * The thing that makes the storefront feel instant is not this header — it is the
 * SPA's own cache (src/lib/queryCache.js), which paints the grid from memory
 * before a request is even considered. What this header controls is how quickly a
 * PRICE EDIT reaches a shopper, and a long max-age is exactly the wrong answer
 * there: it is a window in which the browser will not ask the server no matter
 * what, so an admin's correction sits invisible behind it.
 *
 * So: a short window to collapse bursts, then a conditional GET. The ETag folds
 * in the catalogue version token, which an admin save bumps, so:
 *   • nothing changed → a ~200 byte 304, off the critical path because the page
 *     is already rendered from the SPA cache;
 *   • something changed → new bytes, on the shopper's very next navigation.
 * Nobody is ever told to clear their cache.
 *
 * The heavy bytes — product photos, reels, JS/CSS — are NOT here. Those are
 * content-addressed and cached for a year (ImageController, HomepageVideoController,
 * public/.htaccess). Catalogue JSON is a few tens of KB and is the one thing that
 * has to be right.
 *
 * Never applied to anything personal: the guard below drops any response to a
 * request that carried an Authorization header down to `private, no-store`,
 * belt-and-braces on top of the route-level `cache.private` middleware.
 */
class CacheHeaders
{
    public function handle(Request $request, Closure $next, string $maxAge = '15'): Response
    {
        $response = $next($request);

        // A request that carried credentials can never produce a shared-cacheable
        // response, whatever the route said. Fail closed.
        if ($request->headers->has('Authorization')) {
            return $this->noStore($response);
        }

        // Only plain, successful reads are cacheable. Errors, redirects and
        // writes keep whatever the framework decided.
        if (!$request->isMethodCacheable() || $response->getStatusCode() !== 200) {
            return $response;
        }

        $version = CatalogCache::version();
        $response->headers->set('X-Catalog-Version', $version);

        // A streamed/file response has no in-memory body to hash — those are
        // handled by StaticAssetHeaders instead.
        $content = $response->getContent();
        if (is_string($content) && $content !== '') {
            $response->setEtag(md5($version . '|' . $content));
        }

        $response->setPublic();
        $response->setMaxAge((int) $maxAge);
        // Once the window lapses the browser must ask again rather than guess —
        // and asking is cheap, because the ETag above turns it into a 304.
        $response->headers->addCacheControlDirective('must-revalidate');

        // The CORS layer already varies on Origin; add the encoding so a gzipped
        // and an identity copy can never be served to the wrong client.
        $response->setVary(['Accept-Encoding', 'Origin'], false);

        // Turns the shopper's conditional GET into a 304 with an empty body.
        // Runs last so the ETag above is the one being compared.
        $response->isNotModified($request);

        return $response;
    }

    private function noStore(Response $response): Response
    {
        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        $response->headers->set('Pragma', 'no-cache');

        return $response;
    }
}

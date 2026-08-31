<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The other half of the caching policy: everything personal is explicitly
 * un-cacheable.
 *
 * Applied to every admin route, every customer-authenticated route, the auth
 * endpoints, the saved cart, checkout, order lookup and the PDF/profit routes.
 * Laravel's own default (`no-cache, private`) already stops a shared cache from
 * storing these, but `no-cache` still permits a *stored* copy that gets
 * revalidated — enough for a logged-out shopper on a shared shop counter PC to
 * pull the previous customer's order back out of the back/forward cache.
 * `no-store` is the one that forbids writing it down at all.
 */
class NoStoreHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');

        return $response;
    }
}

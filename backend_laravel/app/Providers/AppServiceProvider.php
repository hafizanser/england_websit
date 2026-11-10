<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Staff app "refresh ERP sales now": its own counter (plain throttle:N,1 shares one
        // counter per caller across every throttled route), 6 per minute per caller.
        RateLimiter::for('erp-sync', fn (Request $request) => Limit::perMinute(6)->by('erp-sync|' . ($request->bearerToken() ? sha1($request->bearerToken()) : $request->ip())));
    }
}

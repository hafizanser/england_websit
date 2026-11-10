<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// England Staff app: copy new/changed Accountrix ERP sales (no-op until ERP_SALES_URL/TOKEN are set).
// Needs the usual Laravel scheduler cron: * * * * * php artisan schedule:run
\Illuminate\Support\Facades\Schedule::command('erp:sync-sales')->everyFiveMinutes()->withoutOverlapping();

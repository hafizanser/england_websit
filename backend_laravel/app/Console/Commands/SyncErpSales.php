<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\ErpSalesSync;
use Illuminate\Console\Command;
use Throwable;

/**
 * php artisan erp:sync-sales [--reconcile]
 *
 * Pull new/changed posted sales from the Accountrix ERP feed into fmcg_erp_sales (the
 * England Staff app's read-only copy). Scheduled every 5 minutes (routes/console.php);
 * the app also refreshes on its own when lists are opened. Read-only towards the ERP.
 */
class SyncErpSales extends Command
{
    protected $signature = 'erp:sync-sales {--reconcile : Also check now for sales deleted in the ERP}';
    protected $description = 'Copy new and changed Accountrix ERP sales for the England Staff app';

    public function handle(ErpSalesSync $sync): int
    {
        if (!$sync->enabled()) {
            $this->warn('ERP sales feed is not configured (ERP_SALES_URL / ERP_SALES_TOKEN). Nothing to do.');
            return self::SUCCESS;
        }
        try {
            $s = $sync->run((bool) $this->option('reconcile'));
        } catch (Throwable $e) {
            $this->error('ERP sync failed: ' . $e->getMessage());
            return self::FAILURE;
        }
        $this->info(sprintf('ERP sales: %d fetched, %d saved, %d removed, %d restored (%d page%s%s).',
            $s['fetched'], $s['upserted'], $s['removed'], $s['restored'], $s['pages'], $s['pages'] === 1 ? '' : 's',
            $s['reconciled'] ? ', deletions checked' : ''));
        return self::SUCCESS;
    }
}

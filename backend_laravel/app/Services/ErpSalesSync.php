<?php

declare(strict_types=1);

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

/**
 * Keeps fmcg_erp_sales — the staff app's read-only copy of posted Accountrix ERP sales —
 * in step with the ERP's feed (GET {ERP}/api/integrations/england/sales*).
 *
 *  - Incremental: the ERP lists sales changed after a cursor (updated_at + id); every
 *    sale is upserted by its ERP id, so a sale is never copied twice and an edit in the
 *    ERP (lines, customer, total) replaces the copy.
 *  - Deletions: the ERP's id list for the last `reconcile_days` is compared with the copy;
 *    a sale the ERP no longer lists is marked erp_removed_at (hidden from the app). The
 *    delivery details and Builty images recorded against it are kept, and it reappears
 *    if the ERP lists it again.
 *  - Read-only towards the ERP; writes only fmcg_erp_sales and fmcg_sync_state here.
 *  - Never throws to a caller that only wants a refresh (maybeRun): an unreachable ERP
 *    leaves the last good copy in place and records the error.
 */
class ErpSalesSync
{
    public const STATE = 'erp_sales';
    private const PAGE = 100;

    public function enabled(): bool
    {
        return $this->url() !== '' && (string) config('fmcg.erp_sales.token') !== '';
    }

    private function url(): string
    {
        return rtrim((string) config('fmcg.erp_sales.url'), '/');
    }

    /** What the app is told about the ERP source (shown when it is off or failing). */
    public function status(): array
    {
        $s = $this->state();
        return [
            'enabled' => $this->enabled(),
            'last_success_at' => $this->iso($s['last_success_at'] ?? null),
            'last_attempt_at' => $this->iso($s['last_attempt_at'] ?? null),
            'ok' => $this->enabled() && empty($s['last_error']),
            'error' => $this->enabled() && !empty($s['last_error']) ? 'erp_unreachable' : null,
        ];
    }

    /** Refresh if the last attempt is older than sync_seconds. Never throws. */
    public function maybeRun(): void
    {
        if (!$this->enabled()) {
            return;
        }
        $s = $this->state();
        $every = max(10, (int) config('fmcg.erp_sales.sync_seconds', 60));
        if (!empty($s['last_attempt_at']) && CarbonImmutable::parse($s['last_attempt_at'], 'UTC')->addSeconds($every)->isFuture()) {
            return;
        }
        try {
            $this->run();
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * One sync run. Returns a summary; throws only when the ERP is unreachable or answers
     * something that is not the feed (after recording the error).
     *
     * @return array{fetched:int, upserted:int, removed:int, restored:int, pages:int, reconciled:bool}
     */
    public function run(bool $forceReconcile = false): array
    {
        if (!$this->enabled()) {
            throw new RuntimeException('ERP sales feed is not configured (ERP_SALES_URL / ERP_SALES_TOKEN).');
        }
        $lock = Cache::lock('fmcg-erp-sales-sync', 120);
        if (!$lock->get()) {
            return ['fetched' => 0, 'upserted' => 0, 'removed' => 0, 'restored' => 0, 'pages' => 0, 'reconciled' => false, 'skipped' => 'running'];
        }
        $summary = ['fetched' => 0, 'upserted' => 0, 'removed' => 0, 'restored' => 0, 'pages' => 0, 'reconciled' => false];
        try {
            $this->saveState(['last_attempt_at' => $this->now()]);
            $state = $this->state();
            $since = (string) ($state['cursor_since'] ?? '');
            $afterId = (int) ($state['cursor_after_id'] ?? 0);
            $maxPages = max(1, (int) config('fmcg.erp_sales.max_pages', 20));

            do {
                $query = ['limit' => self::PAGE] + ($since !== '' ? ['since' => $since, 'after_id' => $afterId] : []);
                $data = $this->get('/api/integrations/england/sales', $query);
                if (!isset($data['sales']) || !is_array($data['sales'])) {
                    throw new RuntimeException('The ERP answered without a sales list.');
                }
                foreach ($data['sales'] as $sale) {
                    $summary['upserted'] += $this->upsert($sale);
                }
                $summary['fetched'] += count($data['sales']);
                $summary['pages']++;
                if (!empty($data['next']['since'])) {
                    $since = (string) $data['next']['since'];
                    $afterId = (int) ($data['next']['after_id'] ?? 0);
                    $this->saveState(['cursor_since' => $since, 'cursor_after_id' => $afterId]);
                }
            } while (!empty($data['has_more']) && $summary['pages'] < $maxPages);

            $last = $state['last_reconciled_at'] ?? null;
            if ($forceReconcile || !$last || CarbonImmutable::parse($last, 'UTC')->addMinutes(10)->isPast()) {
                [$summary['removed'], $summary['restored']] = $this->reconcile();
                $summary['reconciled'] = true;
                $this->saveState(['last_reconciled_at' => $this->now()]);
            }
            $this->saveState(['last_success_at' => $this->now(), 'last_error' => null]);
            return $summary;
        } catch (Throwable $e) {
            $this->saveState(['last_error' => mb_substr($e->getMessage(), 0, 500)]);
            throw $e;
        } finally {
            $lock->release();
        }
    }

    /** Mark copies the ERP no longer lists (within the window) as removed; restore ones it lists again. */
    private function reconcile(): array
    {
        $from = CarbonImmutable::now((string) config('fmcg.business_timezone', 'Asia/Karachi'))
            ->subDays(max(1, (int) config('fmcg.erp_sales.reconcile_days', 120)))->toDateString();
        $data = $this->get('/api/integrations/england/sales/ids', ['from' => $from]);
        if (!isset($data['ids']) || !is_array($data['ids'])) {
            throw new RuntimeException('The ERP answered without an id list.');
        }
        $live = array_flip(array_map('intval', $data['ids']));
        $removed = 0;
        $restored = 0;
        $now = $this->now();
        foreach (DB::table('fmcg_erp_sales')->where('sale_date', '>=', $from)->get(['id', 'erp_sale_id', 'erp_removed_at']) as $row) {
            $listed = isset($live[(int) $row->erp_sale_id]);
            if (!$listed && $row->erp_removed_at === null) {
                DB::table('fmcg_erp_sales')->where('id', $row->id)->update(['erp_removed_at' => $now, 'updated_at' => $now]);
                $removed++;
            } elseif ($listed && $row->erp_removed_at !== null) {
                DB::table('fmcg_erp_sales')->where('id', $row->id)->update(['erp_removed_at' => null, 'updated_at' => $now]);
                $restored++;
            }
        }
        return [$removed, $restored];
    }

    /** Insert or refresh one ERP sale. Returns 1 when a row was written. */
    public function upsert(array $s): int
    {
        $erpId = (int) ($s['id'] ?? 0);
        $invoice = trim((string) ($s['invoice_no'] ?? ''));
        $date = (string) ($s['date'] ?? '');
        if ($erpId <= 0 || $invoice === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return 0; // not a sale this app can show; never guess
        }
        $items = array_values(array_map(fn ($l) => $this->line((array) $l), (array) ($s['items'] ?? [])));
        $now = $this->now();
        $values = [
            'erp_business_id' => isset($s['business_id']) ? (int) $s['business_id'] : null,
            'invoice_no' => mb_substr($invoice, 0, 64),
            'offline_no' => isset($s['offline_no']) && $s['offline_no'] !== '' ? mb_substr((string) $s['offline_no'], 0, 64) : null,
            'sale_date' => $date,
            'erp_status' => mb_substr((string) ($s['status'] ?? 'posted'), 0, 20),
            'net_total' => round((float) ($s['net_total'] ?? 0), 2),
            'erp_customer_id' => isset($s['customer']['id']) ? (int) $s['customer']['id'] : null,
            'customer_name' => $this->str($s['customer']['name'] ?? null, 255),
            'customer_phone' => $this->str($s['customer']['phone'] ?? null, 40),
            'customer_address' => $this->str($s['customer']['address'] ?? null, 255),
            'city' => $this->str($s['city'] ?? null, 120),
            'erp_pandi_name' => $this->str($s['pandi_name'] ?? null, 120),
            'erp_pandi_phone' => $this->str($s['pandi_phone'] ?? null, 40),
            'erp_adda_name' => $this->str($s['adda_name'] ?? null, 120),
            'vehicle' => $this->str($s['vehicle'] ?? null, 120),
            'remarks' => isset($s['remarks']) && $s['remarks'] !== '' ? (string) $s['remarks'] : null,
            'items' => json_encode($items, JSON_UNESCAPED_UNICODE),
            'items_count' => count($items),
            // Lines of other companies on a mixed invoice: not sent, only counted by the ERP.
            'other_company_lines' => max(0, (int) ($s['other_company_lines'] ?? 0)),
            'erp_created_at' => $this->utc($s['created_at'] ?? null),
            'erp_updated_at' => $this->utc($s['updated_at'] ?? null),
            'erp_removed_at' => null,
            'synced_at' => $now,
            'updated_at' => $now,
        ];
        $exists = DB::table('fmcg_erp_sales')->where('erp_sale_id', $erpId)->exists();
        if ($exists) {
            DB::table('fmcg_erp_sales')->where('erp_sale_id', $erpId)->update($values);
        } else {
            DB::table('fmcg_erp_sales')->insert($values + ['erp_sale_id' => $erpId, 'created_at' => $now]);
        }
        return 1;
    }

    /**
     * One ERP line as the app shows it: name, packing and the quantity in the units it was
     * sold in (e.g. "2 CTN + 5 PCS", bonus apart). Prices are not copied.
     */
    private function line(array $l): array
    {
        $packQty = (float) ($l['pack_qty'] ?? 0);
        $unitQty = (float) ($l['unit_qty'] ?? 0);
        $bonus = (float) ($l['bonus_qty'] ?? 0);
        $packUnit = (string) ($l['pack_unit'] ?? '') ?: 'CTN';
        $unit = (string) ($l['unit'] ?? '') ?: 'PCS';
        $parts = [];
        if ($packQty > 0) {
            $parts[] = $this->num($packQty) . ' ' . $packUnit;
        }
        if ($unitQty > 0) {
            $parts[] = $this->num($unitQty) . ' ' . $unit;
        }
        // The main quantity/unit pair keeps the shape of a website order line.
        [$qty, $mainUnit] = $packQty > 0 ? [$packQty, $packUnit] : [$unitQty, $unit];
        // Sold in one of the product's own units (Piece / Box / Carton): show that unit and count,
        // e.g. "2 Carton", not the piece total the ERP keeps for stock.
        $saleUnit = trim((string) ($l['sale_unit'] ?? ''));
        if ($saleUnit !== '' && isset($l['sale_unit_qty'])) {
            $qty = (float) $l['sale_unit_qty'];
            $mainUnit = mb_substr($saleUnit, 0, 30);
            $parts = $qty > 0 ? [$this->num($qty) . ' ' . $mainUnit] : [];
            $unit = 'pcs'; // bonus is always counted in pieces
        }
        return [
            'id' => (int) ($l['id'] ?? 0),
            'name' => (string) ($l['name'] ?? ''),
            'urdu_name' => isset($l['urdu_name']) && $l['urdu_name'] !== '' ? (string) $l['urdu_name'] : null,
            'sub' => (string) ($l['packing'] ?? ''),
            'unit' => $mainUnit,
            'qty' => $this->num($qty),
            'qty_text' => $parts ? implode(' + ', $parts) : '0 ' . $unit,
            'bonus' => $bonus > 0 ? $this->num($bonus) . ' ' . $unit : null,
            'type' => (string) ($l['type'] ?? 'sale'),
        ];
    }

    private function num(float $v): int|float
    {
        return fmod($v, 1.0) === 0.0 ? (int) $v : round($v, 3);
    }

    /** GET a feed endpoint; returns its `data`. */
    private function get(string $path, array $query): array
    {
        $res = Http::withToken((string) config('fmcg.erp_sales.token'))
            ->acceptJson()
            ->timeout(max(2, (int) config('fmcg.erp_sales.timeout', 8)))
            ->get($this->url() . $path, $query);
        if (!$res->successful()) {
            throw new RuntimeException('ERP sales feed answered HTTP ' . $res->status() . '.');
        }
        $json = $res->json();
        if (!is_array($json) || ($json['ok'] ?? null) !== true || !is_array($json['data'] ?? null)) {
            throw new RuntimeException('ERP sales feed answered something that is not the feed.');
        }
        return $json['data'];
    }

    private function state(): array
    {
        $row = DB::table('fmcg_sync_state')->where('name', self::STATE)->first();
        return $row ? (array) $row : [];
    }

    private function saveState(array $values): void
    {
        $now = $this->now();
        if (DB::table('fmcg_sync_state')->where('name', self::STATE)->exists()) {
            DB::table('fmcg_sync_state')->where('name', self::STATE)->update($values + ['updated_at' => $now]);
        } else {
            DB::table('fmcg_sync_state')->insert($values + ['name' => self::STATE, 'created_at' => $now, 'updated_at' => $now]);
        }
    }

    private function now(): string
    {
        return CarbonImmutable::now('UTC')->format('Y-m-d H:i:s');
    }

    private function utc(mixed $v): ?string
    {
        if (!is_string($v) || $v === '') {
            return null;
        }
        try {
            return CarbonImmutable::parse($v)->utc()->format('Y-m-d H:i:s');
        } catch (Throwable) {
            return null;
        }
    }

    private function iso(?string $utc): ?string
    {
        return $utc ? CarbonImmutable::parse($utc, 'UTC')->toIso8601String() : null;
    }

    private function str(mixed $v, int $max): ?string
    {
        $v = trim((string) ($v ?? ''));
        return $v === '' ? null : mb_substr($v, 0, $max);
    }
}

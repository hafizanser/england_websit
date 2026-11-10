<?php

declare(strict_types=1);

namespace App\Repositories;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;

/**
 * Accountrix ERP sales as the England Staff app sees them: the read-only copy in
 * fmcg_erp_sales (kept by App\Services\ErpSalesSync) joined with what the staff app
 * records against a sale in fmcg_erp_sale_deliveries — delivery date, Pandi Name, Adda
 * Name and the Builty front/back images. The ERP itself is never written.
 *
 * Pandi Name / Adda Name: the value saved in the app wins; until one is saved, the
 * value typed on the ERP invoice is shown (and reported as such).
 */
class ErpSaleRepo extends BaseRepo
{
    /** Same column names as fmcg_order_deliveries, so the Builty code is shared. */
    public const SIDES = OrderDeliveryRepo::SIDES;

    public function saleRow(int $id): ?array
    {
        return $this->first('SELECT id, erp_sale_id, invoice_no AS code, erp_status AS status FROM fmcg_erp_sales WHERE id = ? AND erp_removed_at IS NULL LIMIT 1', [$id]);
    }

    public function deliveryRow(int $id): ?array
    {
        return $this->first('SELECT * FROM fmcg_erp_sale_deliveries WHERE erp_sale_id = ? LIMIT 1', [$id]);
    }

    /**
     * Lines of several ERP sales (names and quantities, no prices).
     *
     * @param list<int> $ids
     * @return array<int, list<array>>
     */
    public function linesFor(array $ids): array
    {
        if (!$ids) {
            return [];
        }
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $out = [];
        foreach ($this->select("SELECT id, items FROM fmcg_erp_sales WHERE id IN ({$marks})", $ids) as $r) {
            $out[(int) $r['id']] = $this->lines((string) $r['items']);
        }
        return $out;
    }

    private function lines(string $json): array
    {
        $rows = json_decode($json, true);
        return is_array($rows) ? array_values(array_filter($rows, 'is_array')) : [];
    }

    /** The full sale for the details screen. */
    public function detail(int $id): ?array
    {
        $e = $this->first('SELECT * FROM fmcg_erp_sales WHERE id = ? AND erp_removed_at IS NULL LIMIT 1', [$id]);
        if (!$e) {
            return null;
        }
        $orders = new OrderDeliveryRepo();
        $d = $this->deliveryRow($id) ?? [];
        $items = $this->lines((string) $e['items']);
        $orderDate = (string) $e['sale_date'];
        $appPandi = ($d['pandi_name'] ?? null) ?: null;
        $appAdda = ($d['adda_name'] ?? null) ?: null;
        return [
            'id' => (int) $e['id'],
            'key' => 'erp-' . (int) $e['id'],
            'origin' => 'erp',
            'code' => (string) $e['invoice_no'],
            'status' => (string) $e['erp_status'],
            'source' => 'erp',
            'erp' => [
                'sale_id' => (int) $e['erp_sale_id'],
                'invoice_no' => (string) $e['invoice_no'],
                'offline_no' => $e['offline_no'] ?: null,
                'vehicle' => $e['vehicle'] ?: null,
                'remarks' => $e['remarks'] ?: null,
                'pandi_name' => $e['erp_pandi_name'] ?: null,
                'pandi_phone' => $e['erp_pandi_phone'] ?: null,
                'adda_name' => $e['erp_adda_name'] ?: null,
                'synced_at' => $orders->iso($e['synced_at'] ?? null),
                // >0: the invoice also has other companies' lines, which this app does not show.
                'other_company_lines' => (int) ($e['other_company_lines'] ?? 0),
            ],
            'placed_at' => $orders->iso($e['erp_created_at'] ?? null),
            'order_date' => $orderDate,
            'delivery_date' => ($d['delivery_date'] ?? null) ?: null,
            'effective_date' => (($d['delivery_date'] ?? null) ?: null) ?? $orderDate,
            'today' => $orders->businessToday(),
            // The ERP invoice's own net total for the WHOLE invoice (every line, every company).
            // There is no England-only amount: line prices are not copied from the ERP.
            'total' => round((float) $e['net_total'], 2),
            'total_scope' => 'whole_invoice',
            'note' => $e['remarks'] ?: null,
            'customer' => [
                'name' => (string) ($e['customer_name'] ?? ''),
                'phone' => (string) ($e['customer_phone'] ?? ''),
                'address' => (string) ($e['customer_address'] ?? ''),
                'city' => (string) ($e['city'] ?? ''),
            ],
            'items' => $items,
            'items_count' => count($items),
            'pandi_name' => $appPandi ?? ($e['erp_pandi_name'] ?: null),
            'adda_name' => $appAdda ?? ($e['erp_adda_name'] ?: null),
            'pandi_from_erp' => $appPandi === null && !empty($e['erp_pandi_name']),
            'adda_from_erp' => $appAdda === null && !empty($e['erp_adda_name']),
            'builty' => $this->builtyInfo($id, $d),
            'history' => [],
        ];
    }

    /** Both Builty images with short-lived signed URLs bound to this ERP sale and side. */
    public function builtyInfo(int $id, ?array $d): array
    {
        $sides = [];
        $ttl = (int) config('fmcg.builty_url_minutes', 30);
        foreach (self::SIDES as $side => $col) {
            if (empty($d[$col['path']])) {
                $sides[$side] = ['uploaded' => false];
                continue;
            }
            $path = URL::temporarySignedRoute('app.erp.builty.image', now()->addMinutes($ttl), [
                'id' => $id, 'side' => $side, 'v' => substr((string) $d[$col['sha256']], 0, 12),
            ], false);
            $sides[$side] = [
                'uploaded' => true,
                'path' => $path,
                'url' => url($path),
                'url_expires_at' => now()->addMinutes($ttl)->toIso8601String(),
                'mime' => (string) $d[$col['mime']],
                'size' => (int) $d[$col['size']],
                'width' => (int) $d[$col['width']],
                'height' => (int) $d[$col['height']],
                'uploaded_at' => (new OrderDeliveryRepo())->iso($d[$col['uploaded_at']] ?? null),
            ];
        }
        $count = (int) $sides['front']['uploaded'] + (int) $sides['back']['uploaded'];
        return $sides + ['uploaded_count' => $count, 'complete' => $count === 2];
    }

    public function upsert(int $id, array $values): void
    {
        $now = gmdate('Y-m-d H:i:s');
        DB::transaction(function () use ($id, $values, $now) {
            if ($this->scalar('SELECT 1 FROM fmcg_erp_sale_deliveries WHERE erp_sale_id = ? LIMIT 1', [$id])) {
                DB::table('fmcg_erp_sale_deliveries')->where('erp_sale_id', $id)->update($values + ['updated_at' => $now]);
            } else {
                DB::table('fmcg_erp_sale_deliveries')->insert($values + ['erp_sale_id' => $id, 'created_at' => $now, 'updated_at' => $now]);
            }
        });
    }
}

<?php

declare(strict_types=1);

namespace App\Repositories;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Orders as the England Orders mobile app sees them: the storefront/admin orders
 * (fmcg_orders + fmcg_customers, read-only here) joined with their delivery row
 * (fmcg_order_deliveries: delivery date, Pandi Name, Adda Name, Builty front/back images).
 * Prices are never part of what the staff app receives.
 *
 * "Effective date" = the delivery date when one is set, otherwise the day the order
 * was placed in the business timezone. placed_at is stored in UTC, so a business day
 * becomes a UTC range here; the same SQL then works on MySQL and on SQLite (tests).
 */
class OrderDeliveryRepo extends BaseRepo
{
    public const TABS = ['today', 'tomorrow', 'previous', 'all'];

    private CarbonImmutable $today; // business-day midnight, in the business timezone

    public function __construct(?CarbonImmutable $now = null)
    {
        $tz = (string) config('fmcg.business_timezone', 'Asia/Karachi');
        $this->today = ($now ?? CarbonImmutable::now())->setTimezone($tz)->startOfDay();
    }

    public function businessToday(): string
    {
        return $this->today->toDateString();
    }

    /** One business day as [date, utcStart, utcEnd). */
    private function day(int $offset): array
    {
        $start = $this->today->addDays($offset);
        return [
            $start->toDateString(),
            $start->utc()->format('Y-m-d H:i:s'),
            $start->addDay()->utc()->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * SQL + bindings for "effective date is in this tab", over the combined list `x`.
     * Website orders fall back to the business day they were placed (placed_at is UTC);
     * ERP sales fall back to their invoice date (already a business day).
     */
    private function tabWhere(string $tab): array
    {
        if ($tab === 'today' || $tab === 'tomorrow') {
            [$date, $from, $to] = $this->day($tab === 'today' ? 0 : 1);
            return ["(x.delivery_date = ? OR (x.delivery_date IS NULL AND ((x.kind = 'website' AND x.placed_at >= ? AND x.placed_at < ?) OR (x.kind = 'erp' AND x.base_date = ?))))",
                [$date, $from, $to, $date]];
        }
        if ($tab === 'previous') {
            [$date, $from] = $this->day(0);
            return ["(x.delivery_date < ? OR (x.delivery_date IS NULL AND ((x.kind = 'website' AND x.placed_at < ?) OR (x.kind = 'erp' AND x.base_date < ?))))",
                [$date, $from, $date]];
        }
        return ['1=1', []];
    }

    /** Search, status, slip and date-range filters shared by the list and its counts. */
    private function filterWhere(array $f): array
    {
        $sql = [];
        $b = [];
        $q = trim((string) ($f['q'] ?? ''));
        if ($q !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
            $parts = ['x.customer_name LIKE ?', 'x.code LIKE ?', 'x.customer_phone LIKE ?'];
            array_push($b, $like, $like, $like);
            $digits = preg_replace('/\D/', '', $q) ?? '';
            if (strlen($digits) >= 4) {
                // 0300-1234567, +92 300 1234567 and 3001234567 all find the same customer.
                $tail = strlen($digits) > 10 ? substr($digits, -10) : $digits;
                $parts[] = "REPLACE(REPLACE(REPLACE(x.customer_phone, ' ', ''), '-', ''), '+', '') LIKE ?";
                $b[] = '%' . $tail . '%';
            }
            $sql[] = '(' . implode(' OR ', $parts) . ')';
        }
        // Where the record comes from: the England website (orders) or the Accountrix ERP (sales).
        $origin = (string) ($f['origin'] ?? '');
        if ($origin === 'website' || $origin === 'erp') {
            $sql[] = 'x.kind = ?';
            $b[] = $origin;
        }
        $status = (string) ($f['status'] ?? '');
        if ($status !== '' && $status !== 'all') {
            $sql[] = 'x.status = ?';
            $b[] = $status;
        }
        // Builty filter: "uploaded" = both front and back saved; "pending" = one or both missing.
        $slip = (string) ($f['builty'] ?? $f['slip'] ?? '');
        if ($slip === 'uploaded' || $slip === 'complete') {
            $sql[] = '(x.slip_path IS NOT NULL AND x.builty_back_path IS NOT NULL)';
        } elseif ($slip === 'pending') {
            $sql[] = '(x.slip_path IS NULL OR x.builty_back_path IS NULL)';
        } elseif ($slip === 'partial') {
            $sql[] = '((x.slip_path IS NULL) <> (x.builty_back_path IS NULL))';
        }
        foreach (['from' => '>=', 'to' => '<='] as $key => $op) {
            $v = (string) ($f[$key] ?? '');
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
                continue;
            }
            $tz = (string) config('fmcg.business_timezone', 'Asia/Karachi');
            $day = CarbonImmutable::createFromFormat('Y-m-d', $v, $tz)->startOfDay();
            $edge = ($key === 'from' ? $day : $day->addDay())->utc()->format('Y-m-d H:i:s');
            $placedOp = $key === 'from' ? '>=' : '<';
            $sql[] = "(x.delivery_date {$op} ? OR (x.delivery_date IS NULL AND ((x.kind = 'website' AND x.placed_at {$placedOp} ?) OR (x.kind = 'erp' AND x.base_date {$op} ?))))";
            array_push($b, $v, $edge, $v);
        }
        return [$sql ? implode(' AND ', $sql) : '1=1', $b];
    }

    /**
     * Website orders and ERP sales as one list `x` with the same columns. ERP sales are the
     * staff app's read-only copy (fmcg_erp_sales); ones the ERP no longer lists are left out.
     */
    private const COLS = 'kind, id, code, status, source, placed_at, base_date, total, customer_name, customer_phone, customer_city,
        delivery_date, pandi_name, adda_name, slip_path, slip_uploaded_at, builty_back_path, builty_back_uploaded_at';

    private const FROM = " FROM (
        SELECT 'website' AS kind, o.id, o.code, o.status, o.source, COALESCE(o.placed_at, o.created_at) AS placed_at, NULL AS base_date, o.total,
               c.name AS customer_name, c.phone AS customer_phone, c.city AS customer_city,
               d.delivery_date, d.pandi_name, d.adda_name, d.slip_path, d.slip_uploaded_at, d.builty_back_path, d.builty_back_uploaded_at
          FROM fmcg_orders o
          LEFT JOIN fmcg_customers c ON c.id = o.customer_id
          LEFT JOIN fmcg_order_deliveries d ON d.order_id = o.id
        UNION ALL
        SELECT 'erp' AS kind, e.id, e.invoice_no AS code, e.erp_status AS status, 'erp' AS source, e.erp_created_at AS placed_at, e.sale_date AS base_date, e.net_total AS total,
               e.customer_name, e.customer_phone, e.city AS customer_city,
               ed.delivery_date, COALESCE(ed.pandi_name, e.erp_pandi_name) AS pandi_name, COALESCE(ed.adda_name, e.erp_adda_name) AS adda_name,
               ed.slip_path, ed.slip_uploaded_at, ed.builty_back_path, ed.builty_back_uploaded_at
          FROM fmcg_erp_sales e
          LEFT JOIN fmcg_erp_sale_deliveries ed ON ed.erp_sale_id = e.id
         WHERE e.erp_removed_at IS NULL
    ) x ";

    /** Paginated list for one tab, plus the count of every tab under the same filters. */
    public function paginate(string $tab, array $filters, int $page, int $perPage): array
    {
        $tab = in_array($tab, self::TABS, true) ? $tab : 'today';
        $perPage = max(5, min(50, $perPage));
        $page = max(1, $page);
        [$fSql, $fB] = $this->filterWhere($filters);

        $counts = [];
        foreach (self::TABS as $t) {
            [$tSql, $tB] = $this->tabWhere($t);
            $counts[$t] = (int) $this->scalar('SELECT COUNT(*)' . self::FROM . "WHERE {$tSql} AND {$fSql}", array_merge($tB, $fB));
        }

        [$tSql, $tB] = $this->tabWhere($tab);
        // Previous: most recent day first; the other tabs: newest first. ERP sales use their
        // invoice date as the day; website orders the UTC day they were placed (as before).
        $order = $tab === 'previous'
            ? "COALESCE(x.delivery_date, x.base_date, DATE(x.placed_at)) DESC, x.placed_at DESC, x.id DESC"
            : "COALESCE(x.placed_at, x.base_date) DESC, x.id DESC";
        $rows = $this->select(
            'SELECT ' . self::COLS . self::FROM . "WHERE {$tSql} AND {$fSql} ORDER BY {$order} LIMIT {$perPage} OFFSET " . (($page - 1) * $perPage),
            array_merge($tB, $fB)
        );

        $total = $counts[$tab];
        $webIds = $erpIds = [];
        foreach ($rows as $r) {
            $r['kind'] === 'erp' ? $erpIds[] = (int) $r['id'] : $webIds[] = (int) $r['id'];
        }
        $lines = $this->linesFor($webIds);
        $erpLines = (new ErpSaleRepo())->linesFor($erpIds);
        return [
            'orders' => array_map(fn ($r) => $this->card($r, $r['kind'] === 'erp' ? ($erpLines[(int) $r['id']] ?? []) : ($lines[(int) $r['id']] ?? [])), $rows),
            'meta' => [
                'tab' => $tab, 'page' => $page, 'per_page' => $perPage, 'total' => $total,
                'last_page' => max(1, (int) ceil($total / $perPage)),
                'has_more' => $page * $perPage < $total,
                'today' => $this->businessToday(),
                'timezone' => (string) config('fmcg.business_timezone'),
            ],
            'counts' => $counts,
        ];
    }

    public function placedDate(?string $placedAt): ?string
    {
        if (!$placedAt) {
            return null;
        }
        $tz = (string) config('fmcg.business_timezone', 'Asia/Karachi');
        return CarbonImmutable::parse($placedAt, 'UTC')->setTimezone($tz)->toDateString();
    }

    public function iso(?string $utc): ?string
    {
        return $utc ? CarbonImmutable::parse($utc, 'UTC')->toIso8601String() : null;
    }

    /**
     * The ordered products of several orders in one query: name, pack, unit and
     * quantity only. Prices are never sent to the staff app.
     *
     * @param list<int> $orderIds
     * @return array<int, list<array{id:int,name:string,sub:string,unit:string,qty:int}>>
     */
    private function linesFor(array $orderIds): array
    {
        if (!$orderIds) {
            return [];
        }
        $marks = implode(',', array_fill(0, count($orderIds), '?'));
        $out = [];
        foreach ($this->select("SELECT id, order_id, name, sub, unit, qty FROM fmcg_order_items WHERE order_id IN ({$marks}) ORDER BY order_id, id", $orderIds) as $it) {
            $out[(int) $it['order_id']][] = $this->line($it);
        }
        return $out;
    }

    public function line(array $it): array
    {
        return [
            'id' => (int) $it['id'],
            'name' => (string) $it['name'],
            'sub' => (string) ($it['sub'] ?? ''),
            'unit' => (string) ($it['unit'] ?? ''),
            'qty' => (int) $it['qty'],
        ];
    }

    private function card(array $r, array $items): array
    {
        $erp = ($r['kind'] ?? 'website') === 'erp';
        $placed = $r['placed_at'] ?? $r['created_at'] ?? null;
        $orderDate = $erp ? ($r['base_date'] ?: $this->placedDate($placed)) : $this->placedDate($placed);
        return [
            'id' => (int) $r['id'],
            // Unique across both sources; the app routes on origin + id.
            'key' => ($erp ? 'erp-' : 'web-') . (int) $r['id'],
            'origin' => $erp ? 'erp' : 'website',
            'code' => (string) $r['code'],
            'status' => (string) ($r['status'] ?? ''),
            'source' => (string) ($r['source'] ?? ''),
            'placed_at' => $this->iso($placed),
            'order_date' => $orderDate,
            'delivery_date' => $r['delivery_date'] ?: null,
            'effective_date' => $r['delivery_date'] ?: $orderDate,
            'customer' => [
                'name' => (string) ($r['customer_name'] ?? ''),
                'phone' => (string) ($r['customer_phone'] ?? ''),
                'city' => (string) ($r['customer_city'] ?? ''),
            ],
            'pandi_name' => $r['pandi_name'] ?: null,
            'adda_name' => $r['adda_name'] ?: null,
            'items' => $items,
            'items_count' => count($items),
            'builty' => $this->builtySummary($r),
        ];
    }

    /** Front/back uploaded flags only (the list never carries image URLs). */
    public function builtySummary(array $d): array
    {
        $front = !empty($d['slip_path']);
        $back = !empty($d['builty_back_path']);
        return [
            'front' => ['uploaded' => $front, 'uploaded_at' => $this->iso($d['slip_uploaded_at'] ?? null)],
            'back' => ['uploaded' => $back, 'uploaded_at' => $this->iso($d['builty_back_uploaded_at'] ?? null)],
            'uploaded_count' => (int) $front + (int) $back,
            'complete' => $front && $back,
        ];
    }

    public function orderRow(int $id): ?array
    {
        return $this->first('SELECT id, code, status FROM fmcg_orders WHERE id = ? LIMIT 1', [$id]);
    }

    public function deliveryRow(int $orderId): ?array
    {
        return $this->first('SELECT * FROM fmcg_order_deliveries WHERE order_id = ? LIMIT 1', [$orderId]);
    }

    /** Full order for the details screen: customer, address, products (no prices), delivery, Builty images, history. */
    public function detail(int $id): ?array
    {
        $o = $this->first(
            'SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address, c.city AS customer_city'
            . ' FROM fmcg_orders o LEFT JOIN fmcg_customers c ON c.id = o.customer_id WHERE o.id = ? LIMIT 1',
            [$id]
        );
        if (!$o) {
            return null;
        }
        $d = $this->deliveryRow($id) ?? [];
        $items = (new ShopOrderItemRepo())->byOrder($id);
        $placed = $o['placed_at'] ?? $o['created_at'] ?? null;
        $orderDate = $this->placedDate($placed);
        return [
            'id' => (int) $o['id'],
            'key' => 'web-' . (int) $o['id'],
            'origin' => 'website',
            'code' => (string) $o['code'],
            'status' => (string) $o['status'],
            'source' => (string) ($o['source'] ?? ''),
            'placed_at' => $this->iso($placed),
            'order_date' => $orderDate,
            'delivery_date' => $d['delivery_date'] ?? null,
            'effective_date' => ($d['delivery_date'] ?? null) ?: $orderDate,
            'today' => $this->businessToday(),
            'total' => round((float) ($o['total'] ?? 0), 2),
            'total_scope' => 'order',
            'note' => $o['note'] ?? null,
            'customer' => [
                'name' => (string) ($o['customer_name'] ?? ''),
                'phone' => (string) ($o['customer_phone'] ?? ''),
                'address' => (string) ($o['customer_address'] ?? ''),
                'city' => (string) ($o['customer_city'] ?? ''),
            ],
            'items' => array_map(fn ($it) => $this->line($it), $items),
            'items_count' => count($items),
            'pandi_name' => ($d['pandi_name'] ?? null) ?: null,
            'adda_name' => ($d['adda_name'] ?? null) ?: null,
            'builty' => $this->builtyInfo($id, $d),
            'history' => array_map(fn ($h) => ['status' => $h['status'], 'note' => $h['note'], 'at' => $this->iso($h['created_at'])], $this->select(
                'SELECT status, note, created_at FROM fmcg_order_status_history WHERE order_id = ? ORDER BY id ASC', [$id]
            )),
        ];
    }

    /** DB columns of each Builty side: the front is the original slip_* image. */
    public const SIDES = [
        'front' => ['path' => 'slip_path', 'mime' => 'slip_mime', 'size' => 'slip_size', 'width' => 'slip_width',
            'height' => 'slip_height', 'sha256' => 'slip_sha256', 'uploaded_at' => 'slip_uploaded_at', 'uploaded_by' => 'slip_uploaded_by'],
        'back' => ['path' => 'builty_back_path', 'mime' => 'builty_back_mime', 'size' => 'builty_back_size', 'width' => 'builty_back_width',
            'height' => 'builty_back_height', 'sha256' => 'builty_back_sha256', 'uploaded_at' => 'builty_back_uploaded_at', 'uploaded_by' => 'builty_back_uploaded_by'],
    ];

    /**
     * Both Builty images of one order, each with a short-lived signed URL that only
     * opens that order's image of that side (no file path is ever exposed). The URL
     * carries the image's hash, so a replaced image gets a new address.
     */
    public function builtyInfo(int $orderId, ?array $d): array
    {
        $sides = [];
        foreach (self::SIDES as $side => $col) {
            if (empty($d[$col['path']])) {
                $sides[$side] = ['uploaded' => false];
                continue;
            }
            $ttl = (int) config('fmcg.builty_url_minutes', 30);
            $sides[$side] = [
                'uploaded' => true,
                // Signed over the PATH only (route middleware signed:relative), so the link is valid
                // whatever scheme/host the proxy in front of the API reports. `path` is relative
                // to the API base (the app prefixes its own https base); `url` is the same link absolute.
                'path' => $path = \Illuminate\Support\Facades\URL::temporarySignedRoute('app.builty.image', now()->addMinutes($ttl), [
                    'id' => $orderId, 'side' => $side, 'v' => substr((string) $d[$col['sha256']], 0, 12),
                ], false),
                'url' => url($path),
                'url_expires_at' => now()->addMinutes($ttl)->toIso8601String(),
                'mime' => (string) $d[$col['mime']],
                'size' => (int) $d[$col['size']],
                'width' => (int) $d[$col['width']],
                'height' => (int) $d[$col['height']],
                'uploaded_at' => $this->iso($d[$col['uploaded_at']] ?? null),
            ];
        }
        $count = (int) $sides['front']['uploaded'] + (int) $sides['back']['uploaded'];
        return $sides + ['uploaded_count' => $count, 'complete' => $count === 2];
    }

    /** Create or update the order's delivery row with only the given columns. */
    public function upsert(int $orderId, array $values): void
    {
        $now = gmdate('Y-m-d H:i:s');
        DB::transaction(function () use ($orderId, $values, $now) {
            $exists = $this->scalar('SELECT 1 FROM fmcg_order_deliveries WHERE order_id = ? LIMIT 1', [$orderId]);
            if ($exists) {
                DB::table('fmcg_order_deliveries')->where('order_id', $orderId)->update($values + ['updated_at' => $now]);
            } else {
                DB::table('fmcg_order_deliveries')->insert($values + ['order_id' => $orderId, 'created_at' => $now, 'updated_at' => $now]);
            }
        });
    }
}

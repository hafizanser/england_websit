<?php

declare(strict_types=1);

namespace App\Repositories;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Orders as the England Orders mobile app sees them: the storefront/admin orders
 * (fmcg_orders + fmcg_customers, read-only here) joined with their delivery row
 * (fmcg_order_deliveries: delivery date, Pandi Name, Adda Name, Pandi slip).
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

    /** SQL + bindings for "effective date is in this tab". */
    private function tabWhere(string $tab): array
    {
        if ($tab === 'today' || $tab === 'tomorrow') {
            [$date, $from, $to] = $this->day($tab === 'today' ? 0 : 1);
            return ['(d.delivery_date = ? OR (d.delivery_date IS NULL AND o.placed_at >= ? AND o.placed_at < ?))', [$date, $from, $to]];
        }
        if ($tab === 'previous') {
            [$date, $from] = $this->day(0);
            return ['(d.delivery_date < ? OR (d.delivery_date IS NULL AND o.placed_at < ?))', [$date, $from]];
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
            $parts = ['c.name LIKE ?', 'o.code LIKE ?', 'c.phone LIKE ?'];
            array_push($b, $like, $like, $like);
            $digits = preg_replace('/\D/', '', $q) ?? '';
            if (strlen($digits) >= 4) {
                // 0300-1234567, +92 300 1234567 and 3001234567 all find the same customer.
                $tail = strlen($digits) > 10 ? substr($digits, -10) : $digits;
                $parts[] = "REPLACE(REPLACE(REPLACE(c.phone, ' ', ''), '-', ''), '+', '') LIKE ?";
                $b[] = '%' . $tail . '%';
            }
            $sql[] = '(' . implode(' OR ', $parts) . ')';
        }
        $status = (string) ($f['status'] ?? '');
        if ($status !== '' && $status !== 'all') {
            $sql[] = 'o.status = ?';
            $b[] = $status;
        }
        $slip = (string) ($f['slip'] ?? '');
        if ($slip === 'uploaded') {
            $sql[] = 'd.slip_path IS NOT NULL';
        } elseif ($slip === 'pending') {
            $sql[] = 'd.slip_path IS NULL';
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
            $sql[] = "(d.delivery_date {$op} ? OR (d.delivery_date IS NULL AND o.placed_at {$placedOp} ?))";
            array_push($b, $v, $edge);
        }
        return [$sql ? implode(' AND ', $sql) : '1=1', $b];
    }

    private const FROM = ' FROM fmcg_orders o
        LEFT JOIN fmcg_customers c ON c.id = o.customer_id
        LEFT JOIN fmcg_order_deliveries d ON d.order_id = o.id ';

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
        // Previous: most recent day first; the other tabs: newest order first.
        $order = $tab === 'previous'
            ? 'COALESCE(d.delivery_date, DATE(o.placed_at)) DESC, o.id DESC'
            : 'o.id DESC';
        $rows = $this->select(
            'SELECT o.id, o.code, o.status, o.source, o.total, o.placed_at, o.created_at,
                    c.name AS customer_name, c.phone AS customer_phone, c.city AS customer_city,
                    d.delivery_date, d.pandi_name, d.adda_name, d.slip_path, d.slip_uploaded_at'
            . self::FROM . "WHERE {$tSql} AND {$fSql} ORDER BY {$order} LIMIT {$perPage} OFFSET " . (($page - 1) * $perPage),
            array_merge($tB, $fB)
        );

        $total = $counts[$tab];
        return [
            'data' => array_map(fn ($r) => $this->card($r), $rows),
            'meta' => [
                'tab' => $tab, 'page' => $page, 'per_page' => $perPage, 'total' => $total,
                'last_page' => max(1, (int) ceil($total / $perPage)),
                'today' => $this->businessToday(),
                'timezone' => (string) config('fmcg.business_timezone'),
            ],
            'counts' => $counts,
        ];
    }

    private function placedDate(?string $placedAt): ?string
    {
        if (!$placedAt) {
            return null;
        }
        $tz = (string) config('fmcg.business_timezone', 'Asia/Karachi');
        return CarbonImmutable::parse($placedAt, 'UTC')->setTimezone($tz)->toDateString();
    }

    private function iso(?string $utc): ?string
    {
        return $utc ? CarbonImmutable::parse($utc, 'UTC')->toIso8601String() : null;
    }

    private function card(array $r): array
    {
        $placed = $r['placed_at'] ?? $r['created_at'] ?? null;
        $orderDate = $this->placedDate($placed);
        return [
            'id' => (int) $r['id'],
            'code' => (string) $r['code'],
            'status' => (string) ($r['status'] ?? ''),
            'source' => (string) ($r['source'] ?? ''),
            'total' => (int) ($r['total'] ?? 0),
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
            'slip' => [
                'uploaded' => !empty($r['slip_path']),
                'uploaded_at' => $this->iso($r['slip_uploaded_at'] ?? null),
            ],
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

    /** Full order for the details screen: customer, address, items, totals, delivery, slip, history. */
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
            'code' => (string) $o['code'],
            'status' => (string) $o['status'],
            'source' => (string) ($o['source'] ?? ''),
            'placed_at' => $this->iso($placed),
            'order_date' => $orderDate,
            'delivery_date' => $d['delivery_date'] ?? null,
            'effective_date' => ($d['delivery_date'] ?? null) ?: $orderDate,
            'today' => $this->businessToday(),
            'note' => $o['note'] ?? null,
            'customer' => [
                'name' => (string) ($o['customer_name'] ?? ''),
                'phone' => (string) ($o['customer_phone'] ?? ''),
                'address' => (string) ($o['customer_address'] ?? ''),
                'city' => (string) ($o['customer_city'] ?? ''),
            ],
            'items' => array_map(fn ($it) => [
                'id' => (int) $it['id'],
                'name' => (string) $it['name'],
                'sub' => (string) ($it['sub'] ?? ''),
                'unit' => (string) ($it['unit'] ?? ''),
                'qty' => (int) $it['qty'],
                'unit_price' => (int) $it['unit_price'],
                'line_total' => (int) $it['line_total'],
                'discount' => (int) $it['discount'],
                'net_total' => (int) $it['net_total'],
            ], $items),
            'totals' => [
                'subtotal' => (int) $o['subtotal'],
                'promo_discount' => (int) $o['promo_discount'],
                'promo_code' => $o['promo_code'] ?: null,
                'item_discount' => (int) $o['item_discount'],
                'delivery' => (int) $o['delivery'],
                'total' => (int) $o['total'],
            ],
            // The storefront records no payment details on an order; say so rather than guess.
            'payment' => null,
            'pandi_name' => ($d['pandi_name'] ?? null) ?: null,
            'adda_name' => ($d['adda_name'] ?? null) ?: null,
            'slip' => $this->slipInfo($id, $d),
            'history' => array_map(fn ($h) => ['status' => $h['status'], 'note' => $h['note'], 'at' => $this->iso($h['created_at'])], $this->select(
                'SELECT status, note, created_at FROM fmcg_order_status_history WHERE order_id = ? ORDER BY id ASC', [$id]
            )),
        ];
    }

    public function slipInfo(int $orderId, ?array $d): array
    {
        if (empty($d['slip_path'])) {
            return ['uploaded' => false];
        }
        return [
            'uploaded' => true,
            'url' => '/app/orders/' . $orderId . '/slip?v=' . substr((string) $d['slip_sha256'], 0, 12),
            'mime' => $d['slip_mime'],
            'size' => (int) $d['slip_size'],
            'width' => (int) $d['slip_width'],
            'height' => (int) $d['slip_height'],
            'uploaded_at' => $this->iso($d['slip_uploaded_at'] ?? null),
        ];
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

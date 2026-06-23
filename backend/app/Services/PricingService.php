<?php
declare(strict_types=1);

namespace App\Services;

use App\Models\Offer;
use App\Models\RefProduct;

/**
 * Authoritative cart pricing + offers engine (PHP port of the frontend engine).
 * Delivery is always 0 (no delivery charges per business rule).
 */
class PricingService
{
    private RefProduct $products;
    private Offer $offers;

    public function __construct()
    {
        $this->products = new RefProduct();
        $this->offers = new Offer();
    }

    /**
     * Resolve raw cart rows [{id, qty}] into priced line items.
     * @return array list of resolved items with qty/line totals
     */
    public function hydrate(array $rows): array
    {
        $ids = array_values(array_filter(array_map(fn ($r) => $r['id'] ?? null, $rows)));
        $catalog = $this->products->byStorefrontIds($ids); // keyed by string id
        $items = [];
        foreach ($rows as $r) {
            $id = isset($r['id']) ? (string)$r['id'] : '';
            $qty = max(1, (int)($r['qty'] ?? 1));
            if ($id === '' || !isset($catalog[$id])) {
                continue;
            }
            $p = $catalog[$id];

            // Price by the selected unit type when provided, else the primary.
            $unit = isset($r['unit']) ? (string)$r['unit'] : '';
            $unitLabel = $p['unit'];
            $wholesale = (int)$p['wholesale'];
            $retail = (int)$p['retail'];
            if ($unit !== '' && !empty($p['unitOptions'])) {
                foreach ($p['unitOptions'] as $opt) {
                    if ((string)($opt['unit'] ?? '') === $unit) {
                        $wholesale = (int)$opt['price'];
                        $retail = (int)$opt['retail'];
                        $unitLabel = $opt['label'];
                        break;
                    }
                }
            }

            $items[] = [
                'id'         => $p['id'],
                'name'       => $p['name'],
                'sub'        => $p['sub'],
                'seed'       => $p['seed'],
                'unit'       => $unitLabel,
                'unitKey'    => $unit !== '' ? $unit : $p['unit'],
                'categoryId' => $p['categoryId'],
                'retail'     => $retail,
                'wholesale'  => $wholesale,
                'qty'        => $qty,
                'lineTotal'  => $wholesale * $qty,
                'lineRetail' => $retail * $qty,
            ];
        }
        return $items;
    }

    private function evaluate(array $offer, array $items, int $subtotal): array
    {
        $cfg = $offer['config'] ?? [];
        $find = function (string $pid) use ($items) {
            foreach ($items as $it) {
                if ($it['id'] === $pid) return $it;
            }
            return null;
        };

        switch ($offer['type']) {
            case 'bxgy':
                $group = (int)($cfg['buyQty'] ?? 0) + (int)($cfg['freeQty'] ?? 0);
                $discount = 0;
                foreach (($offer['productIds'] ?? []) as $pid) {
                    $it = $find($pid);
                    if ($it && $group > 0) {
                        $free = intdiv($it['qty'], $group) * (int)$cfg['freeQty'];
                        $discount += $free * $it['wholesale'];
                    }
                }
                return ['applicable' => $discount > 0, 'discount' => $discount];

            case 'percent':
                $min = (int)($cfg['minSubtotal'] ?? 0);
                $base = $subtotal;
                if (!empty($cfg['categoryId'])) {
                    $base = 0;
                    foreach ($items as $it) {
                        if ($it['categoryId'] === $cfg['categoryId']) $base += $it['lineTotal'];
                    }
                }
                $ok = $base > 0 && $subtotal >= $min;
                return [
                    'applicable' => $ok,
                    'discount'   => $ok ? (int)round($base * ($cfg['pct'] ?? 0) / 100) : 0,
                    'reason'     => !$ok ? ($min && $subtotal < $min ? "Min order Rs." . number_format($min) : 'Cart mein eligible items nahi') : null,
                ];

            case 'combo':
                $ids = $offer['productIds'] ?? [];
                $all = count($ids) > 0;
                $base = 0;
                foreach ($ids as $pid) {
                    $it = $find($pid);
                    if (!$it) { $all = false; continue; }
                    $base += $it['lineTotal'];
                }
                return [
                    'applicable' => $all,
                    'discount'   => $all ? (int)round($base * ($cfg['pct'] ?? 0) / 100) : 0,
                    'reason'     => !$all ? 'Bundle ke saare items add karein' : null,
                ];

            default:
                return ['applicable' => false, 'discount' => 0];
        }
    }

    /** Compute the full order summary. */
    public function totals(array $items, ?string $appliedCode = null): array
    {
        $subtotal = array_sum(array_map(fn ($i) => $i['lineTotal'], $items));
        $count = array_sum(array_map(fn ($i) => $i['qty'], $items));
        $lines = [];

        // auto offers: bxgy only (shipping irrelevant — delivery is free)
        foreach ($this->offers->list() as $o) {
            if ($o['type'] !== 'bxgy') continue;
            $r = $this->evaluate($o, $items, $subtotal);
            if ($r['applicable'] && $r['discount'] > 0) {
                $lines[] = ['id' => $o['id'], 'label' => $o['title'], 'note' => $o['save'], 'amount' => $r['discount'], 'auto' => true];
            }
        }

        // manual applied code
        $codeStatus = null;
        if ($appliedCode) {
            $offer = $this->offers->byCode($appliedCode);
            if ($offer && $offer['type'] !== 'shipping') {
                $r = $this->evaluate($offer, $items, $subtotal);
                if ($r['applicable'] && $r['discount'] > 0) {
                    $lines[] = ['id' => $offer['id'], 'label' => $offer['title'], 'note' => $offer['code'], 'amount' => $r['discount'], 'code' => true];
                    $codeStatus = ['ok' => true, 'code' => $offer['code']];
                } else {
                    $codeStatus = ['ok' => false, 'code' => $offer['code'], 'reason' => $r['reason'] ?? 'Yeh code is cart par nahi lagta'];
                }
            } elseif ($offer && $offer['type'] === 'shipping') {
                $codeStatus = ['ok' => true, 'code' => $offer['code']];
            } else {
                $codeStatus = ['ok' => false, 'code' => $appliedCode, 'reason' => 'Yeh code maujood nahi hai'];
            }
        }

        $discount = array_sum(array_map(fn ($l) => $l['amount'], $lines));
        $total = max(0, $subtotal - $discount);
        $savings = array_sum(array_map(fn ($i) => $i['lineRetail'] - $i['lineTotal'], $items)) + $discount;

        return [
            'count'      => $count,
            'subtotal'   => $subtotal,
            'lines'      => $lines,
            'discount'   => $discount,
            'delivery'   => 0,
            'total'      => $total,
            'savings'    => $savings,
            'codeStatus' => $codeStatus,
        ];
    }
}

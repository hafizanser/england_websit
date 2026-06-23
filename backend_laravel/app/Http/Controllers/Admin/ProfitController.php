<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Repositories\ProductRepo;
use App\Repositories\ProfitRepo;
use App\Support\Api;
use Illuminate\Http\Request;

/**
 * Profit Breakdown — internal margin (selling price − production cost) per
 * product, plus order-level profit analytics. Admin token + 4-digit PIN gated.
 */
class ProfitController extends Controller
{
    private const UNIT_PRICE = [
        'cotton' => 'cotton_price', 'box' => 'box_price', 'packet' => 'packet_price',
        'dozen' => 'dozen_price', 'bundle' => 'bundle_price', 'piece' => 'piece_price',
    ];
    private const UNIT_COST = [
        'cotton' => 'production_cotton_price', 'box' => 'production_box_price', 'packet' => 'production_packet_price',
        'dozen' => 'production_dozen_price', 'bundle' => 'production_bundle_price', 'piece' => 'production_piece_price',
    ];
    private const UNIT_LABEL = [
        'cotton' => 'Carton', 'box' => 'Box', 'packet' => 'Packet',
        'dozen' => 'Dozen', 'bundle' => 'Bundle', 'piece' => 'Piece',
    ];

    public function verify(Request $request)
    {
        if (!$this->pinOk($request->input('pin'))) {
            Api::halt('Ghalat PIN', 401);
        }
        return Api::ok(['unlocked' => true]);
    }

    public function index(Request $request)
    {
        $pin = $request->query('pin', $request->input('pin'));
        if (!$this->pinOk($pin)) {
            Api::halt('PIN required', 401);
        }

        $rows = [];
        $totalPotential = 0.0;
        $missingCost = 0;

        foreach ((new ProductRepo())->all() as $p) {
            $units = !empty($p['unit_types']) ? $p['unit_types'] : ['cotton'];
            $lines = [];
            $best = null;

            foreach ($units as $u) {
                if (!isset(self::UNIT_PRICE[$u])) {
                    continue;
                }
                $price = (float) ($p[self::UNIT_PRICE[$u]] ?? 0);
                $cost  = (float) ($p[self::UNIT_COST[$u]] ?? 0);
                if ($price <= 0) {
                    continue;
                }
                $profit = $cost > 0 ? round($price - $cost, 2) : null;
                $margin = ($cost > 0 && $price > 0) ? round((($price - $cost) / $price) * 100, 1) : null;
                $line = [
                    'unit'   => $u,
                    'label'  => self::UNIT_LABEL[$u] ?? ucfirst($u),
                    'price'  => $price,
                    'cost'   => $cost > 0 ? $cost : null,
                    'profit' => $profit,
                    'margin' => $margin,
                ];
                $lines[] = $line;
                if ($best === null || $u === 'cotton') {
                    $best = $line;
                }
            }

            $stock = (float) ($p['total_stock_cotton'] ?? 0);
            $cartonProfit = null;
            foreach ($lines as $l) {
                if ($l['unit'] === 'cotton') {
                    $cartonProfit = $l['profit'];
                }
            }
            $potential = ($cartonProfit !== null && $stock > 0) ? round($cartonProfit * $stock, 2) : 0.0;
            $totalPotential += $potential;
            if ($best && $best['profit'] === null) {
                $missingCost++;
            }

            $rows[] = [
                'id'                => (int) $p['id'],
                'product_name'      => $p['product_name'],
                'category_name'     => $p['category_name'] ?? null,
                'product_image_url' => $p['product_image_url'] ?? null,
                'stock_cartons'     => $stock,
                'headline'          => $best,
                'lines'             => $lines,
                'potential_profit'  => $potential,
            ];
        }

        return Api::ok([
            'data' => $rows,
            'summary' => [
                'products'        => count($rows),
                'total_potential' => round($totalPotential, 2),
                'missing_cost'    => $missingCost,
            ],
        ]);
    }

    public function orders(Request $request)
    {
        $pin = $request->query('pin', $request->input('pin'));
        if (!$this->pinOk($pin)) {
            Api::halt('PIN required', 401);
        }

        $from = $request->query('from');
        $to   = $request->query('to');

        $orders = (new ProfitRepo())->orderList($from, $to);

        $grandProfit  = 0.0;
        $totalRevenue = 0.0;
        $highest      = 0.0;
        foreach ($orders as $o) {
            $grandProfit  += $o['total_profit'];
            $totalRevenue += $o['total_amount'];
            if ($o['total_amount'] > $highest) {
                $highest = $o['total_amount'];
            }
        }
        $count  = count($orders);
        $avg    = $count > 0 ? round($totalRevenue / $count) : 0;
        $margin = $totalRevenue > 0 ? round(($grandProfit / $totalRevenue) * 100, 1) : 0;

        return Api::ok([
            'data' => [
                'orders'  => $orders,
                'summary' => [
                    'grand_profit'    => round($grandProfit, 2),
                    'total_revenue'   => round($totalRevenue, 2),
                    'orders_count'    => $count,
                    'avg_order_value' => $avg,
                    'highest_order'   => $highest,
                    'profit_margin'   => $margin,
                ],
                'from' => $from,
                'to'   => $to,
            ],
        ]);
    }

    public function orderDetail(Request $request, string $id)
    {
        $pin = $request->query('pin', $request->input('pin'));
        if (!$this->pinOk($pin)) {
            Api::halt('PIN required', 401);
        }

        $detail = (new ProfitRepo())->orderDetail((int) $id);
        if ($detail === null) {
            Api::halt('Order nahi mila', 404);
        }
        return Api::ok(['data' => $detail]);
    }

    private function pinOk($pin): bool
    {
        $expected = (string) config('fmcg.profit_pin', '');
        return $expected !== '' && hash_equals($expected, (string) $pin);
    }
}

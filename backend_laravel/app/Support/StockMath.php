<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Server-side mirror of the frontend stock utility `src/lib/pack.js` — the ONE
 * shared unit-conversion + stock-pool logic. Keep in EXACT sync with pack.js
 * (unitBase / basePieces / totalStockPieces / committedPieces).
 *
 * Model: main-unit stock (`total_stock_cotton`, measured in Cartons) is the single
 * source of truth. Every sellable unit (Carton, Box, Bundle, Packet, Dozen, Piece)
 * resolves to ONE shared base so a product's units all draw from the same pool:
 *     total base = mainStock × basePerMain
 *     committed  = Σ unitBase(unit) × qty      (across ALL units of the product)
 *     an order is valid  ⇔  committed ≤ total base
 *     cartons consumed   =  committed ÷ basePerMain
 */
class StockMath
{
    /** Mirror of cartEngine.js `unitLabelFor` — maps a unit KEY or LABEL to a label. */
    public static function unitLabel($u): string
    {
        $map = [
            'pc' => 'Piece', 'piece' => 'Piece', 'box' => 'Box', 'carton' => 'Carton',
            'cotton' => 'Carton', 'packet' => 'Packet', 'dozen' => 'Dozen', 'bundle' => 'Bundle',
        ];
        $key = strtolower(trim((string) $u));
        if (isset($map[$key])) {
            return $map[$key];
        }
        return $key !== '' ? (string) $u : 'Unit';
    }

    /**
     * Size of ONE unit in the product's smallest shared base — mirror of pack.js
     * `unitBase` (including the Bundle/Packet degrade-to-1 rule so secondary units
     * without piece data still share the carton's base).
     */
    public static function unitBase($unitKey, array $conv): int
    {
        $ppb = (int) ($conv['piecesPerBox'] ?? 0);
        $bpc = (int) ($conv['boxesPerCarton'] ?? 0);
        switch (self::unitLabel($unitKey)) {
            case 'Carton':
                if ($ppb && $bpc) {
                    return $ppb * $bpc;
                }
                if ((int) ($conv['piecesPerCarton'] ?? 0)) {
                    return (int) $conv['piecesPerCarton'];
                }
                if ($bpc) {
                    $sec = max((int) ($conv['piecesPerBundle'] ?? 0), (int) ($conv['piecesPerPacket'] ?? 0));
                    return $sec ? $bpc * $sec : $bpc;
                }
                return 0;
            case 'Box':
                return $ppb ?: ($bpc ? 1 : 0);
            case 'Packet':
                return ((int) ($conv['piecesPerPacket'] ?? 0)) ?: ($bpc ? 1 : 0);
            case 'Bundle':
                return ((int) ($conv['piecesPerBundle'] ?? 0)) ?: ($bpc ? 1 : 0);
            case 'Dozen':
                return ((int) ($conv['piecesPerDozen'] ?? 0)) ?: 12;
            case 'Piece':
                return 1;
            default:
                return 0;
        }
    }

    /**
     * Base units contained in the product's largest (main) unit — mirror of pack.js
     * `basePieces`: max unitBase across the product's sellable units, seeded with the
     * carton. `$unitKeys` are the product's unitOptions unit keys.
     */
    public static function basePerMain(array $conv, array $unitKeys): int
    {
        $max = self::unitBase('carton', $conv);
        foreach ($unitKeys as $u) {
            $b = self::unitBase($u, $conv);
            if ($b > $max) {
                $max = $b;
            }
        }
        return $max;
    }

    /** Total available base units for a product = mainStock × basePerMain (0 = no conversion). */
    public static function totalBase(float $stock, array $conv, array $unitKeys): float
    {
        if ($stock <= 0) {
            return 0.0;
        }
        $base = self::basePerMain($conv, $unitKeys);
        return $base > 0 ? $stock * $base : 0.0;
    }

    /**
     * Base units committed by a product's cart/order lines.
     *   $lines: [ ['unitKey' => 'bundle', 'qty' => 3], ... ]  ('unit' accepted too)
     */
    public static function committedBase(array $lines, array $conv): float
    {
        $sum = 0.0;
        foreach ($lines as $l) {
            $unit = $l['unitKey'] ?? ($l['unit'] ?? '');
            $sum += self::unitBase($unit, $conv) * (int) ($l['qty'] ?? 0);
        }
        return $sum;
    }
}

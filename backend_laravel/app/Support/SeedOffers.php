<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Canonical seeded promo offers (ported from the legacy database/data.php +
 * Models\Offer). These are the manual promo CODES (COMBO14, PEHLA7, FREESHIP,
 * ...) and the storefront /offers fallback when the admin dashboard has no
 * active product deals. Shape matches the legacy Offer::cast() output.
 */
class SeedOffers
{
    /** @return array<int,array> all active offers in storefront shape */
    public static function list(): array
    {
        return array_values(array_filter(self::raw(), fn ($o) => ($o['active'] ?? 1) == 1));
    }

    public static function byCode(string $code): ?array
    {
        $code = strtoupper(trim($code));
        foreach (self::list() as $o) {
            if (strtoupper((string) ($o['code'] ?? '')) === $code) {
                return $o;
            }
        }
        return null;
    }

    public static function bySlug(string $slug): ?array
    {
        foreach (self::list() as $o) {
            if (($o['slug'] ?? '') === $slug) {
                return $o;
            }
        }
        return null;
    }

    /** Hero (featured 'lg') + up to two side cards ('sm'). */
    public static function featured(): array
    {
        $all = self::list();
        $hero = null;
        $sides = [];
        foreach ($all as $o) {
            if (($o['featured'] ?? null) === 'lg' && !$hero) {
                $hero = $o;
            } elseif (($o['featured'] ?? null) === 'sm') {
                $sides[] = $o;
            }
        }
        if (!$hero && $all) {
            $hero = $all[0];
        }
        return ['hero' => $hero, 'sides' => array_slice($sides, 0, 2)];
    }

    /** Build one offer in the legacy cast() shape (raw columns + decoded aliases). */
    private static function make(array $o): array
    {
        $o['productIds'] = $o['product_ids'] ?? [];
        $o['save'] = $o['save_label'] ?? '';
        $o['desc'] = $o['description'] ?? '';
        $o['active'] = (int) ($o['active'] ?? 1);
        $o['terms'] = $o['terms'] ?? [];
        $o['config'] = $o['config'] ?? [];
        return $o;
    }

    /** @return array<int,array> */
    private static function raw(): array
    {
        return array_map([self::class, 'make'], [
            [
                'id' => 'o-combo', 'slug' => 'soap-shampoo-combo', 'type' => 'combo', 'featured' => 'lg',
                'kicker' => 'Carton Bundle', 'tag' => 'Most Popular', 'title' => 'Soap + Shampoo Combo',
                'description' => 'Saaf soap ka carton + Silkaara shampoo ka carton — ek saath len, 14% bachayein.',
                'save_label' => 'Bachat 14%', 'code' => 'COMBO14', 'seed' => 'soap-shampoo-combo',
                'theme' => 'from-brand-800 to-brand-600', 'product_ids' => ['p14', 'p6'], 'config' => ['pct' => 14],
                'expiry' => '30 June tak', 'active' => 1,
                'terms' => ['Dono carton cart mein hone par discount lagega.', 'Discount sirf in do products par.', 'Doosri offers ke sath jama nahi hoga.'],
            ],
            [
                'id' => 'o-first', 'slug' => 'pehla-order-7', 'type' => 'percent', 'featured' => 'sm',
                'kicker' => 'Naya Account', 'tag' => 'New Shops', 'title' => 'Pehla Order 7% Off',
                'description' => 'Nayi dukaan? Pehli khareed par foran 7% chhoot — minimum Rs.3,000.',
                'save_label' => '7% OFF', 'code' => 'PEHLA7', 'seed' => 'new-shop-offer',
                'theme' => 'from-saffron-600 to-saffron-400', 'product_ids' => [], 'config' => ['pct' => 7, 'minSubtotal' => 3000],
                'expiry' => 'Hamesha (naye account)', 'active' => 1,
                'terms' => ['Sirf pehle order par.', 'Minimum order Rs.3,000.', 'Code: PEHLA7 apply karein.'],
            ],
            [
                'id' => 'o-ship', 'slug' => 'free-delivery-5000', 'type' => 'shipping', 'featured' => 'sm',
                'kicker' => 'Free Delivery', 'tag' => '47 Cities', 'title' => 'Free Delivery 5,000+ Par',
                'description' => '47 shehron mein Rs.5,000 se upar ke order par muft home delivery.',
                'save_label' => 'Rs.0 delivery', 'code' => 'FREESHIP', 'seed' => 'free-delivery-van',
                'theme' => 'from-brand-700 to-brand-500', 'product_ids' => [], 'config' => ['minSubtotal' => 5000],
                'expiry' => 'Hamesha', 'active' => 1,
                'terms' => ['Order Rs.5,000+ hona chahiye.', 'Apne aap apply ho jata hai.'],
            ],
            [
                'id' => 'o-agarbati', 'slug' => 'agarbati-10-plus-1', 'type' => 'bxgy', 'featured' => null,
                'kicker' => 'Eid Special', 'tag' => 'Limited', 'title' => 'Khushboo Agarbati 10 + 1 Free',
                'description' => 'Khushboo Gulab agarbati ke har 10 pack par 1 pack bilkul muft.',
                'save_label' => '10 + 1 Free', 'code' => 'AGAR10', 'seed' => 'agarbati-incense-pack',
                'theme' => 'from-brand-900 to-brand-700', 'product_ids' => ['p9'], 'config' => ['buyQty' => 10, 'freeQty' => 1],
                'expiry' => 'Stock khatam hone tak', 'active' => 1,
                'terms' => ['Sirf Khushboo Gulab Agarbati par.', 'Har 10 pack par 1 free.', 'Cart mein khud-ba-khud.'],
            ],
            [
                'id' => 'o-baby', 'slug' => 'baby-care-bundle', 'type' => 'combo', 'featured' => null,
                'kicker' => 'Baby Care', 'tag' => 'High Margin', 'title' => 'Nanha Baby Bundle',
                'description' => 'Diapers + wipes + lotion ek saath — 12% off poore Nanha bundle par.',
                'save_label' => 'Bachat 12%', 'code' => 'NANHA12', 'seed' => 'baby-care-products',
                'theme' => 'from-saffron-700 to-saffron-500', 'product_ids' => ['p19', 'p20', 'p21'], 'config' => ['pct' => 12],
                'expiry' => '15 July tak', 'active' => 1,
                'terms' => ['Teeno Nanha products cart mein hone chahiye.', 'Discount in teen lines par.'],
            ],
            [
                'id' => 'o-razor', 'slug' => 'razor-bachat', 'type' => 'percent', 'featured' => null,
                'kicker' => 'Bulk Bachat', 'tag' => 'Bulk Deal', 'title' => 'Tez Razor Bulk — 10% Off',
                'description' => 'Rs.4,000+ ke razor order par 10% off. Mota margin, tez bikri.',
                'save_label' => '10% OFF', 'code' => 'TEZ10', 'seed' => 'twin-blade-razor',
                'theme' => 'from-brand-800 to-brand-600', 'product_ids' => ['p22', 'p23'], 'config' => ['pct' => 10, 'minSubtotal' => 4000, 'categoryId' => 'razors'],
                'expiry' => '30 June tak', 'active' => 1,
                'terms' => ['Razor category par Rs.4,000+ order.', 'Code: TEZ10.'],
            ],
        ]);
    }
}

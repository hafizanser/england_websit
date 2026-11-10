<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Services\ErpSalesSync;
use Carbon\CarbonImmutable;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Accountrix ERP sales in the England Staff app: the sync from the ERP feed (faked here
 * with the feed's exact response shape), the combined website + ERP lists and tabs, the
 * ERP sale details, delivery/Pandi/Adda saving and Builty images for ERP sales.
 * Throw-away SQLite database with clearly labelled TEST records only.
 */
class ErpSalesAppTest extends TestCase
{
    use RefreshDatabase;

    private const ERP = 'https://erp.test/accountrix_erp';
    private const TOKEN = 'erp-feed-test-token';

    private string $slips;
    /** @var array<int, array> ERP sales the fake feed serves, by ERP id */
    private array $erpSales = [];
    private int $webToday;
    private bool $erpDown = false;

    protected function setUp(): void
    {
        parent::setUp();
        if (!Schema::hasTable('personal_access_tokens')) {
            Schema::create('personal_access_tokens', function (Blueprint $t) {
                $t->id();
                $t->morphs('tokenable');
                $t->text('name');
                $t->string('token', 64)->unique();
                $t->text('abilities')->nullable();
                $t->timestamp('last_used_at')->nullable();
                $t->timestamp('expires_at')->nullable()->index();
                $t->timestamps();
            });
        }
        $this->slips = sys_get_temp_dir() . '/slips-erp-' . uniqid();
        config([
            'fmcg.slips_path' => $this->slips, 'fmcg.business_timezone' => 'Asia/Karachi',
            'fmcg.erp_sales.url' => self::ERP, 'fmcg.erp_sales.token' => self::TOKEN,
            'fmcg.erp_sales.sync_seconds' => 60, 'fmcg.erp_sales.reconcile_days' => 120,
        ]);
        // 10:00 in Karachi on 4 Nov 2026.
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-04 05:00:00', 'UTC'));
        Admin::create(['username' => 'teamlead', 'password' => password_hash('secret-pass', PASSWORD_DEFAULT), 'role' => 'admin']);

        // One TEST website order placed today.
        $c = DB::table('fmcg_customers')->insertGetId(['name' => 'TEST Website Customer', 'phone' => '03001234567', 'address' => 'Shop 1', 'city' => 'Lahore']);
        $this->webToday = DB::table('fmcg_orders')->insertGetId(['code' => 'TMP', 'customer_id' => $c, 'status' => 'pending',
            'subtotal' => 5000, 'promo_discount' => 0, 'item_discount' => 0, 'delivery' => 0, 'total' => 5000,
            'source' => 'website', 'placed_at' => '2026-11-04 03:00:00', 'created_at' => '2026-11-04 03:00:00', 'updated_at' => '2026-11-04 03:00:00']);
        DB::table('fmcg_orders')->where('id', $this->webToday)->update(['code' => 'ENG-' . (1000 + $this->webToday)]);
        DB::table('fmcg_order_items')->insert(['order_id' => $this->webToday, 'product_id' => '7', 'name' => 'England Classic Razer', 'unit' => 'Carton',
            'qty' => 2, 'unit_price' => 2500, 'line_total' => 5000, 'discount' => 0]);

        // TEST ERP sales: today, tomorrow-dated, last week.
        $this->erpSales = [
            501 => $this->erpSale(501, 'TEST-INV-501', '2026-11-04', '2026-11-04 09:10:00'),
            502 => $this->erpSale(502, 'TEST-INV-502', '2026-11-05', '2026-11-04 09:20:00'),
            503 => $this->erpSale(503, 'TEST-INV-503', '2026-10-28', '2026-10-28 15:00:00'),
        ];
        Http::fake(fn (HttpRequest $r) => $this->feed($r));
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->slips);
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    /** One sale exactly as the ERP feed sends it (EnglandSalesController::load). */
    private function erpSale(int $id, string $invoice, string $date, string $updatedLocal): array
    {
        return [
            'id' => $id, 'business_id' => 1, 'invoice_no' => $invoice, 'offline_no' => null, 'date' => $date, 'status' => 'posted',
            'net_total' => 12345.5, 'gross_total' => 12345.5, 'totals_scope' => 'whole_invoice', 'lines_on_invoice' => 1, 'other_company_lines' => 0,
            'customer' => ['id' => 77, 'name' => 'TEST ERP Kiryana ' . $id, 'phone' => '03217654321', 'address' => 'Akbari Mandi'],
            'city' => 'Multan', 'pandi_name' => 'TEST ERP Pandi', 'pandi_phone' => '03001112233', 'adda_name' => 'TEST ERP Adda',
            'vehicle' => null, 'remarks' => null,
            'created_at' => CarbonImmutable::parse($updatedLocal, 'Asia/Karachi')->toIso8601String(),
            'updated_at' => CarbonImmutable::parse($updatedLocal, 'Asia/Karachi')->toIso8601String(),
            'posted_at' => null,
            'items' => [
                ['id' => $id * 10 + 1, 'item_id' => 9, 'code' => null, 'name' => 'England Today Razor', 'urdu_name' => 'ٹوڈے ریزر', 'company_id' => 173,
                    'type' => 'sale', 'packing' => '48 pcs/box', 'pack_unit' => 'CTN', 'unit' => 'PCS', 'pack_to_unit' => 576,
                    'pack_qty' => 2, 'unit_qty' => 5, 'bonus_qty' => 3, 'base_qty' => 1160],
            ],
            '_cursor' => $updatedLocal,
        ];
    }

    /** The fake ERP feed, honouring the token, the cursor and the id list. */
    private function feed(HttpRequest $r)
    {
        if ($this->erpDown) {
            return Http::response('Service Unavailable', 503);
        }
        if (($r->header('Authorization')[0] ?? '') !== 'Bearer ' . self::TOKEN) {
            return Http::response(['ok' => false, 'error' => 'Invalid integration token'], 401);
        }
        $url = parse_url($r->url());
        parse_str($url['query'] ?? '', $q);
        $sales = collect($this->erpSales)->sortBy([['_cursor', 'asc'], ['id', 'asc']])->values();
        if (str_ends_with($url['path'], '/sales/ids')) {
            $ids = $sales->filter(fn ($s) => $s['date'] >= $q['from'])->pluck('id')->sort()->values()->all();
            return Http::response(['ok' => true, 'data' => ['from' => $q['from'], 'ids' => $ids, 'count' => count($ids)]]);
        }
        $since = $q['since'] ?? '';
        $after = (int) ($q['after_id'] ?? 0);
        $page = $sales->filter(fn ($s) => $since === '' || $s['_cursor'] > $since || ($s['_cursor'] === $since && $s['id'] > $after))->values();
        $limit = (int) ($q['limit'] ?? 100);
        $out = $page->take($limit);
        $last = $out->last();
        return Http::response(['ok' => true, 'data' => [
            'sales' => $out->map(fn ($s) => array_diff_key($s, ['_cursor' => 1]))->all(),
            'has_more' => $page->count() > $limit,
            'next' => $last ? ['since' => $last['_cursor'], 'after_id' => $last['id']] : null,
            'server_time' => now()->toIso8601String(),
        ]]);
    }

    private function token(): string
    {
        return $this->postJson('/app/auth/login', ['username' => 'teamlead', 'password' => 'secret-pass'])->assertOk()->json('data.token');
    }

    private function photo(): UploadedFile
    {
        $tmp = tempnam(sys_get_temp_dir(), 'slip');
        copy(__DIR__ . '/../fixtures/slips/1200x1600.jpg', $tmp);
        return new UploadedFile($tmp, 'builty.jpg', null, null, true);
    }

    private function localId(int $erpId): int
    {
        return (int) DB::table('fmcg_erp_sales')->where('erp_sale_id', $erpId)->value('id');
    }

    public function test_sync_copies_erp_sales_once_and_follows_edits_and_deletions(): void
    {
        $sync = new ErpSalesSync();
        $s = $sync->run();
        $this->assertSame(3, $s['fetched']);
        $this->assertSame(3, DB::table('fmcg_erp_sales')->count());
        $row = DB::table('fmcg_erp_sales')->where('erp_sale_id', 501)->first();
        $this->assertSame('TEST-INV-501', $row->invoice_no);
        $this->assertSame('2026-11-04', substr((string) $row->sale_date, 0, 10));
        $this->assertSame('2026-11-04 04:10:00', (string) $row->erp_created_at); // 09:10 PKT stored as UTC
        $this->assertEquals(12345.5, (float) $row->net_total);
        $this->assertSame('TEST ERP Kiryana 501', $row->customer_name);
        $line = json_decode($row->items, true)[0];
        $this->assertSame(['England Today Razor', '2 CTN + 5 PCS', '3 PCS', 'CTN', 2], [$line['name'], $line['qty_text'], $line['bonus'], $line['unit'], $line['qty']]);

        // Run again: nothing new, nothing duplicated, never a website order.
        $this->assertSame(0, $sync->run()['fetched']);
        $this->assertSame(3, DB::table('fmcg_erp_sales')->count());
        $this->assertSame(1, DB::table('fmcg_orders')->count());

        // Edited in the ERP → the copy follows (same row).
        $this->erpSales[502]['net_total'] = 999.0;
        $this->erpSales[502]['customer']['name'] = 'TEST ERP Kiryana renamed';
        $this->erpSales[502]['_cursor'] = '2026-11-04 09:40:00';
        $this->assertSame(1, $sync->run()['fetched']);
        $this->assertSame(3, DB::table('fmcg_erp_sales')->count());
        $this->assertSame('TEST ERP Kiryana renamed', DB::table('fmcg_erp_sales')->where('erp_sale_id', 502)->value('customer_name'));

        // Deleted in the ERP → hidden (copy kept), then back if the ERP lists it again.
        $deleted = $this->erpSales[503];
        unset($this->erpSales[503]);
        $s = $sync->run(true);
        $this->assertSame(1, $s['removed']);
        $this->assertNotNull(DB::table('fmcg_erp_sales')->where('erp_sale_id', 503)->value('erp_removed_at'));
        $this->erpSales[503] = $deleted;
        $this->assertSame(1, $sync->run(true)['restored']);
        $this->assertNull(DB::table('fmcg_erp_sales')->where('erp_sale_id', 503)->value('erp_removed_at'));
    }

    public function test_lists_combine_website_orders_and_erp_sales_by_delivery_date(): void
    {
        $t = $this->token();
        $get = fn ($q) => $this->withHeader('Authorization', 'Bearer ' . $t)->getJson('/app/orders?' . $q)->assertOk();

        // Opening a list pulls the ERP sales in — nobody has to add them.
        $r = $get('tab=today');
        $this->assertSame(['today' => 2, 'tomorrow' => 1, 'previous' => 1, 'all' => 4], $r->json('data.counts'));
        $this->assertTrue($r->json('data.sources.erp.enabled'));
        $this->assertTrue($r->json('data.sources.erp.ok'));
        $keys = array_column($r->json('data.orders'), 'key');
        $this->assertEqualsCanonicalizing(['web-' . $this->webToday, 'erp-' . $this->localId(501)], $keys);
        $erp = collect($r->json('data.orders'))->firstWhere('origin', 'erp');
        $this->assertSame('TEST-INV-501', $erp['code']);
        $this->assertSame('2026-11-04', $erp['order_date']);
        $this->assertNull($erp['delivery_date']);
        $this->assertSame('TEST ERP Pandi', $erp['pandi_name']);
        $this->assertSame(['name' => 'TEST ERP Kiryana 501', 'phone' => '03217654321', 'city' => 'Multan'], $erp['customer']);
        $this->assertSame('2 CTN + 5 PCS', $erp['items'][0]['qty_text']);
        $web = collect($r->json('data.orders'))->firstWhere('origin', 'website');
        $this->assertSame('ENG-' . (1000 + $this->webToday), $web['code']);

        $this->assertSame(['TEST-INV-502'], array_column($get('tab=tomorrow')->json('data.orders'), 'code'));
        $this->assertSame(['TEST-INV-503'], array_column($get('tab=previous')->json('data.orders'), 'code'));

        // Source filter and pagination.
        $this->assertSame(3, $get('tab=all&origin=erp')->json('data.meta.total'));
        $this->assertSame(1, $get('tab=all&origin=website')->json('data.meta.total'));
        $p1 = $get('tab=all&per_page=5&page=1');
        $this->assertSame(4, $p1->json('data.meta.total'));
        $this->assertFalse($p1->json('data.meta.has_more'));
        $this->assertSame(['TEST-INV-501'], array_column($get('tab=all&q=INV-501')->json('data.orders'), 'code'));

        // A delivery date set in the app moves an ERP sale between tabs; the ERP date is kept.
        $id = $this->localId(503);
        $this->withHeader('Authorization', 'Bearer ' . $t)->patchJson("/app/erp-sales/{$id}/delivery", ['delivery_date' => '2026-11-04', 'order_code' => 'TEST-INV-503'])->assertOk();
        $this->assertContains('TEST-INV-503', array_column($get('tab=today')->json('data.orders'), 'code'));
        $this->assertSame('2026-10-28', substr((string) DB::table('fmcg_erp_sales')->where('id', $id)->value('sale_date'), 0, 10));
    }

    public function test_erp_sale_details_and_delivery_fields_are_saved_in_the_app_only(): void
    {
        (new ErpSalesSync())->run();
        $t = $this->token();
        $h = ['Authorization' => 'Bearer ' . $t];
        $id = $this->localId(501);

        $o = $this->withHeaders($h)->getJson("/app/erp-sales/{$id}")->assertOk()->json('data.order');
        $this->assertSame('erp', $o['origin']);
        $this->assertSame('TEST-INV-501', $o['code']);
        $this->assertSame(501, $o['erp']['sale_id']);
        $this->assertEquals(12345.5, $o['total']);
        $this->assertSame('Akbari Mandi', $o['customer']['address']);
        $this->assertSame('TEST ERP Pandi', $o['pandi_name']);
        $this->assertTrue($o['pandi_from_erp']);

        // Wrong invoice number → refused, nothing saved.
        $this->withHeaders($h)->patchJson("/app/erp-sales/{$id}/delivery", ['pandi_name' => 'X', 'order_code' => 'TEST-INV-502'])->assertStatus(409);
        $this->assertSame(0, DB::table('fmcg_erp_sale_deliveries')->count());

        $o = $this->withHeaders($h)->patchJson("/app/erp-sales/{$id}/delivery", ['delivery_date' => '2026-11-06', 'pandi_name' => 'TEST App Pandi', 'adda_name' => 'TEST App Adda', 'order_code' => 'TEST-INV-501'])
            ->assertOk()->json('data.order');
        $this->assertSame(['2026-11-06', 'TEST App Pandi', 'TEST App Adda', false], [$o['delivery_date'], $o['pandi_name'], $o['adda_name'], $o['pandi_from_erp']]);
        $this->assertSame('TEST ERP Pandi', $o['erp']['pandi_name']); // ERP's own value still shown as the ERP's
        // A later sync never overwrites what the app saved.
        $this->erpSales[501]['_cursor'] = '2026-11-04 09:50:00';
        $this->erpSales[501]['pandi_name'] = 'TEST ERP Pandi 2';
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-04 05:10:00', 'UTC'));
        (new ErpSalesSync())->run();
        $o = $this->withHeaders($h)->getJson("/app/erp-sales/{$id}")->assertOk()->json('data.order');
        $this->assertSame(['TEST App Pandi', '2026-11-06'], [$o['pandi_name'], $o['delivery_date']]);
        // Website orders untouched; id spaces kept apart.
        $this->assertSame(0, DB::table('fmcg_order_deliveries')->count());
        $this->withHeaders($h)->getJson('/app/erp-sales/999999')->assertNotFound();
    }

    public function test_a_mixed_invoice_shows_only_england_lines_and_marks_the_total_as_the_whole_invoice(): void
    {
        // The ERP feed sends only England lines of a mixed invoice and counts the rest.
        $mixed = $this->erpSale(504, 'TEST-INV-504', '2026-11-04', '2026-11-04 09:30:00');
        $mixed['lines_on_invoice'] = 3;
        $mixed['other_company_lines'] = 2;
        $mixed['net_total'] = 40100.0;
        $this->erpSales[504] = $mixed;
        (new ErpSalesSync())->run();
        $h = ['Authorization' => 'Bearer ' . $this->token()];
        $id = $this->localId(504);

        $o = $this->withHeaders($h)->getJson("/app/erp-sales/{$id}")->assertOk()->json('data.order');
        $this->assertSame(['England Today Razor'], array_column($o['items'], 'name'));
        $this->assertSame(2, $o['erp']['other_company_lines']);
        $this->assertSame('whole_invoice', $o['total_scope']);
        $this->assertEquals(40100.0, $o['total']);   // the ERP invoice's own figure, not an England-only guess
        $card = collect($this->withHeaders($h)->getJson('/app/orders?tab=all&origin=erp')->assertOk()->json('data.orders'))->firstWhere('id', $id);
        $this->assertSame(1, $card['items_count']);
        $this->assertArrayNotHasKey('total', $card);

        // A plain England invoice: nothing left out.
        $plain = $this->withHeaders($h)->getJson('/app/erp-sales/' . $this->localId(501))->assertOk()->json('data.order');
        $this->assertSame(0, $plain['erp']['other_company_lines']);
        // Website orders keep their own order total.
        $this->assertSame('order', $this->withHeaders($h)->getJson('/app/orders/' . $this->webToday)->assertOk()->json('data.order.total_scope'));
    }

    public function test_builty_images_attach_to_the_exact_erp_sale(): void
    {
        (new ErpSalesSync())->run();
        $t = $this->token();
        $h = ['Authorization' => 'Bearer ' . $t];
        $id = $this->localId(502);

        $this->withHeaders($h)->post("/app/erp-sales/{$id}/builty/front", ['order_code' => 'TEST-INV-501', 'image' => $this->photo()])->assertStatus(409);
        $r = $this->withHeaders($h)->post("/app/erp-sales/{$id}/builty/front", ['order_code' => 'TEST-INV-502', 'image' => $this->photo()])->assertStatus(201);
        $this->assertSame('erp', $r->json('data.origin'));
        $this->assertTrue($r->json('data.builty.front.uploaded'));
        $path = DB::table('fmcg_erp_sale_deliveries')->where('erp_sale_id', $id)->value('slip_path');
        $this->assertStringStartsWith('erp-' . $id . '/TEST-INV-502-builty-front-', $path);

        // The signed link opens this sale's image only; tampering is refused.
        $url = $r->json('data.builty.front.path');
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->get(str_replace("/erp-sales/{$id}/", '/erp-sales/' . $this->localId(501) . '/', $url))->assertForbidden();
        $this->get(str_replace('/erp-sales/', '/orders/', $url))->assertForbidden();

        $b = $this->withHeaders($h)->getJson("/app/erp-sales/{$id}/builty")->assertOk();
        $this->assertSame(1, $b->json('data.builty.uploaded_count'));
        $card = collect($this->withHeaders($h)->getJson('/app/orders?tab=tomorrow')->json('data.orders'))->firstWhere('code', 'TEST-INV-502');
        $this->assertTrue($card['builty']['front']['uploaded']);
        // The website order with the same numeric id has no image.
        $this->assertSame(0, DB::table('fmcg_order_deliveries')->count());
    }

    public function test_erp_down_or_not_configured_still_shows_website_orders(): void
    {
        $t = $this->token();
        $h = ['Authorization' => 'Bearer ' . $t];
        $this->erpDown = true;
        $r = $this->withHeaders($h)->getJson('/app/orders?tab=today')->assertOk();
        $this->assertSame(1, $r->json('data.meta.total'));
        $this->assertFalse($r->json('data.sources.erp.ok'));
        $this->assertSame('erp_unreachable', $r->json('data.sources.erp.error'));
        $this->withHeaders($h)->postJson('/app/erp-sales/sync')->assertStatus(502)->assertJsonPath('data.reason', 'erp_unreachable');

        $this->erpDown = false;
        $this->withHeaders($h)->postJson('/app/erp-sales/sync')->assertOk()->assertJsonPath('data.summary.fetched', 3);
        $this->assertSame(2, $this->withHeaders($h)->getJson('/app/orders?tab=today')->json('data.meta.total'));

        config(['fmcg.erp_sales.url' => '']);
        $r = $this->withHeaders($h)->getJson('/app/orders?tab=today')->assertOk();
        $this->assertFalse($r->json('data.sources.erp.enabled'));
        $this->withHeaders($h)->postJson('/app/erp-sales/sync')->assertStatus(503)->assertJsonPath('data.reason', 'erp_not_configured');
    }

    public function test_the_feed_is_called_with_the_token_and_the_cursor(): void
    {
        (new ErpSalesSync())->run();
        Http::assertSent(fn (HttpRequest $r) => str_starts_with($r->url(), self::ERP . '/api/integrations/england/sales?')
            && $r->hasHeader('Authorization', 'Bearer ' . self::TOKEN));
        $state = DB::table('fmcg_sync_state')->where('name', 'erp_sales')->first();
        $this->assertSame('2026-11-04 09:20:00', $state->cursor_since);
        $this->assertSame(502, (int) $state->cursor_after_id);
        $this->assertNull($state->last_error);
    }

    /**
     * An ERP sale sold in the product's own unit (1 Carton of England Today Razer, as the ERP
     * Sales Create now posts it) reaches the Orders app on its own: listed once in the Today tab
     * with the ERP origin, its unit shown as sold ("1 Carton", not 576 pieces), and a later
     * refresh never duplicates it.
     */
    public function test_a_sale_created_in_the_erp_in_a_product_unit_appears_once_in_today_with_its_unit(): void
    {
        $this->erpSales[601] = $this->erpSale(601, 'TEST-INV-601', '2026-11-04', '2026-11-04 09:50:00');
        $this->erpSales[601]['items'] = [[
            'id' => 6011, 'item_id' => 9, 'code' => null, 'name' => 'England Today Razor', 'urdu_name' => null, 'company_id' => 173,
            'type' => 'sale', 'packing' => 'CTN = 576 PCS', 'pack_unit' => 'CTN', 'unit' => 'PCS', 'pack_to_unit' => 576,
            'pack_qty' => 1, 'unit_qty' => 0, 'bonus_qty' => 0, 'base_qty' => 576,
            'sale_unit' => 'Carton', 'sale_unit_qty' => 1, 'sale_unit_pieces' => 576,
        ], [
            'id' => 6012, 'item_id' => 10, 'code' => null, 'name' => 'England 5G', 'urdu_name' => null, 'company_id' => 173,
            'type' => 'sale', 'packing' => 'CTN = 576 PCS', 'pack_unit' => 'CTN', 'unit' => 'PCS', 'pack_to_unit' => 576,
            'pack_qty' => 0, 'unit_qty' => 96, 'bonus_qty' => 2, 'base_qty' => 98,
            'sale_unit' => 'Box', 'sale_unit_qty' => 2, 'sale_unit_pieces' => 48,
        ]];
        $t = $this->token();
        $get = fn ($q) => $this->withHeader('Authorization', 'Bearer ' . $t)->getJson('/app/orders?' . $q)->assertOk();

        $today = collect($get('tab=today')->json('data.orders'))->where('code', 'TEST-INV-601');
        $this->assertCount(1, $today);
        $o = $today->first();
        $this->assertSame('erp', $o['origin']);
        $this->assertSame(['1 Carton', 'Carton', 1], [$o['items'][0]['qty_text'], $o['items'][0]['unit'], $o['items'][0]['qty']]);
        $this->assertSame(['2 Box', '2 pcs'], [$o['items'][1]['qty_text'], $o['items'][1]['bonus']]);

        // Pull-to-refresh and another list load: still one copy, still in Today, nowhere else wrongly.
        $this->withHeader('Authorization', 'Bearer ' . $t)->postJson('/app/erp-sales/sync')->assertOk();
        $this->assertSame(1, DB::table('fmcg_erp_sales')->where('erp_sale_id', 601)->count());
        $this->assertCount(1, collect($get('tab=today')->json('data.orders'))->where('code', 'TEST-INV-601'));
        $this->assertCount(0, collect($get('tab=tomorrow')->json('data.orders'))->where('code', 'TEST-INV-601'));
        $this->assertCount(1, collect($get('tab=all&origin=erp')->json('data.orders'))->where('code', 'TEST-INV-601'));
        $this->withHeader('Authorization', 'Bearer ' . $t)->getJson('/app/erp-sales/' . $this->localId(601))->assertOk()
            ->assertJsonPath('data.order.items.0.qty_text', '1 Carton');
    }
}

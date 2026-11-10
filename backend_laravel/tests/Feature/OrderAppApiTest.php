<?php

namespace Tests\Feature;

use App\Models\Admin;
use Carbon\CarbonImmutable;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * England Orders mobile app API, against a throw-away SQLite database with
 * clearly labelled TEST orders (never the real order data).
 */
class OrderAppApiTest extends TestCase
{
    use RefreshDatabase;

    private string $slips;
    private array $ids = [];

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
        $this->slips = sys_get_temp_dir() . '/slips-' . uniqid();
        config(['fmcg.slips_path' => $this->slips, 'fmcg.business_timezone' => 'Asia/Karachi']);
        // 10:00 in Karachi on 4 Nov 2026 (= 05:00 UTC).
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-04 05:00:00', 'UTC'));

        Admin::create(['username' => 'teamlead', 'password' => password_hash('secret-pass', PASSWORD_DEFAULT), 'role' => 'admin']);
        $c1 = DB::table('fmcg_customers')->insertGetId(['name' => 'TEST علی کریانہ', 'phone' => '03001234567', 'address' => 'Shop 4, Akbari Mandi', 'city' => 'Lahore']);
        $c2 = DB::table('fmcg_customers')->insertGetId(['name' => 'TEST Bilal Store', 'phone' => '0321-7654321', 'address' => 'Main Bazaar', 'city' => 'Multan']);
        $mk = function (int $cust, string $placedUtc, string $status = 'pending') {
            $id = DB::table('fmcg_orders')->insertGetId(['code' => 'TMP' . uniqid(), 'customer_id' => $cust, 'status' => $status,
                'subtotal' => 5000, 'promo_discount' => 0, 'item_discount' => 200, 'delivery' => 0, 'total' => 4800,
                'source' => 'website', 'placed_at' => $placedUtc, 'created_at' => $placedUtc, 'updated_at' => $placedUtc]);
            DB::table('fmcg_orders')->where('id', $id)->update(['code' => 'ENG-' . (1000 + $id)]);
            DB::table('fmcg_order_items')->insert(['order_id' => $id, 'product_id' => '7', 'name' => 'England Classic Razer', 'unit' => 'Carton',
                'qty' => 2, 'unit_price' => 2500, 'line_total' => 5000, 'discount' => 200]);
            return $id;
        };
        $this->ids = [
            'today' => $mk($c1, '2026-11-04 03:00:00'),              // 08:00 PKT today
            'todayLate' => $mk($c2, '2026-11-03 20:30:00'),          // 01:30 PKT today (still "today" in Karachi)
            'yesterday' => $mk($c1, '2026-11-03 10:00:00', 'delivered'),
            'old' => $mk($c2, '2026-10-01 10:00:00', 'cancelled'),
        ];
        // A multi-product order.
        DB::table('fmcg_order_items')->insert(['order_id' => $this->ids['today'], 'product_id' => '9', 'name' => 'England 5G Razor', 'sub' => 'Pack of 10',
            'unit' => 'Carton', 'qty' => 5, 'unit_price' => 3000, 'line_total' => 15000, 'discount' => 0]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->slips);
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function token(): string
    {
        return $this->postJson('/app/auth/login', ['username' => 'teamlead', 'password' => 'secret-pass'])->assertOk()->json('data.token');
    }

    private function api(string $method, string $uri, array $data = [])
    {
        return $this->withHeader('Authorization', 'Bearer ' . $this->token())->json($method, $uri, $data);
    }

    private function photo(int $w = 1200, int $h = 1600): UploadedFile
    {
        // Real image files (no GD needed to run the tests).
        return $this->fixture("{$w}x{$h}.jpg");
    }

    private function fixture(string $name): UploadedFile
    {
        $src = __DIR__ . '/../fixtures/slips/' . $name;
        $tmp = tempnam(sys_get_temp_dir(), 'slip');
        copy($src, $tmp);
        return new UploadedFile($tmp, $name, null, null, true);
    }

    private function code(string $key): string
    {
        return 'ENG-' . (1000 + $this->ids[$key]);
    }

    private function envelope($r, int $code, bool $error = false)
    {
        $r->assertStatus($code)->assertJsonPath('error', $error)->assertJsonPath('code', $code);
        $this->assertIsString($r->json('message'));
        $this->assertIsArray($r->json('data'));
        return $r;
    }

    public function test_auth_uses_the_app_envelope(): void
    {
        $r = $this->envelope($this->getJson('/app/orders'), 401, true);
        $this->assertSame('unauthenticated', $r->json('data.reason'));
        $this->assertSame('invalid_credentials', $this->envelope($this->postJson('/app/auth/login', ['username' => 'teamlead', 'password' => 'nope']), 401, true)->json('data.reason'));
        $r = $this->envelope($this->postJson('/app/auth/login', []), 422, true);
        $this->assertSame('validation_failed', $r->json('data.reason'));
        $this->assertArrayHasKey('username', $r->json('data.fields'));

        $t = $this->token();
        $this->envelope($this->withHeader('Authorization', 'Bearer ' . $t)->getJson('/app/auth/me'), 200)->assertJsonPath('data.user.username', 'teamlead');
        // Signing in to the website dashboard does not sign the app out; the website keeps its own envelope.
        $this->postJson('/auth/admin/login', ['username' => 'teamlead', 'password' => 'secret-pass'])->assertOk()->assertJsonPath('ok', true);
        $this->withHeader('Authorization', 'Bearer ' . $t)->getJson('/app/auth/me')->assertOk();
        // Unknown /app route → app envelope.
        $this->assertSame('not_found', $this->envelope($this->withHeader('Authorization', 'Bearer ' . $t)->getJson('/app/nope'), 404, true)->json('data.reason'));
    }

    public function test_cards_carry_city_adda_and_every_product_with_quantities_but_no_prices(): void
    {
        $t = $this->token();
        $get = fn ($q) => $this->envelope($this->withHeader('Authorization', 'Bearer ' . $t)->getJson('/app/orders?' . $q), 200);

        $r = $get('tab=today');
        $this->assertSame(['today' => 2, 'tomorrow' => 0, 'previous' => 2, 'all' => 4], $r->json('data.counts'));
        $this->assertEqualsCanonicalizing([$this->ids['today'], $this->ids['todayLate']], array_column($r->json('data.orders'), 'id'));
        $this->assertSame('2026-11-04', $r->json('data.meta.today'));
        $card = collect($r->json('data.orders'))->firstWhere('id', $this->ids['today']);
        $this->assertSame($this->code('today'), $card['code']);
        $this->assertSame(['name' => 'TEST علی کریانہ', 'phone' => '03001234567', 'city' => 'Lahore'], $card['customer']);
        $this->assertSame(2, $card['items_count']);
        $this->assertSame([['England Classic Razer', 'Carton', 2], ['England 5G Razor', 'Carton', 5]],
            array_map(fn ($i) => [$i['name'], $i['unit'], $i['qty']], $card['items']));
        $this->assertNull($card['adda_name']);
        $this->assertSame(['uploaded' => false, 'uploaded_at' => null], $card['builty']['front']);
        $this->assertSame(0, $card['builty']['uploaded_count']);
        $this->assertFalse($card['builty']['complete']);
        // No price, total or discount anywhere in the list.
        $json = json_encode($r->json('data.orders'));
        foreach (['total', 'price', 'discount', 'subtotal', 'line_total'] as $k) {
            $this->assertStringNotContainsString('"' . $k . '"', $json, "list must not expose $k");
        }

        // Adda + delivery date: moves the order to tomorrow, shown on the card.
        $this->withHeader('Authorization', 'Bearer ' . $t)->patchJson("/app/orders/{$this->ids['yesterday']}/delivery", ['delivery_date' => '2026-11-05', 'pandi_name' => 'Akram Pandi', 'adda_name' => 'Badami Bagh Adda'])->assertOk();
        $r = $get('tab=tomorrow');
        $this->assertSame([$this->ids['yesterday']], array_column($r->json('data.orders'), 'id'));
        $this->assertSame('Badami Bagh Adda', $r->json('data.orders.0.adda_name'));
        $this->assertSame(1, $r->json('data.counts.previous'));

        // Search and filters still work.
        $this->assertSame(2, $get('tab=all&q=' . urlencode('علی'))->json('data.meta.total'));
        $this->assertSame(2, $get('tab=all&q=' . urlencode('+92 321 7654321'))->json('data.meta.total'));
        $this->assertSame([$this->ids['old']], array_column($get('tab=all&q=' . $this->code('old'))->json('data.orders'), 'id'));
        $this->assertSame(1, $get('tab=all&status=cancelled')->json('data.meta.total'));
        $this->assertSame(3, $get('tab=all&from=2026-11-04')->json('data.meta.total'));
        $this->assertSame(1, $get('tab=all&to=2026-10-31')->json('data.meta.total'));
        $p = $get('tab=all&per_page=5&page=1');
        $this->assertSame(1, $p->json('data.meta.last_page'));
        $this->assertCount(4, $p->json('data.orders'));
    }

    public function test_order_detail_has_products_and_customer_without_prices(): void
    {
        $r = $this->envelope($this->api('GET', "/app/orders/{$this->ids['today']}"), 200);
        $o = $r->json('data.order');
        $this->assertSame(['name' => 'TEST علی کریانہ', 'phone' => '03001234567', 'address' => 'Shop 4, Akbari Mandi', 'city' => 'Lahore'], $o['customer']);
        $this->assertSame(['England Classic Razer', 'England 5G Razor'], array_column($o['items'], 'name'));
        $this->assertSame([2, 5], array_column($o['items'], 'qty'));
        $this->assertSame('2026-11-04', $o['order_date']);
        $this->assertFalse($o['builty']['front']['uploaded']);
        $this->assertFalse($o['builty']['back']['uploaded']);
        $this->assertArrayNotHasKey('totals', $o);
        $this->assertStringNotContainsString('price', json_encode($o));
        $this->assertSame('order_not_found', $this->envelope($this->api('GET', '/app/orders/999999'), 404, true)->json('data.reason'));
    }

    public function test_builty_front_and_back_upload_replace_view_and_isolation(): void
    {
        $id = $this->ids['today'];
        $code = $this->code('today');
        $before = (array) DB::table('fmcg_orders')->where('id', $id)->first();
        $items = DB::table('fmcg_order_items')->where('order_id', $id)->get()->toArray();
        $h = ['Authorization' => 'Bearer ' . $this->token(), 'Accept' => 'application/json'];
        $post = fn (string $side, array $data, ?int $oid = null) => $this->withHeaders($h)->post('/app/orders/' . ($oid ?? $id) . "/builty/{$side}", $data);

        // Wrong / missing order code → 409, nothing stored.
        $this->assertSame('order_mismatch', $this->envelope($post('front', ['order_code' => $this->code('todayLate'), 'image' => $this->photo()]), 409, true)->json('data.reason'));
        $this->envelope($post('front', ['image' => $this->photo()]), 409, true);
        // Validation.
        $this->assertSame('validation_failed', $this->envelope($post('front', ['order_code' => $code]), 422, true)->json('data.reason'));
        $this->assertSame('image_type_not_allowed', $this->envelope($post('front', ['order_code' => $code, 'image' => UploadedFile::fake()->create('x.pdf', 20, 'application/pdf')]), 422, true)->json('data.reason'));
        $this->assertSame('image_too_small', $this->envelope($post('back', ['order_code' => $code, 'image' => $this->photo(100, 80)]), 422, true)->json('data.reason'));
        $this->envelope($post('side', ['order_code' => $code, 'image' => $this->photo()]), 404, true);
        $this->assertNull(DB::table('fmcg_order_deliveries')->where('order_id', $id)->value('slip_path'));

        // Front only → partial.
        $r = $this->envelope($post('front', ['order_code' => $code, 'image' => $this->photo()]), 201);
        $this->assertSame('front', $r->json('data.side'));
        $this->assertTrue($r->json('data.builty.front.uploaded'));
        $this->assertFalse($r->json('data.builty.back.uploaded'));
        $this->assertSame(1, $r->json('data.builty.uploaded_count'));
        $this->assertFalse($r->json('data.builty.complete'));
        $this->assertSame([$id], array_column($this->withHeaders($h)->getJson('/app/orders?tab=all&builty=partial')->json('data.orders'), 'id'));
        $this->assertStringNotContainsString('pandi-slips', json_encode($r->json()), 'no private storage path in responses');
        $this->assertStringNotContainsString($this->slips, json_encode($r->json()));

        // Back → complete.
        $r = $this->envelope($post('back', ['order_code' => $code, 'image' => $this->fixture('900x1200.png')]), 201);
        $this->assertTrue($r->json('data.builty.complete'));
        $this->assertSame('image/png', $r->json('data.builty.back.mime'));
        $d = DB::table('fmcg_order_deliveries')->where('order_id', $id)->first();
        $this->assertStringStartsWith($id . '/' . $code . '-builty-front-', $d->slip_path);
        $this->assertStringStartsWith($id . '/' . $code . '-builty-back-', $d->builty_back_path);
        $this->assertCount(2, File::files($this->slips . '/' . $id));

        // Builty filter: complete vs missing.
        $this->assertSame([$id], array_column($this->withHeaders($h)->getJson('/app/orders?tab=all&builty=uploaded')->json('data.orders'), 'id'));
        $this->assertSame(3, $this->withHeaders($h)->getJson('/app/orders?tab=all&builty=pending')->json('data.meta.total'));

        // Cards: complete for this order only.
        $cards = collect($this->withHeaders($h)->getJson('/app/orders?tab=today')->json('data.orders'))->keyBy('id');
        $this->assertTrue($cards[$id]['builty']['complete']);
        $this->assertSame(0, $cards[$this->ids['todayLate']]['builty']['uploaded_count']);

        // Viewer: signed URLs stream the right bytes with no bearer token.
        $v = $this->envelope($this->withHeaders($h)->getJson("/app/orders/{$id}/builty"), 200);
        $this->assertSame($code, $v->json('data.order_code'));
        $front = $v->json('data.builty.front.url');
        $back = $v->json('data.builty.back.url');
        $this->assertStringContainsString("/app/orders/{$id}/builty/front/image", $front);
        $this->assertStringStartsWith("/app/orders/{$id}/builty/front/image?", $v->json('data.builty.front.path'));
        $this->flushHeaders();
        $this->get($v->json('data.builty.front.path'), ['X-Forwarded-Proto' => 'https'])->assertOk(); // scheme-independent
        $this->flushHeaders();
        $this->get($front)->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->get($back)->assertOk()->assertHeader('Content-Type', 'image/png');
        // Tampered URL (another order / other side) → refused.
        $this->assertSame('link_expired', $this->envelope($this->getJson(str_replace("/orders/{$id}/", '/orders/' . $this->ids['todayLate'] . '/', $front)), 403, true)->json('data.reason'));
        $this->getJson(str_replace('/front/', '/back/', $front))->assertStatus(403);
        $this->getJson("/app/orders/{$id}/builty/front/image")->assertStatus(403);
        // Other order's viewer has nothing.
        $o = $this->withHeaders($h)->getJson('/app/orders/' . $this->ids['todayLate'] . '/builty')->json('data.builty');
        $this->assertSame(['front' => ['uploaded' => false], 'back' => ['uploaded' => false], 'uploaded_count' => 0, 'complete' => false], $o);

        // Replace the back: old file removed, old URL no longer opens it.
        $oldBack = $d->builty_back_path;
        $this->envelope($post('back', ['order_code' => $code, 'image' => $this->photo(3000, 4000)]), 201);
        $newBack = DB::table('fmcg_order_deliveries')->where('order_id', $id)->value('builty_back_path');
        $this->assertNotSame($oldBack, $newBack);
        $this->assertFileDoesNotExist($this->slips . '/' . $oldBack);
        $this->assertCount(2, File::files($this->slips . '/' . $id));
        $this->flushHeaders();
        $this->assertSame('image_replaced', $this->envelope($this->getJson($back), 410, true)->json('data.reason'));
        // Front still intact.
        $this->assertSame($d->slip_path, DB::table('fmcg_order_deliveries')->where('order_id', $id)->value('slip_path'));

        // Expired link.
        CarbonImmutable::setTestNow(CarbonImmutable::now()->addMinutes(31));
        $this->travel(31)->minutes();
        $this->getJson($front)->assertStatus(403);
        $this->travelBack();

        // The order, its items and its status are exactly as before.
        $this->assertSame($before, (array) DB::table('fmcg_orders')->where('id', $id)->first());
        $this->assertEquals($items, DB::table('fmcg_order_items')->where('order_id', $id)->get()->toArray());
        $this->assertSame(0, DB::table('fmcg_order_status_history')->count());
    }

    public function test_legacy_slip_endpoints_map_to_the_front_image(): void
    {
        $id = $this->ids['old'];
        $h = ['Authorization' => 'Bearer ' . $this->token(), 'Accept' => 'application/json'];
        $this->envelope($this->withHeaders($h)->post("/app/orders/{$id}/slip", ['order_code' => $this->code('old'), 'slip' => $this->photo()]), 201)
            ->assertJsonPath('data.builty.front.uploaded', true);
        $this->withHeaders($h)->get("/app/orders/{$id}/slip")->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();
        $this->getJson("/app/orders/{$id}/slip")->assertStatus(401);
    }

    public function test_delivery_fields_validate_and_clear(): void
    {
        $id = $this->ids['old'];
        $r = $this->envelope($this->api('PATCH', "/app/orders/{$id}/delivery", ['delivery_date' => '2026-02-30']), 422, true);
        $this->assertArrayHasKey('delivery_date', $r->json('data.fields'));
        $this->api('PATCH', "/app/orders/{$id}/delivery", ['pandi_name' => str_repeat('x', 121)])->assertStatus(422);
        $this->api('PATCH', "/app/orders/{$id}/delivery", ['order_code' => 'ENG-1', 'pandi_name' => 'X'])->assertStatus(409);
        $this->api('PATCH', "/app/orders/{$id}/delivery", ['pandi_name' => '  Akram   Pandi ', 'adda_name' => 'لاری اڈہ'])->assertOk()
            ->assertJsonPath('data.order.pandi_name', 'Akram Pandi')->assertJsonPath('data.order.adda_name', 'لاری اڈہ');
        $this->api('PATCH', "/app/orders/{$id}/delivery", ['pandi_name' => '', 'delivery_date' => ''])->assertOk()
            ->assertJsonPath('data.order.pandi_name', null)->assertJsonPath('data.order.adda_name', 'لاری اڈہ');
        $this->assertSame('cancelled', DB::table('fmcg_orders')->where('id', $id)->value('status'));
    }
}

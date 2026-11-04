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
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->slips);
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function token(): string
    {
        return $this->postJson('/app/auth/login', ['username' => 'teamlead', 'password' => 'secret-pass'])->assertOk()->json('token');
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

    public function test_login_is_required_and_wrong_passwords_are_refused(): void
    {
        $this->getJson('/app/orders')->assertStatus(401);
        $this->postJson('/app/auth/login', ['username' => 'teamlead', 'password' => 'nope'])->assertStatus(401);
        $t = $this->token();
        $this->withHeader('Authorization', 'Bearer ' . $t)->getJson('/app/auth/me')->assertOk()->assertJsonPath('user.username', 'teamlead');
        // Signing in to the website dashboard does not sign the app out.
        $this->postJson('/auth/admin/login', ['username' => 'teamlead', 'password' => 'secret-pass'])->assertOk();
        $this->withHeader('Authorization', 'Bearer ' . $t)->getJson('/app/auth/me')->assertOk();
    }

    public function test_tabs_counts_search_and_pagination_follow_the_business_day(): void
    {
        $t = $this->token();
        $get = fn ($q) => $this->withHeader('Authorization', 'Bearer ' . $t)->getJson('/app/orders?' . $q)->assertOk();

        $r = $get('tab=today');
        $this->assertSame(['today' => 2, 'tomorrow' => 0, 'previous' => 2, 'all' => 4], $r->json('counts'));
        $this->assertEqualsCanonicalizing([$this->ids['today'], $this->ids['todayLate']], array_column($r->json('data'), 'id'));
        $this->assertSame('2026-11-04', $r->json('meta.today'));
        $card = collect($r->json('data'))->firstWhere('id', $this->ids['today']);
        $this->assertSame('TEST علی کریانہ', $card['customer']['name']);
        $this->assertFalse($card['slip']['uploaded']);

        // A delivery date moves an order between tabs (the order itself is untouched).
        $this->withHeader('Authorization', 'Bearer ' . $t)->patchJson("/app/orders/{$this->ids['yesterday']}/delivery", ['delivery_date' => '2026-11-05', 'pandi_name' => 'Akram Pandi', 'adda_name' => 'Badami Bagh Adda'])->assertOk();
        $r = $get('tab=tomorrow');
        $this->assertSame([$this->ids['yesterday']], array_column($r->json('data'), 'id'));
        $this->assertSame('Akram Pandi', $r->json('data.0.pandi_name'));
        $this->assertSame(1, $r->json('counts.previous'));

        // Search: name, phone in any format, order code.
        $this->assertSame(2, $get('tab=all&q=' . urlencode('علی'))->json('meta.total'));
        $this->assertSame(2, $get('tab=all&q=' . urlencode('+92 321 7654321'))->json('meta.total'));
        $code = 'ENG-' . (1000 + $this->ids['old']);
        $this->assertSame([$this->ids['old']], array_column($get('tab=all&q=' . $code)->json('data'), 'id'));
        // Filters: status, date range, slip.
        $this->assertSame(1, $get('tab=all&status=cancelled')->json('meta.total'));
        $this->assertSame(3, $get('tab=all&from=2026-11-04')->json('meta.total'));
        $this->assertSame(1, $get('tab=all&to=2026-10-31')->json('meta.total'));
        // Pagination.
        $p = $get('tab=all&per_page=5&page=1');
        $this->assertSame(1, $p->json('meta.last_page'));
        $this->assertCount(4, $p->json('data'));
    }

    public function test_order_details_show_customer_items_totals_and_delivery(): void
    {
        $o = $this->api('GET', "/app/orders/{$this->ids['today']}")->assertOk()->json('order');
        $this->assertSame(['name' => 'TEST علی کریانہ', 'phone' => '03001234567', 'address' => 'Shop 4, Akbari Mandi', 'city' => 'Lahore'], $o['customer']);
        $this->assertSame('England Classic Razer', $o['items'][0]['name']);
        $this->assertSame(['Carton', 2, 4800], [$o['items'][0]['unit'], $o['items'][0]['qty'], $o['items'][0]['net_total']]);
        $this->assertSame(4800, $o['totals']['total']);
        $this->assertSame('2026-11-04', $o['order_date']);
        $this->assertNull($o['pandi_name']);
        $this->api('GET', '/app/orders/999999')->assertStatus(404);
    }

    public function test_slip_upload_attaches_to_the_exact_order_and_never_changes_the_order(): void
    {
        $id = $this->ids['today'];
        $code = 'ENG-' . (1000 + $id);
        $before = (array) DB::table('fmcg_orders')->where('id', $id)->first();
        $items = DB::table('fmcg_order_items')->where('order_id', $id)->get()->toArray();
        $t = $this->token();
        $h = ['Authorization' => 'Bearer ' . $t, 'Accept' => 'application/json'];

        // Wrong order code → refused, nothing stored.
        $this->withHeaders($h)->post("/app/orders/{$id}/slip", ['order_code' => 'ENG-1999', 'slip' => $this->photo()])->assertStatus(409);
        $this->withHeaders($h)->post("/app/orders/{$id}/slip", ['slip' => $this->photo()])->assertStatus(409);
        // Bad files → refused with a message.
        $this->withHeaders($h)->post("/app/orders/{$id}/slip", ['order_code' => $code, 'slip' => UploadedFile::fake()->create('x.pdf', 20, 'application/pdf')])
            ->assertStatus(422)->assertJsonPath('ok', false);
        $this->withHeaders($h)->post("/app/orders/{$id}/slip", ['order_code' => $code, 'slip' => $this->photo(100, 80)])->assertStatus(422);
        $this->assertFalse($this->withHeaders($h)->getJson("/app/orders/{$id}")->json('order.slip.uploaded'));

        // Good upload → 201 only after the file and its row are saved.
        $r = $this->withHeaders($h)->post("/app/orders/{$id}/slip", ['order_code' => $code, 'slip' => $this->photo(3000, 4000)])->assertStatus(201);
        $this->assertTrue($r->json('slip.uploaded'));
        if (function_exists('imagecreatetruecolor')) {
            $this->assertLessThanOrEqual(2400, max($r->json('slip.width'), $r->json('slip.height')), 'a large photo is scaled down');
        } else {
            $this->assertSame(4000, $r->json('slip.height'), 'without GD the (already phone-compressed) photo is kept as sent');
        }
        $first = DB::table('fmcg_order_deliveries')->where('order_id', $id)->value('slip_path');
        $this->assertFileExists($this->slips . '/' . $first);
        $this->assertStringStartsWith($id . '/' . $code . '-', $first);

        // The list shows the tick for this order only.
        $cards = collect($this->withHeaders($h)->getJson('/app/orders?tab=today')->json('data'))->keyBy('id');
        $this->assertTrue($cards[$id]['slip']['uploaded']);
        $this->assertFalse($cards[$this->ids['todayLate']]['slip']['uploaded']);

        // The photo streams back to a signed-in admin only.
        $this->withHeaders($h)->get("/app/orders/{$id}/slip")->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();
        $this->get("/app/orders/{$id}/slip", ['Accept' => 'application/json'])->assertStatus(401);

        // Replacing keeps one file per order.
        $this->withHeaders($h)->post("/app/orders/{$id}/slip", ['order_code' => $code, 'slip' => $this->fixture('900x1200.png')])->assertStatus(201);
        $second = DB::table('fmcg_order_deliveries')->where('order_id', $id)->value('slip_path');
        $this->assertNotSame($first, $second);
        $this->assertFileDoesNotExist($this->slips . '/' . $first);
        $this->assertCount(1, File::files($this->slips . '/' . $id));

        // The order, its items and its status are exactly as before.
        $this->assertSame($before, (array) DB::table('fmcg_orders')->where('id', $id)->first());
        $this->assertEquals($items, DB::table('fmcg_order_items')->where('order_id', $id)->get()->toArray());
        $this->assertSame(0, DB::table('fmcg_order_status_history')->count());
    }

    public function test_delivery_fields_validate_and_clear(): void
    {
        $id = $this->ids['old'];
        $this->api('PATCH', "/app/orders/{$id}/delivery", ['delivery_date' => '2026-02-30'])->assertStatus(422);
        $this->api('PATCH', "/app/orders/{$id}/delivery", ['pandi_name' => str_repeat('x', 121)])->assertStatus(422);
        $this->api('PATCH', "/app/orders/{$id}/delivery", ['order_code' => 'ENG-1', 'pandi_name' => 'X'])->assertStatus(409);
        $this->api('PATCH', "/app/orders/{$id}/delivery", ['pandi_name' => '  Akram   Pandi ', 'adda_name' => 'لاری اڈہ'])->assertOk()
            ->assertJsonPath('order.pandi_name', 'Akram Pandi')->assertJsonPath('order.adda_name', 'لاری اڈہ');
        $this->api('PATCH', "/app/orders/{$id}/delivery", ['pandi_name' => '', 'delivery_date' => ''])->assertOk()
            ->assertJsonPath('order.pandi_name', null)->assertJsonPath('order.adda_name', 'لاری اڈہ');
        $this->assertSame('cancelled', DB::table('fmcg_orders')->where('id', $id)->value('status'));
    }
}

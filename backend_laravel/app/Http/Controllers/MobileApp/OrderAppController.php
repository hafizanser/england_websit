<?php

declare(strict_types=1);

namespace App\Http\Controllers\MobileApp;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Repositories\ErpSaleRepo;
use App\Repositories\OrderDeliveryRepo;
use App\Services\ErpSalesSync;
use App\Support\AppApi;
use App\Support\SlipStorage;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;
use RuntimeException;

/**
 * API for the England Orders staff app (internal team only; admin accounts).
 *
 * Two sources, one list:
 *  - website orders: the real storefront/admin orders (fmcg_orders, fmcg_customers,
 *    fmcg_order_items), routes /app/orders/{id}*;
 *  - ERP sales: the read-only copy of posted Accountrix ERP sales (fmcg_erp_sales, kept by
 *    App\Services\ErpSalesSync), routes /app/erp-sales/{id}*.
 * Writes ONLY fmcg_order_deliveries / fmcg_erp_sale_deliveries (delivery date, Pandi Name,
 * Adda Name, Builty front/back images). Order status, quantities, prices, totals and stock
 * are never changed here, and the ERP is never written. Line prices are never returned;
 * each record carries its grand total.
 *
 * Every response uses the {error, message, code, data} envelope (App\Support\AppApi).
 */
class OrderAppController extends Controller
{
    private const TOKEN_NAME = 'england-orders-app';
    private const SIDES = ['front', 'back'];

    // ---- auth ---------------------------------------------------------------

    /** Sign in with an admin account. Replaces only this app's earlier tokens, so the website admin stays signed in. */
    public function login(Request $request)
    {
        $username = trim((string) $request->input('username', ''));
        $password = (string) $request->input('password', '');
        $fields = [];
        if ($username === '') {
            $fields['username'] = 'Enter your username.';
        }
        if ($password === '') {
            $fields['password'] = 'Enter your password.';
        }
        if ($fields) {
            AppApi::invalid($fields, 'Enter your username and password.');
        }
        $admin = Admin::where('username', $username)->first();
        if (!$admin || !password_verify($password, (string) $admin->password) || $admin->role !== 'admin') {
            AppApi::halt('Wrong username or password.', 401, 'invalid_credentials');
        }
        $admin->tokens()->where('name', self::TOKEN_NAME)->delete();
        $token = $admin->createToken(self::TOKEN_NAME)->plainTextToken;
        return AppApi::ok('Signed in.', ['token' => $token, 'user' => $this->userData($admin)]);
    }

    public function logout(Request $request)
    {
        $bearer = $request->bearerToken();
        if ($bearer && ($token = PersonalAccessToken::findToken($bearer)) && $token->name === self::TOKEN_NAME) {
            $token->delete();
        }
        return AppApi::ok('Signed out.', ['logged_out' => true]);
    }

    public function me(Request $request)
    {
        return AppApi::ok('Signed-in user.', ['user' => $this->userData($this->admin($request))]);
    }

    private function userData(Admin $a): array
    {
        return ['id' => (int) $a->id, 'username' => $a->username, 'role' => $a->role];
    }

    // ---- orders -------------------------------------------------------------

    public function index(Request $request)
    {
        // New ERP sales show up without anyone adding them: a list request refreshes the
        // copy when it is older than fmcg.erp_sales.sync_seconds (never fails the request).
        $sync = new ErpSalesSync();
        $sync->maybeRun();

        $result = (new OrderDeliveryRepo())->paginate(
            (string) $request->query('tab', 'today'),
            [
                'q' => (string) $request->query('q', ''),
                'status' => (string) $request->query('status', ''),
                'origin' => (string) $request->query('origin', ''),
                'builty' => (string) $request->query('builty', (string) $request->query('slip', '')),
                'from' => (string) $request->query('from', ''),
                'to' => (string) $request->query('to', ''),
            ],
            (int) $request->query('page', 1),
            (int) $request->query('per_page', 20)
        );
        $result['sources'] = ['website' => ['enabled' => true], 'erp' => $sync->status()];
        return AppApi::ok('Orders retrieved.', $result);
    }

    public function show(int $id)
    {
        return $this->showRecord('website', $id);
    }

    public function erpShow(int $id)
    {
        return $this->showRecord('erp', $id);
    }

    private function showRecord(string $kind, int $id)
    {
        $order = $this->repo($kind)->detail($id);
        if (!$order) {
            AppApi::halt($kind === 'erp' ? 'ERP sale not found.' : 'Order not found.', 404, 'order_not_found');
        }
        return AppApi::ok($kind === 'erp' ? 'ERP sale retrieved.' : 'Order retrieved.', ['order' => $order]);
    }

    /** Refresh the ERP sales copy now (pull-to-refresh). Reports the ERP as unreachable instead of failing silently. */
    public function erpSync()
    {
        $sync = new ErpSalesSync();
        if (!$sync->enabled()) {
            AppApi::halt('ERP sales are not connected on this server.', 503, 'erp_not_configured');
        }
        try {
            $summary = $sync->run();
        } catch (\Throwable $e) {
            report($e);
            AppApi::halt('Could not reach the ERP. The last copied sales are still shown.', 502, 'erp_unreachable', ['erp' => $sync->status()]);
        }
        return AppApi::ok('ERP sales refreshed.', ['summary' => $summary, 'erp' => $sync->status()]);
    }

    /** Set the delivery date, Pandi Name and/or Adda Name (only the fields sent). */
    public function updateDelivery(Request $request, int $id)
    {
        return $this->saveDelivery($request, 'website', $id);
    }

    public function erpUpdateDelivery(Request $request, int $id)
    {
        return $this->saveDelivery($request, 'erp', $id);
    }

    private function saveDelivery(Request $request, string $kind, int $id)
    {
        $repo = $this->repo($kind);
        $row = $this->recordOr404($kind, $id);
        $this->guardCode($request, $row);
        $values = [];
        $fields = [];
        if ($request->has('delivery_date')) {
            $v = trim((string) $request->input('delivery_date', ''));
            if ($v === '') {
                $values['delivery_date'] = null;
            } elseif (preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) && CarbonImmutable::createFromFormat('!Y-m-d', $v)?->format('Y-m-d') === $v) {
                $values['delivery_date'] = $v;
            } else {
                $fields['delivery_date'] = 'Choose a valid date.';
            }
        }
        foreach (['pandi_name', 'adda_name'] as $f) {
            if ($request->has($f)) {
                $v = trim(preg_replace('/\s+/u', ' ', (string) $request->input($f, '')) ?? '');
                if (mb_strlen($v) > 120) {
                    $fields[$f] = 'Maximum 120 characters.';
                }
                $values[$f] = $v === '' ? null : $v;
            }
        }
        if ($fields) {
            AppApi::invalid($fields);
        }
        if ($values) {
            $values['updated_by'] = (int) $this->admin($request)->id;
            $repo->upsert($id, $values);
        }
        return AppApi::ok('Delivery details saved.', ['order' => $repo->detail($id)]);
    }

    // ---- Builty images ----------------------------------------------------------

    /** Both Builty images of one order, with fresh signed URLs (the viewer screen). */
    public function builty(int $id)
    {
        return $this->builtyOf('website', $id);
    }

    public function erpBuilty(int $id)
    {
        return $this->builtyOf('erp', $id);
    }

    private function builtyOf(string $kind, int $id)
    {
        $repo = $this->repo($kind);
        $row = $this->recordOr404($kind, $id);
        return AppApi::ok('Builty images retrieved.', [
            'origin' => $kind,
            'order_id' => $id,
            'order_code' => (string) $row['code'],
            'builty' => $repo->builtyInfo($id, $repo->deliveryRow($id)),
        ]);
    }

    /**
     * Attach (or replace) the front or back Builty image of exactly this order.
     *
     * The request must carry the order's code too; a mismatch is refused, so an image
     * can never land on another order. The new file is written under a fresh name, the
     * row is saved, and only then is the previous file of that side deleted — a failed
     * save leaves the old image in place and removes the new file (no orphans). The
     * response is sent only after both are saved; that is what the app's tick waits for.
     */
    public function uploadBuilty(Request $request, int $id, string $side)
    {
        return $this->storeBuilty($request, 'website', $id, $side);
    }

    public function erpUploadBuilty(Request $request, int $id, string $side)
    {
        return $this->storeBuilty($request, 'erp', $id, $side);
    }

    private function storeBuilty(Request $request, string $kind, int $id, string $side)
    {
        if (!in_array($side, self::SIDES, true)) {
            AppApi::halt('Unknown Builty side. Use front or back.', 404, 'not_found');
        }
        $repo = $this->repo($kind);
        $row = $this->recordOr404($kind, $id);
        $this->guardCode($request, $row, true);

        // `slip` is accepted for the legacy POST /orders/{id}/slip alias.
        $file = $request->file('image') ?? $request->file('slip');
        if (!$file) {
            AppApi::invalid(['image' => 'Choose a photo.'], 'Choose a photo of the Builty ' . $side . '.');
        }
        try {
            $meta = SlipStorage::store($file, $id, (string) $row['code'], $side, $kind === 'erp' ? 'erp-' . $id : null);
        } catch (RuntimeException $e) {
            $reason = SlipStorage::REASONS[$e->getCode()] ?? 'image_invalid';
            if ($reason === 'storage_failed') {
                report($e);
                AppApi::halt('Could not save the photo on the server. Please try again.', 500, $reason);
            }
            AppApi::halt($e->getMessage(), 422, $reason, ['fields' => ['image' => $e->getMessage()]]);
        }

        $col = OrderDeliveryRepo::SIDES[$side];
        $old = $repo->deliveryRow($id)[$col['path']] ?? null;
        try {
            $values = [];
            foreach (['path', 'mime', 'size', 'width', 'height', 'sha256'] as $k) {
                $values[$col[$k]] = $meta[$k];
            }
            $values[$col['uploaded_at']] = gmdate('Y-m-d H:i:s');
            $values[$col['uploaded_by']] = (int) $this->admin($request)->id;
            $repo->upsert($id, $values);
        } catch (\Throwable $e) {
            SlipStorage::delete($meta['path']); // keep the previous image; nothing half-saved
            report($e);
            AppApi::halt('Could not save the photo. Please try again.', 500, 'server_error');
        }
        if ($old && $old !== $meta['path']) {
            SlipStorage::delete($old);
        }

        $builty = $repo->builtyInfo($id, $repo->deliveryRow($id));
        return AppApi::ok(
            'Builty ' . $side . ' image saved.',
            ['origin' => $kind, 'order_id' => $id, 'order_code' => (string) $row['code'], 'side' => $side, 'builty' => $builty],
            201
        );
    }

    /**
     * The image itself, through a temporary signed URL (route middleware `signed`).
     * The signature binds order id + side + image version, so a URL opens exactly one
     * order's one image and stops working when it expires or the image is replaced.
     */
    public function builtyImage(Request $request, int $id, string $side)
    {
        return $this->streamBuilty($request, 'website', $id, $side);
    }

    public function erpBuiltyImage(Request $request, int $id, string $side)
    {
        return $this->streamBuilty($request, 'erp', $id, $side);
    }

    private function streamBuilty(Request $request, string $kind, int $id, string $side)
    {
        if (!in_array($side, self::SIDES, true)) {
            AppApi::halt('Unknown Builty side.', 404, 'not_found');
        }
        $d = $this->repo($kind)->deliveryRow($id) ?? [];
        $col = OrderDeliveryRepo::SIDES[$side];
        $abs = !empty($d[$col['path']]) ? SlipStorage::absolute((string) $d[$col['path']]) : null;
        if (!$abs || !is_file($abs)) {
            AppApi::halt('No Builty ' . $side . ' image for this order.', 404, 'image_not_found');
        }
        $version = (string) $request->query('v', '');
        if ($version !== '' && !hash_equals(substr((string) $d[$col['sha256']], 0, 12), $version)) {
            AppApi::halt('This image has been replaced. Open the order again.', 410, 'image_replaced');
        }
        $code = $kind === 'erp'
            ? DB::table('fmcg_erp_sales')->where('id', $id)->value('invoice_no')
            : DB::table('fmcg_orders')->where('id', $id)->value('code');
        $name = preg_replace('/[^A-Za-z0-9-]/', '', (string) $code) . '-builty-' . $side . '.' . (SlipStorage::MIMES[$d[$col['mime']]] ?? 'jpg');
        return response()->file($abs, [
            'Content-Type' => $d[$col['mime']] ?: 'image/jpeg',
            'Content-Disposition' => 'inline; filename="' . $name . '"',
            'Cache-Control' => 'private, max-age=600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** Legacy alias: POST /orders/{id}/slip (field `slip`) uploads the FRONT image. */
    public function uploadSlip(Request $request, int $id)
    {
        return $this->uploadBuilty($request, $id, 'front');
    }

    /** Legacy alias: GET /orders/{id}/slip streams the FRONT image to a signed-in admin. */
    public function slip(Request $request, int $id)
    {
        $request->query->remove('v');
        return $this->builtyImage($request, $id, 'front');
    }

    // ---- helpers ------------------------------------------------------------------

    private function repo(string $kind): OrderDeliveryRepo|ErpSaleRepo
    {
        return $kind === 'erp' ? new ErpSaleRepo() : new OrderDeliveryRepo();
    }

    /** The website order or ERP sale being written to; 404 when it does not exist (or the ERP no longer lists it). */
    private function recordOr404(string $kind, int $id): array
    {
        $row = $kind === 'erp' ? (new ErpSaleRepo())->saleRow($id) : (new OrderDeliveryRepo())->orderRow($id);
        if (!$row) {
            AppApi::halt($kind === 'erp' ? 'ERP sale not found.' : 'Order not found.', 404, 'order_not_found');
        }
        return $row;
    }

    /** The order code the app shows must match the order id it is writing to. */
    private function guardCode(Request $request, array $row, bool $required = false): void
    {
        $code = trim((string) $request->input('order_code', ''));
        if ($code === '' && !$required) {
            return;
        }
        if ($code === '' || !hash_equals((string) $row['code'], $code)) {
            AppApi::halt('This does not belong to order ' . $row['code'] . '. Nothing was saved.', 409, 'order_mismatch');
        }
    }
}

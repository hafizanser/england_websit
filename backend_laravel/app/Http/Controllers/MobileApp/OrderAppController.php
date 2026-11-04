<?php

declare(strict_types=1);

namespace App\Http\Controllers\MobileApp;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Repositories\OrderDeliveryRepo;
use App\Support\Api;
use App\Support\SlipStorage;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;
use RuntimeException;

/**
 * API for the England Orders mobile app (internal team only; admin accounts).
 *
 * Reads the real storefront/admin orders (fmcg_orders, fmcg_customers, fmcg_order_items)
 * and writes ONLY fmcg_order_deliveries (delivery date, Pandi Name, Adda Name, slip).
 * Order status, totals, items and stock are never changed here — uploading a Pandi slip
 * attaches a photo; it does not mark the order delivered.
 */
class OrderAppController extends Controller
{
    private const TOKEN_NAME = 'england-orders-app';

    // ---- auth ---------------------------------------------------------------

    /** Sign in with an admin account. Replaces only this app's earlier tokens, so the website admin stays signed in. */
    public function login(Request $request)
    {
        $username = trim((string) $request->input('username', ''));
        $password = (string) $request->input('password', '');
        if ($username === '' || $password === '') {
            Api::halt('Enter your username and password.', 422);
        }
        $admin = Admin::where('username', $username)->first();
        if (!$admin || !password_verify($password, (string) $admin->password) || $admin->role !== 'admin') {
            Api::halt('Wrong username or password.', 401);
        }
        $admin->tokens()->where('name', self::TOKEN_NAME)->delete();
        $token = $admin->createToken(self::TOKEN_NAME)->plainTextToken;
        return Api::ok(['token' => $token, 'user' => $this->userData($admin)]);
    }

    public function logout(Request $request)
    {
        $bearer = $request->bearerToken();
        if ($bearer && ($token = PersonalAccessToken::findToken($bearer)) && $token->name === self::TOKEN_NAME) {
            $token->delete();
        }
        return Api::ok(['loggedOut' => true]);
    }

    public function me(Request $request)
    {
        return Api::ok(['user' => $this->userData($this->admin($request))]);
    }

    private function userData(Admin $a): array
    {
        return ['id' => (int) $a->id, 'username' => $a->username, 'role' => $a->role];
    }

    // ---- orders -------------------------------------------------------------

    public function index(Request $request)
    {
        $repo = new OrderDeliveryRepo();
        $result = $repo->paginate(
            (string) $request->query('tab', 'today'),
            [
                'q' => (string) $request->query('q', ''),
                'status' => (string) $request->query('status', ''),
                'slip' => (string) $request->query('slip', ''),
                'from' => (string) $request->query('from', ''),
                'to' => (string) $request->query('to', ''),
            ],
            (int) $request->query('page', 1),
            (int) $request->query('per_page', 20)
        );
        return Api::ok($result);
    }

    public function show(int $id)
    {
        $order = (new OrderDeliveryRepo())->detail($id);
        if (!$order) {
            Api::halt('Order not found.', 404);
        }
        return Api::ok(['order' => $order]);
    }

    /** Set the delivery date, Pandi Name and/or Adda Name (only the fields sent). */
    public function updateDelivery(Request $request, int $id)
    {
        $repo = new OrderDeliveryRepo();
        $row = $repo->orderRow($id);
        if (!$row) {
            Api::halt('Order not found.', 404);
        }
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
            Api::halt('Please check the form.', 422, ['fields' => $fields]);
        }
        if ($values) {
            $values['updated_by'] = (int) $this->admin($request)->id;
            $repo->upsert($id, $values);
        }
        return Api::ok(['order' => $repo->detail($id)]);
    }

    /**
     * Attach (or replace) the Pandi delivery-slip photo of exactly this order.
     * The request must also carry the order's code; a mismatch is refused so a photo
     * can never land on another order. The response is sent only after the file and
     * its database row are both saved — that is what the app's green tick waits for.
     */
    public function uploadSlip(Request $request, int $id)
    {
        $repo = new OrderDeliveryRepo();
        $row = $repo->orderRow($id);
        if (!$row) {
            Api::halt('Order not found.', 404);
        }
        $this->guardCode($request, $row, true);
        $file = $request->file('slip');
        if (!$file) {
            Api::halt('Choose a photo of the Pandi slip.', 422, ['fields' => ['slip' => 'Choose a photo.']]);
        }
        try {
            $meta = SlipStorage::store($file, $id, (string) $row['code']);
        } catch (RuntimeException $e) {
            Api::halt($e->getMessage(), 422, ['fields' => ['slip' => $e->getMessage()]]);
        }

        $old = $repo->deliveryRow($id)['slip_path'] ?? null;
        try {
            $repo->upsert($id, $meta + [
                'slip_uploaded_at' => gmdate('Y-m-d H:i:s'),
                'slip_uploaded_by' => (int) $this->admin($request)->id,
            ]);
        } catch (\Throwable $e) {
            SlipStorage::delete($meta['slip_path']); // keep the previous slip; nothing half-saved
            report($e);
            Api::halt('Could not save the slip. Please try again.', 500);
        }
        if ($old && $old !== $meta['slip_path']) {
            SlipStorage::delete($old);
        }
        $order = $repo->detail($id);
        return Api::ok(['order' => $order, 'slip' => $order['slip']], 201);
    }

    /** Stream the slip photo to a signed-in admin (never publicly reachable). */
    public function slip(int $id)
    {
        $d = (new OrderDeliveryRepo())->deliveryRow($id);
        $abs = !empty($d['slip_path']) ? SlipStorage::absolute((string) $d['slip_path']) : null;
        if (!$abs || !is_file($abs)) {
            Api::halt('No slip uploaded for this order.', 404);
        }
        $order = DB::table('fmcg_orders')->where('id', $id)->value('code');
        $name = preg_replace('/[^A-Za-z0-9-]/', '', (string) $order) . '-pandi-slip.' . (SlipStorage::MIMES[$d['slip_mime']] ?? 'jpg');
        return response()->file($abs, [
            'Content-Type' => $d['slip_mime'] ?: 'image/jpeg',
            'Content-Disposition' => 'inline; filename="' . $name . '"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** The order code the app shows must match the order id it is writing to. */
    private function guardCode(Request $request, array $row, bool $required = false): void
    {
        $code = trim((string) $request->input('order_code', ''));
        if ($code === '' && !$required) {
            return;
        }
        if ($code === '' || !hash_equals((string) $row['code'], $code)) {
            Api::halt('This photo does not belong to order ' . $row['code'] . '. Nothing was saved.', 409);
        }
    }
}

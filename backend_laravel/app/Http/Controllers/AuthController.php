<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\ShopCustomer;
use App\Support\Api;
use Laravel\Sanctum\PersonalAccessToken;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    // ---- admin auth --------------------------------------------------------

    public function adminLogin(Request $request)
    {
        $username = (string) $request->input('username', '');
        $password = (string) $request->input('password', '');
        $admin = Admin::where('username', $username)->first();
        if (!$admin || !password_verify($password, $admin->password)) {
            Api::halt('Ghalat username ya password', 401);
        }
        $admin->tokens()->delete();
        $token = $admin->createToken('admin')->plainTextToken;
        return Api::ok([
            'token' => $token,
            'user'  => ['id' => (int) $admin->id, 'username' => $admin->username, 'role' => $admin->role],
        ]);
    }

    public function adminLogout(Request $request)
    {
        $bearer = $request->bearerToken();
        if ($bearer && ($token = PersonalAccessToken::findToken($bearer))) {
            $token->delete();
        }
        return Api::ok(['loggedOut' => true]);
    }

    public function adminMe(Request $request)
    {
        $admin = $this->admin($request);
        return Api::ok(['user' => ['id' => (int) $admin->id, 'username' => $admin->username, 'role' => $admin->role]]);
    }

    // ---- customer auth -----------------------------------------------------

    public function customerRegister(Request $request)
    {
        $name = trim((string) $request->input('name', ''));
        $phone = trim((string) $request->input('phone', ''));
        $password = (string) $request->input('password', '');
        $fields = [];
        if (mb_strlen($name) < 3) {
            $fields['name'] = 'Naam likhein (kam az kam 3 harf).';
        }
        if (strlen(ShopCustomer::normalizePhone($phone)) !== 11) {
            $fields['phone'] = 'Mobile number 11 digit ka hona chahiye.';
        }
        if (strlen($password) < 6) {
            $fields['password'] = 'Password kam az kam 6 harf ka ho.';
        }
        if ($fields) {
            Api::halt('Form mein ghalti hai', 422, ['fields' => $fields]);
        }

        [$result, $token] = ShopCustomer::register([
            'name'     => $name,
            'phone'    => $phone,
            'email'    => (string) $request->input('email', ''),
            'address'  => (string) $request->input('address', ''),
            'city'     => (string) $request->input('city', ''),
            'password' => $password,
        ]);
        if ($token === null) {
            Api::halt($result['error'] ?? 'Register nahi ho saka', 409);
        }
        return Api::ok(['token' => $token, 'customer' => $result], 201);
    }

    public function customerLogin(Request $request)
    {
        $identifier = trim((string) $request->input('identifier', ''));
        $password = (string) $request->input('password', '');
        $result = ShopCustomer::login($identifier, $password);
        if (!$result) {
            Api::halt('Ghalat number/email ya password', 401);
        }
        [$customer, $token] = $result;
        return Api::ok(['token' => $token, 'customer' => $customer]);
    }

    public function customerPhoneLogin(Request $request)
    {
        $phone = trim((string) $request->input('phone', ''));
        $name = trim((string) $request->input('name', ''));
        $digits = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($digits) !== 11) {
            Api::halt('Mobile number 11 digit ka hona chahiye', 422, ['fields' => ['phone' => 'Mobile number 11 digit ka hona chahiye.']]);
        }
        [$customer, $token] = ShopCustomer::loginOrCreateByPhone($phone, $name, [
            'email'   => (string) $request->input('email', ''),
            'city'    => (string) $request->input('city', ''),
            'address' => (string) $request->input('address', ''),
        ]);
        return Api::ok(['token' => $token, 'customer' => $customer]);
    }

    public function customerLogout(Request $request)
    {
        $bearer = $request->bearerToken();
        if ($bearer && ($token = PersonalAccessToken::findToken($bearer))) {
            $token->delete();
        }
        return Api::ok(['loggedOut' => true]);
    }

    public function customerMe(Request $request)
    {
        return Api::ok(['customer' => $this->customer($request)->publicData()]);
    }
}

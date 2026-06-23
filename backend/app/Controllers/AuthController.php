<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Response;
use App\Services\AuthService;
use App\Models\Customer;

class AuthController extends Controller
{
    public function adminLogin(): void
    {
        $username = (string)$this->request->input('username', '');
        $password = (string)$this->request->input('password', '');
        $result = (new AuthService())->adminLogin($username, $password);
        if (!$result) {
            Response::error('Ghalat username ya password', 401);
        }
        Response::ok($result);
    }

    public function adminLogout(): void
    {
        $token = $this->request->bearerToken();
        if ($token) {
            (new AuthService())->adminLogout($token);
        }
        Response::ok(['loggedOut' => true]);
    }

    /** Validate the current admin token (used by the dashboard on load). */
    public function adminMe(): void
    {
        $user = $this->requireAdmin();
        Response::ok(['user' => ['id' => (int)$user['id'], 'username' => $user['username'], 'role' => $user['role']]]);
    }

    // ---- customer auth -----------------------------------------------------

    public function customerRegister(): void
    {
        $name = trim((string)$this->request->input('name', ''));
        $phone = trim((string)$this->request->input('phone', ''));
        $password = (string)$this->request->input('password', '');
        $fields = [];
        if (mb_strlen($name) < 3) $fields['name'] = 'Naam likhein (kam az kam 3 harf).';
        if (strlen(Customer::normalizePhone($phone)) !== 11) $fields['phone'] = 'Mobile number 11 digit ka hona chahiye.';
        if (strlen($password) < 6) $fields['password'] = 'Password kam az kam 6 harf ka ho.';
        if ($fields) {
            Response::error('Form mein ghalti hai', 422, ['fields' => $fields]);
        }

        [$result, $token] = (new Customer())->register([
            'name' => $name,
            'phone' => $phone,
            'email' => (string)$this->request->input('email', ''),
            'address' => (string)$this->request->input('address', ''),
            'city' => (string)$this->request->input('city', ''),
            'password' => $password,
        ]);
        if ($token === null) {
            Response::error($result['error'] ?? 'Register nahi ho saka', 409);
        }
        Response::ok(['token' => $token, 'customer' => $result], 201);
    }

    public function customerLogin(): void
    {
        $identifier = trim((string)$this->request->input('identifier', ''));
        $password = (string)$this->request->input('password', '');
        $result = (new Customer())->login($identifier, $password);
        if (!$result) {
            Response::error('Ghalat number/email ya password', 401);
        }
        [$customer, $token] = $result;
        Response::ok(['token' => $token, 'customer' => $customer]);
    }

    /**
     * Mobile-number-only login/registration. The 11-digit phone is the unique
     * identity: existing accounts are logged in, new numbers get an account.
     */
    public function customerPhoneLogin(): void
    {
        $phone = trim((string)$this->request->input('phone', ''));
        $name = trim((string)$this->request->input('name', ''));
        $digits = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($digits) !== 11) {
            Response::error('Mobile number 11 digit ka hona chahiye', 422, ['fields' => ['phone' => 'Mobile number 11 digit ka hona chahiye.']]);
        }
        [$customer, $token] = (new Customer())->loginOrCreateByPhone($phone, $name, [
            'email'   => (string)$this->request->input('email', ''),
            'city'    => (string)$this->request->input('city', ''),
            'address' => (string)$this->request->input('address', ''),
        ]);
        Response::ok(['token' => $token, 'customer' => $customer]);
    }

    public function customerLogout(): void
    {
        $token = $this->request->bearerToken();
        if ($token) {
            (new Customer())->clearToken($token);
        }
        Response::ok(['loggedOut' => true]);
    }

    /** Current logged-in customer (used on app load to restore the session). */
    public function customerMe(): void
    {
        $customer = $this->requireCustomer();
        Response::ok(['customer' => (new Customer())->publicData($customer)]);
    }
}

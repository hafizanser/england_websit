<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Dashboard administrator. Issues Sanctum tokens for the admin API.
 * Lives in the FMCG-only `fmcg_admins` table (does not touch the shared
 * order_management `users` / `tbl_login` tables).
 */
class Admin extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'fmcg_admins';

    protected $fillable = ['username', 'password', 'role'];

    protected $hidden = ['password'];
}

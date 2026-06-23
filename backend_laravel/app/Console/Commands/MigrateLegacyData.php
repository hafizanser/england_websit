<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Admin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PDO;

/**
 * One-time importer: seeds the default admin and copies the legacy SQLite
 * storefront data (customers / orders / items / history / blog) into the new
 * MySQL FMCG tables. Idempotent — each table is only imported when empty.
 *
 *   php artisan fmcg:migrate-legacy
 *   php artisan fmcg:migrate-legacy --sqlite="D:/path/to/data.sqlite"
 */
class MigrateLegacyData extends Command
{
    protected $signature = 'fmcg:migrate-legacy {--sqlite= : Path to the legacy data.sqlite}';

    protected $description = 'Seed the admin and import legacy SQLite storefront data into MySQL';

    public function handle(): int
    {
        $this->seedAdmin();

        $path = $this->option('sqlite') ?: $this->locateSqlite();
        if (!$path || !is_file($path)) {
            $this->warn('No legacy data.sqlite found — admin seeded, nothing to import.');
            return self::SUCCESS;
        }
        $this->info("Importing from: {$path}");

        $sq = new PDO('sqlite:' . $path);
        $sq->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $sq->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        DB::transaction(function () use ($sq) {
            $this->importCustomers($sq);
            $this->importOrders($sq);
            $this->importOrderItems($sq);
            $this->importHistory($sq);
            $this->importBlogs($sq);
        });

        $this->info('Legacy import complete.');
        return self::SUCCESS;
    }

    private function seedAdmin(): void
    {
        $username = (string) config('fmcg.admin.username', 'admin');
        $password = (string) config('fmcg.admin.password', 'admin123');
        $admin = Admin::firstWhere('username', $username);
        if (!$admin) {
            Admin::create([
                'username' => $username,
                'password' => password_hash($password, PASSWORD_DEFAULT),
                'role'     => 'admin',
            ]);
            $this->info("Seeded admin '{$username}'.");
        } else {
            $this->line("Admin '{$username}' already exists — skipped.");
        }
    }

    private function locateSqlite(): ?string
    {
        foreach ([
            'D:/xamp/htdocs/FMCG_project/backend/database/data.sqlite',
            'D:/xamp/htdocs/FMCG_project/_legacy_backend/database/data.sqlite',
            base_path('../backend/database/data.sqlite'),
        ] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }
        return null;
    }

    private function skip(string $table): bool
    {
        if (DB::table($table)->count() > 0) {
            $this->line("{$table} already has rows — skipped.");
            return true;
        }
        return false;
    }

    private function importCustomers(PDO $sq): void
    {
        if ($this->skip('fmcg_customers')) {
            return;
        }
        $rows = $sq->query('SELECT * FROM customers')->fetchAll();
        foreach ($rows as $r) {
            DB::table('fmcg_customers')->insert([
                'id'         => (int) $r['id'],
                'name'       => $r['name'],
                'phone'      => $r['phone'],
                'email'      => $r['email'] ?: null,
                'address'    => $r['address'] ?: null,
                'city'       => $r['city'] ?: null,
                'password'   => $r['password_hash'] ?? null,
                'created_at' => $r['created_at'] ?? now(),
                'updated_at' => $r['created_at'] ?? now(),
            ]);
        }
        $this->info('Imported ' . count($rows) . ' customers.');
    }

    private function importOrders(PDO $sq): void
    {
        if ($this->skip('fmcg_orders')) {
            return;
        }
        $rows = $sq->query('SELECT * FROM orders')->fetchAll();
        foreach ($rows as $r) {
            DB::table('fmcg_orders')->insert([
                'id'             => (int) $r['id'],
                'code'           => $r['code'],
                'customer_id'    => (int) $r['customer_id'],
                'status'         => $r['status'] ?? 'pending',
                'subtotal'       => (int) ($r['subtotal'] ?? 0),
                'promo_discount' => (int) ($r['promo_discount'] ?? 0),
                'item_discount'  => (int) ($r['item_discount'] ?? 0),
                'delivery'       => (int) ($r['delivery'] ?? 0),
                'total'          => (int) ($r['total'] ?? 0),
                'promo_code'     => $r['promo_code'] ?? null,
                'discount_lines' => $r['discount_lines'] ?? '[]',
                'source'         => $r['source'] ?? 'website',
                'note'           => $r['note'] ?? null,
                'placed_at'      => $r['placed_at'] ?? now(),
                'created_at'     => $r['placed_at'] ?? now(),
                'updated_at'     => $r['updated_at'] ?? now(),
            ]);
        }
        $this->info('Imported ' . count($rows) . ' orders.');
    }

    private function importOrderItems(PDO $sq): void
    {
        if ($this->skip('fmcg_order_items')) {
            return;
        }
        $rows = $sq->query('SELECT * FROM order_items')->fetchAll();
        foreach ($rows as $r) {
            // Skip line items whose parent order no longer exists.
            if (!DB::table('fmcg_orders')->where('id', (int) $r['order_id'])->exists()) {
                continue;
            }
            DB::table('fmcg_order_items')->insert([
                'id'            => (int) $r['id'],
                'order_id'      => (int) $r['order_id'],
                'product_id'    => $r['product_id'] ?? null,
                'name'          => $r['name'],
                'sub'           => $r['sub'] ?? null,
                'unit'          => $r['unit'] ?? null,
                'seed'          => $r['seed'] ?? null,
                'qty'           => (int) ($r['qty'] ?? 1),
                'unit_price'    => (int) ($r['unit_price'] ?? 0),
                'line_total'    => (int) ($r['line_total'] ?? 0),
                'discount'      => (int) ($r['discount'] ?? 0),
                'discount_note' => $r['discount_note'] ?? null,
                'created_at'    => now(),
                'updated_at'    => now(),
            ]);
        }
        $this->info('Imported ' . count($rows) . ' order items.');
    }

    private function importHistory(PDO $sq): void
    {
        if ($this->skip('fmcg_order_status_history')) {
            return;
        }
        $rows = $sq->query('SELECT * FROM order_status_history')->fetchAll();
        foreach ($rows as $r) {
            // Skip history rows whose parent order no longer exists (orphans from deletes).
            if (!DB::table('fmcg_orders')->where('id', (int) $r['order_id'])->exists()) {
                continue;
            }
            DB::table('fmcg_order_status_history')->insert([
                'id'         => (int) $r['id'],
                'order_id'   => (int) $r['order_id'],
                'status'     => $r['status'],
                'note'       => $r['note'] ?? null,
                'created_at' => $r['created_at'] ?? now(),
            ]);
        }
        $this->info('Imported ' . count($rows) . ' status-history rows.');
    }

    private function importBlogs(PDO $sq): void
    {
        $rows = $sq->query('SELECT * FROM blogs')->fetchAll();
        $imported = 0;
        foreach ($rows as $r) {
            // blogs is shared; only insert posts whose slug isn't present yet.
            $exists = DB::table('blogs')->where('slug', $r['slug'])->exists();
            if ($exists) {
                continue;
            }
            DB::table('blogs')->insert([
                'title'      => $r['title'],
                'slug'       => $r['slug'],
                'excerpt'    => $r['excerpt'] ?? '',
                'content'    => $r['content'] ?? '',
                'image'      => $r['image'] ?? null,
                'author'     => $r['author'] ?? 'England',
                'status'     => $r['status'] ?? 'published',
                'created_at' => $r['created_at'] ?? now(),
                'updated_at' => $r['updated_at'] ?? now(),
            ]);
            $imported++;
        }
        $this->info("Imported {$imported} blog post(s).");
    }
}

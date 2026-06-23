<?php
declare(strict_types=1);

namespace App\Database;

use PDO;

/** Populates a fresh database with the canonical catalogue + admin user. */
class Seeder
{
    public static function run(PDO $pdo): void
    {
        $data = require __DIR__ . '/../../database/data.php';
        $config = $GLOBALS['__config'] ?? ['admin' => ['username' => 'admin', 'password' => 'admin123']];

        $pdo->beginTransaction();

        $cat = $pdo->prepare(
            'INSERT INTO categories (id, name, urdu, items, seed, tint) VALUES (?, ?, ?, ?, ?, ?)'
        );
        foreach ($data['categories'] as $c) {
            $cat->execute([$c['id'], $c['name'], $c['urdu'], $c['items'], $c['seed'], $c['tint']]);
        }

        $prod = $pdo->prepare(
            'INSERT INTO products (id, name, sub, category, category_id, seed, retail, wholesale, unit, rating, sold, badge, stock)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($data['products'] as $p) {
            $prod->execute([
                $p['id'], $p['name'], $p['sub'], $p['category'], $p['category_id'], $p['seed'],
                $p['retail'], $p['wholesale'], $p['unit'], $p['rating'], $p['sold'], $p['badge'], $p['stock'],
            ]);
        }

        $off = $pdo->prepare(
            'INSERT INTO offers (id, slug, type, kicker, tag, title, description, save_label, code, seed, theme, featured, product_ids, config, expiry, terms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($data['offers'] as $o) {
            $off->execute([
                $o['id'], $o['slug'], $o['type'], $o['kicker'], $o['tag'], $o['title'], $o['description'],
                $o['save_label'], $o['code'], $o['seed'], $o['theme'], $o['featured'],
                json_encode($o['product_ids']), json_encode($o['config']), $o['expiry'], json_encode($o['terms']),
            ]);
        }

        $admin = $config['admin'];
        $pdo->prepare('INSERT INTO users (username, password_hash, role, token) VALUES (?, ?, ?, NULL)')
            ->execute([$admin['username'], password_hash($admin['password'], PASSWORD_DEFAULT), 'admin']);

        $pdo->commit();
    }
}

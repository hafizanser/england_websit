<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\MysqlModel;

/**
 * Product reviews & ratings in the shared order_system database (reviews table).
 * product_id is FK-validated against tbl_product; customer_id stores the
 * storefront (SQLite) customer id for reference only (no FK).
 */
class RefReview extends MysqlModel
{
    protected string $table = 'reviews';

    /** Approved reviews for a product, newest first. */
    public function forProduct($productId, bool $approvedOnly = true): array
    {
        $sql = "SELECT r.*, p.product_name FROM reviews r
                LEFT JOIN tbl_product p ON p.id = r.product_id
                WHERE r.product_id = ?";
        if ($approvedOnly) {
            $sql .= " AND r.status = 'approved'";
        }
        $sql .= " ORDER BY r.id DESC";
        return array_map([$this, 'cast'], $this->run($sql, [(int)$productId])->fetchAll());
    }

    /** Average rating + count for a product (approved only). */
    public function summary($productId): array
    {
        $r = $this->run(
            "SELECT COUNT(*) c, COALESCE(AVG(rating), 0) a FROM reviews WHERE product_id = ? AND status = 'approved'",
            [(int)$productId]
        )->fetch();
        $count = (int)$r['c'];
        $breakdown = [];
        foreach ([5, 4, 3, 2, 1] as $star) {
            $breakdown[$star] = 0;
        }
        if ($count > 0) {
            foreach ($this->run("SELECT rating, COUNT(*) c FROM reviews WHERE product_id = ? AND status = 'approved' GROUP BY rating", [(int)$productId])->fetchAll() as $row) {
                $breakdown[(int)$row['rating']] = (int)$row['c'];
            }
        }
        return ['count' => $count, 'average' => round((float)$r['a'], 1), 'breakdown' => $breakdown];
    }

    public function getById(int $id): ?array
    {
        $r = $this->run(
            "SELECT r.*, p.product_name FROM reviews r LEFT JOIN tbl_product p ON p.id = r.product_id WHERE r.id = ? LIMIT 1",
            [$id]
        )->fetch();
        return $r ? $this->cast($r) : null;
    }

    /** Has this storefront customer already reviewed this product? */
    public function existsForCustomer(int $productId, int $customerId): bool
    {
        return (bool)$this->run(
            "SELECT 1 FROM reviews WHERE product_id = ? AND customer_id = ? LIMIT 1",
            [$productId, $customerId]
        )->fetchColumn();
    }

    public function create(array $d): array
    {
        $now = date('Y-m-d H:i:s');
        $this->run(
            "INSERT INTO reviews (product_id, customer_name, customer_id, rating, comment, status, is_moderated, approved_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'approved', 0, ?, ?, ?)",
            [(int)$d['product_id'], (string)$d['customer_name'], $d['customer_id'] ?? null, (int)$d['rating'], (string)$d['comment'], $now, $now, $now]
        );
        return $this->getById((int)$this->lastInsertId());
    }

    public function all(): array
    {
        return array_map(
            [$this, 'cast'],
            $this->run("SELECT r.*, p.product_name FROM reviews r LEFT JOIN tbl_product p ON p.id = r.product_id ORDER BY r.id DESC")->fetchAll()
        );
    }

    /** Recent approved reviews across all products — homepage testimonial slider. */
    public function approvedFeatured(int $limit = 12): array
    {
        return array_map(
            [$this, 'cast'],
            $this->run(
                "SELECT r.*, p.product_name FROM reviews r
                 LEFT JOIN tbl_product p ON p.id = r.product_id
                 WHERE r.status = 'approved' AND CHAR_LENGTH(r.comment) >= 12
                 ORDER BY r.id DESC LIMIT " . max(1, $limit)
            )->fetchAll()
        );
    }

    /** Recent reviews for the admin notification feed. */
    public function recent(int $limit = 6): array
    {
        return array_map(
            [$this, 'cast'],
            $this->run("SELECT r.*, p.product_name FROM reviews r LEFT JOIN tbl_product p ON p.id = r.product_id ORDER BY r.id DESC LIMIT " . max(1, $limit))->fetchAll()
        );
    }

    public function update(int $id, array $d): ?array
    {
        $sets = [];
        $params = [];
        foreach (['customer_name', 'rating', 'comment', 'status'] as $f) {
            if (array_key_exists($f, $d) && $d[$f] !== null && $d[$f] !== '') {
                $sets[] = "$f = ?";
                $params[] = $f === 'rating' ? (int)$d[$f] : $d[$f];
            }
        }
        if ($sets) {
            $params[] = $id;
            $this->run("UPDATE reviews SET " . implode(', ', $sets) . ", updated_at = NOW() WHERE id = ?", $params);
        }
        return $this->getById($id);
    }

    public function delete(int $id): void
    {
        $this->run("DELETE FROM reviews WHERE id = ?", [$id]);
    }

    private function cast(array $r): array
    {
        return [
            'id'            => (int)$r['id'],
            'product_id'    => (string)$r['product_id'],
            'product_name'  => (string)($r['product_name'] ?? ''),
            'customer_name' => (string)($r['customer_name'] ?? 'Customer'),
            'customer_id'   => isset($r['customer_id']) && $r['customer_id'] !== null ? (int)$r['customer_id'] : null,
            'rating'        => (int)$r['rating'],
            'comment'       => (string)$r['comment'],
            'status'        => (string)($r['status'] ?? 'approved'),
            'created_at'    => $r['created_at'] ?? null,
        ];
    }
}

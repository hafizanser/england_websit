<?php

declare(strict_types=1);

namespace App\Repositories;

/** Customers in the shared order_system database (tbl_customer). Port of Models\RefCustomer. */
class WholesaleCustomerRepo extends BaseRepo
{
    protected string $table = 'tbl_customer';

    private const WRITABLE = [
        'customer_name', 'customer_address', 'customer_phone_number',
        'shop_name', 'adda_name', 'pandi_name', 'ptcl_number', 'email',
    ];

    public function withStats(): array
    {
        $sql = "SELECT c.*,
                       COUNT(o.id)                       AS orders_count,
                       COALESCE(SUM(o.total_amount), 0)  AS total_spent,
                       MAX(o.city)                       AS city
                FROM tbl_customer c
                LEFT JOIN orders o ON o.customer_id = c.id
                GROUP BY c.id
                ORDER BY c.id DESC";
        return array_map([$this, 'shape'], $this->select($sql));
    }

    public function getById(int $id): ?array
    {
        $row = $this->first("SELECT * FROM {$this->table} WHERE id = ? LIMIT 1", [$id]);
        return $row ? $this->shape($row) : null;
    }

    public function insert(array $data): array
    {
        $row = $this->prepareRow($data);
        $now = date('Y-m-d H:i:s');
        $row['created_at'] = $now;
        $row['updated_at'] = $now;
        $cols = array_keys($row);
        $place = implode(', ', array_map(fn ($c) => ':' . $c, $cols));
        $this->exec("INSERT INTO {$this->table} (" . implode(', ', $cols) . ") VALUES ($place)", $row);
        return $this->getById($this->lastId());
    }

    public function update(int $id, array $data): array
    {
        $row = $this->prepareRow($data);
        $row['updated_at'] = date('Y-m-d H:i:s');
        $set = implode(', ', array_map(fn ($c) => "$c = :$c", array_keys($row)));
        $row['__id'] = $id;
        $this->exec("UPDATE {$this->table} SET $set WHERE id = :__id", $row);
        return $this->getById($id);
    }

    public function delete(int $id): void
    {
        $this->exec("DELETE FROM {$this->table} WHERE id = ?", [$id]);
    }

    public function orders(int $id): array
    {
        $sql = "SELECT id, total_amount, status, order_date, created_at, city
                FROM orders WHERE customer_id = ? ORDER BY id DESC";
        $rows = $this->select($sql, [$id]);
        return array_map(fn ($o) => [
            'id'        => (int) $o['id'],
            'code'      => WholesaleOrderRepo::code((int) $o['id']),
            'status'    => $o['status'],
            'total'     => (float) $o['total_amount'],
            'placed_at' => $o['order_date'] ?: $o['created_at'],
            'city'      => $o['city'],
        ], $rows);
    }

    private function prepareRow(array $data): array
    {
        $row = [];
        foreach (self::WRITABLE as $col) {
            if (array_key_exists($col, $data)) {
                $row[$col] = $data[$col] === '' ? null : $data[$col];
            }
        }
        return $row;
    }

    private function shape(array $row): array
    {
        $row['name']    = $row['customer_name'] ?? '';
        $row['phone']   = $row['customer_phone_number'] ?? '';
        $row['address'] = $row['customer_address'] ?? '';
        if (isset($row['orders_count'])) {
            $row['orders_count'] = (int) $row['orders_count'];
        }
        if (isset($row['total_spent'])) {
            $row['total_spent'] = (float) $row['total_spent'];
        }
        return $row;
    }
}

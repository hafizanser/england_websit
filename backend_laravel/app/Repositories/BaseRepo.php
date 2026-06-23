<?php

declare(strict_types=1);

namespace App\Repositories;

use Illuminate\Support\Facades\DB;

/**
 * Thin query helper so the legacy raw-SQL projections can be ported almost
 * verbatim. Returns associative arrays (PDO::FETCH_ASSOC equivalent) to keep
 * the ported array-manipulation logic identical to the old backend.
 */
abstract class BaseRepo
{
    /** @return array<int,array<string,mixed>> */
    protected function select(string $sql, array $bindings = []): array
    {
        return array_map(fn ($r) => (array) $r, DB::select($sql, $bindings));
    }

    /** @return array<string,mixed>|null */
    protected function first(string $sql, array $bindings = []): ?array
    {
        $row = DB::selectOne($sql, $bindings);
        return $row ? (array) $row : null;
    }

    /** Run an INSERT/UPDATE/DELETE (positional ? or named :param bindings). */
    protected function exec(string $sql, array $bindings = []): void
    {
        DB::statement($sql, $bindings);
    }

    /** Single scalar value from the first column of the first row. */
    protected function scalar(string $sql, array $bindings = []): mixed
    {
        $row = DB::selectOne($sql, $bindings);
        if (!$row) {
            return null;
        }
        $arr = (array) $row;
        return reset($arr);
    }

    protected function lastId(): int
    {
        return (int) DB::getPdo()->lastInsertId();
    }
}

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mixed ERP invoices (England items plus another company's items): the feed sends only the
 * England lines; this column keeps how many other-company lines the invoice also has, so the
 * app can say the invoice total covers more than the lines it shows.
 *
 * Additive only: one new column with a default on fmcg_erp_sales (the app's own read-only copy).
 * No ERP data and no website order data is touched. down() drops just this column.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fmcg_erp_sales', function (Blueprint $table) {
            $table->unsignedSmallInteger('other_company_lines')->default(0)->after('items_count');
        });
    }

    public function down(): void
    {
        Schema::table('fmcg_erp_sales', function (Blueprint $table) {
            $table->dropColumn('other_company_lines');
        });
    }
};

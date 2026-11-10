<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Builty (cargo receipt) photos: the staff app now keeps a FRONT and a BACK image
 * for each order. The existing slip_* columns are the front image (any slip already
 * uploaded simply becomes the front); this adds the back image alongside.
 *
 * Additive only: new nullable columns on fmcg_order_deliveries. No other table, no
 * existing column and no existing row value changes. Rolling back drops just these.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fmcg_order_deliveries', function (Blueprint $table) {
            $table->string('builty_back_path')->nullable()->after('slip_uploaded_by');   // relative to fmcg.slips_path
            $table->string('builty_back_mime', 40)->nullable()->after('builty_back_path');
            $table->unsignedInteger('builty_back_size')->nullable()->after('builty_back_mime'); // bytes
            $table->unsignedInteger('builty_back_width')->nullable()->after('builty_back_size');
            $table->unsignedInteger('builty_back_height')->nullable()->after('builty_back_width');
            $table->string('builty_back_sha256', 64)->nullable()->after('builty_back_height');
            $table->timestamp('builty_back_uploaded_at')->nullable()->after('builty_back_sha256');
            $table->unsignedBigInteger('builty_back_uploaded_by')->nullable()->after('builty_back_uploaded_at'); // fmcg_admins.id
        });
    }

    public function down(): void
    {
        Schema::table('fmcg_order_deliveries', function (Blueprint $table) {
            $table->dropColumn([
                'builty_back_path', 'builty_back_mime', 'builty_back_size', 'builty_back_width',
                'builty_back_height', 'builty_back_sha256', 'builty_back_uploaded_at', 'builty_back_uploaded_by',
            ]);
        });
    }
};

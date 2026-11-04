<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Delivery details kept by the England Orders mobile app, one row per order:
 * the planned delivery date (empty = the order date), the Pandi Name and Adda Name,
 * and the uploaded Pandi delivery-slip photo.
 *
 * A separate table on purpose: fmcg_orders (totals, status, stock reservations) is
 * never written by the app, so no existing order, invoice or stock figure can change.
 * Additive only — dropping this table restores the database exactly.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fmcg_order_deliveries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id')->unique();
            $table->date('delivery_date')->nullable()->index();
            $table->string('pandi_name', 120)->nullable();
            $table->string('adda_name', 120)->nullable();
            $table->string('slip_path')->nullable();          // relative to fmcg.slips_path
            $table->string('slip_mime', 40)->nullable();
            $table->unsignedInteger('slip_size')->nullable(); // bytes
            $table->unsignedInteger('slip_width')->nullable();
            $table->unsignedInteger('slip_height')->nullable();
            $table->string('slip_sha256', 64)->nullable();
            $table->timestamp('slip_uploaded_at')->nullable();
            $table->unsignedBigInteger('slip_uploaded_by')->nullable(); // fmcg_admins.id
            $table->unsignedBigInteger('updated_by')->nullable();       // fmcg_admins.id
            $table->timestamps();
            $table->foreign('order_id')->references('id')->on('fmcg_orders')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fmcg_order_deliveries');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ERP sales in the England Staff app.
 *
 *   fmcg_erp_sales            Read-only copy of posted Accountrix ERP sales, refreshed from the
 *                             ERP's feed (App\Services\ErpSalesSync). One row per ERP sale
 *                             (unique erp_sale_id), keeping the ERP's own invoice number,
 *                             customer, date and total. It is NOT a website order: nothing is
 *                             ever written to fmcg_orders, and the ERP is never written to.
 *   fmcg_erp_sale_deliveries  What the staff app records against an ERP sale: delivery date,
 *                             Pandi Name, Adda Name and the Builty front/back images — the same
 *                             columns fmcg_order_deliveries has for website orders.
 *   fmcg_sync_state           The feed cursor and last sync result (one row per feed).
 *
 * Additive only: three new tables, no existing table touched. Dropping them restores the
 * database exactly.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fmcg_erp_sales', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('erp_sale_id')->unique();
            $table->unsignedBigInteger('erp_business_id')->nullable();
            $table->string('invoice_no', 64)->index();
            $table->string('offline_no', 64)->nullable();
            $table->date('sale_date')->index();                 // the ERP invoice date (business day)
            $table->string('erp_status', 20)->default('posted');
            $table->decimal('net_total', 14, 2)->default(0);
            $table->unsignedBigInteger('erp_customer_id')->nullable();
            $table->string('customer_name')->nullable();
            $table->string('customer_phone', 40)->nullable();
            $table->string('customer_address')->nullable();
            $table->string('city', 120)->nullable();
            $table->string('erp_pandi_name', 120)->nullable();  // as entered on the ERP invoice
            $table->string('erp_pandi_phone', 40)->nullable();
            $table->string('erp_adda_name', 120)->nullable();
            $table->string('vehicle', 120)->nullable();
            $table->text('remarks')->nullable();
            $table->longText('items');                            // JSON list of lines (names and quantities)
            $table->unsignedInteger('items_count')->default(0);
            $table->timestamp('erp_created_at')->nullable()->index(); // UTC
            $table->timestamp('erp_updated_at')->nullable();          // UTC
            $table->timestamp('erp_removed_at')->nullable();          // the ERP no longer lists it (deleted / unposted)
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();
        });

        Schema::create('fmcg_erp_sale_deliveries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('erp_sale_id')->unique();      // fmcg_erp_sales.id
            $table->date('delivery_date')->nullable()->index();
            $table->string('pandi_name', 120)->nullable();
            $table->string('adda_name', 120)->nullable();
            foreach (['slip', 'builty_back'] as $p) {
                $table->string($p . '_path')->nullable();
                $table->string($p . '_mime', 40)->nullable();
                $table->unsignedInteger($p . '_size')->nullable();
                $table->unsignedInteger($p . '_width')->nullable();
                $table->unsignedInteger($p . '_height')->nullable();
                $table->string($p . '_sha256', 64)->nullable();
                $table->timestamp($p . '_uploaded_at')->nullable();
                $table->unsignedBigInteger($p . '_uploaded_by')->nullable();
            }
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->foreign('erp_sale_id')->references('id')->on('fmcg_erp_sales')->cascadeOnDelete();
        });

        Schema::create('fmcg_sync_state', function (Blueprint $table) {
            $table->id();
            $table->string('name', 40)->unique();
            $table->string('cursor_since', 32)->nullable();
            $table->unsignedBigInteger('cursor_after_id')->default(0);
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamp('last_success_at')->nullable();
            $table->timestamp('last_reconciled_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fmcg_erp_sale_deliveries');
        Schema::dropIfExists('fmcg_erp_sales');
        Schema::dropIfExists('fmcg_sync_state');
    }
};

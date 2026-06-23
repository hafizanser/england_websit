<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fmcg_order_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->string('product_id')->nullable(); // storefront product id (tbl_product.id as string)
            $table->string('name');
            $table->string('sub')->nullable();
            $table->string('unit')->nullable();
            $table->string('seed')->nullable();
            $table->integer('qty')->default(1);
            $table->integer('unit_price')->default(0);
            $table->integer('line_total')->default(0);
            $table->integer('discount')->default(0);
            $table->string('discount_note')->nullable();
            $table->timestamps();
            $table->index('order_id');
            $table->foreign('order_id')->references('id')->on('fmcg_orders')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fmcg_order_items');
    }
};

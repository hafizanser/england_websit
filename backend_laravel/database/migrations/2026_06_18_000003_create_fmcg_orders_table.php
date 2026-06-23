<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fmcg_orders', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();           // ENG-1001, ENG-1002, ...
            $table->unsignedBigInteger('customer_id');
            $table->string('status')->default('pending');
            $table->integer('subtotal')->default(0);
            $table->integer('promo_discount')->default(0);
            $table->integer('item_discount')->default(0);
            $table->integer('delivery')->default(0);
            $table->integer('total')->default(0);
            $table->string('promo_code')->nullable();
            $table->text('discount_lines')->nullable();  // JSON array
            $table->string('source')->default('website'); // website | admin
            $table->text('note')->nullable();
            $table->timestamp('placed_at')->nullable();
            $table->timestamps();
            $table->index('customer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fmcg_orders');
    }
};

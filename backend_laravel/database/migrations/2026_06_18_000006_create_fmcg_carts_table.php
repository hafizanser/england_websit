<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fmcg_carts', function (Blueprint $table) {
            $table->unsignedBigInteger('customer_id')->primary();
            $table->text('rows');            // JSON array of cart rows
            $table->string('code')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->foreign('customer_id')->references('id')->on('fmcg_customers')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fmcg_carts');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('pdf_documents')) {
            Schema::create('pdf_documents', function (Blueprint $table) {
                $table->id();
                $table->string('title');
                $table->string('file_path');
                $table->integer('position')->default(0);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pdf_documents');
    }
};

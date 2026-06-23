<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // `blogs` is shared with the order_management app; adding a nullable
        // column is backward-compatible (order_management simply ignores it).
        if (Schema::hasTable('blogs') && !Schema::hasColumn('blogs', 'excerpt')) {
            Schema::table('blogs', function (Blueprint $table) {
                $table->text('excerpt')->nullable()->after('content');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('blogs', 'excerpt')) {
            Schema::table('blogs', function (Blueprint $table) {
                $table->dropColumn('excerpt');
            });
        }
    }
};

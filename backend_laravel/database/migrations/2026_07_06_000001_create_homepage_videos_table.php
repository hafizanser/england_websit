<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Homepage "See the products in action" video reels — the cards rendered by the
 * front-end `.video-section.reveal.in` (VideoReviews.jsx). Owned entirely by this
 * dashboard, so it is a normal owned table (not a shared order_management one).
 *
 * A row is EITHER an uploaded/re-hosted file (`video_file`) OR — as a last-ditch
 * fallback when a Drive download fails — a direct Drive URL (also stored in
 * `video_file` as an absolute http URL). `drive_url` keeps the original pasted
 * link for reference/re-fetching. Legacy seed rows point at the already-shipped
 * /public/videos/dvreel-NN.mp4 files (a site-relative path) so the existing reels
 * keep working with no re-upload.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('homepage_videos')) {
            Schema::create('homepage_videos', function (Blueprint $table) {
                $table->id();
                $table->string('title')->nullable();
                $table->integer('position')->default(0);
                $table->string('source_type', 16)->default('upload'); // 'upload' | 'drive'
                $table->string('video_file')->nullable();  // stored filename, site path, or direct URL
                $table->string('poster_file')->nullable(); // stored poster filename or site path
                $table->text('drive_url')->nullable();      // original Google Drive link (drive source)
                $table->tinyInteger('is_active')->default(1);
                $table->timestamps();
                $table->index(['is_active', 'position']);
            });
        }

        // Seed the existing reels in their current card order so they load into
        // the dashboard automatically and keep playing without a re-add. Only
        // seed once (empty table) so re-running migrations never duplicates.
        $count = (int) (DB::table('homepage_videos')->count());
        if ($count === 0) {
            // Mirrors VideoReviews.jsx REEL_NUMS — the exact on-screen order.
            $reelNums = [1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
            $now = now();
            $rows = [];
            foreach ($reelNums as $i => $n) {
                $nn = str_pad((string) $n, 2, '0', STR_PAD_LEFT);
                $rows[] = [
                    'title'       => null,
                    'position'    => $i + 1,
                    'source_type' => 'upload',
                    'video_file'  => "/videos/dvreel-{$nn}.mp4",  // site-relative, served by the SPA host
                    'poster_file' => "/videos/dvreel-{$nn}.jpg",
                    'drive_url'   => null,
                    'is_active'   => 1,
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ];
            }
            DB::table('homepage_videos')->insert($rows);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('homepage_videos');
    }
};

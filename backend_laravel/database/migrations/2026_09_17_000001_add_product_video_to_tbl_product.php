<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-product preview clip — the little playing badge on the corner of a product
 * card and on the detail page gallery.
 *
 * Until now there was no such column, so the storefront faked it: lib/productMedia.js
 * hashed the product id and handed back one of ten reels shipped in /public/videos.
 * Every product showed a clip, and none of them showed ITS OWN. This is the field
 * that makes the badge mean something, and it is why that mapping is gone.
 *
 * `tbl_product` is shared with the order_management app, so both columns are
 * NULLABLE and additive — that app selects the columns it knows and is unaffected.
 * The guards make the migration safe to re-run against a database where someone
 * has already added them by hand.
 *
 * WHAT THE COLUMNS HOLD. The same convention as `homepage_videos.video_file`,
 * because they are read back through the same VideoStorage::url():
 *
 *   a bare filename   a clip stored in the videos folder → GET /video?file=NAME
 *   an absolute URL   a Drive direct-stream fallback
 *   a site path       a legacy /videos/… reel served by the SPA host
 *
 * The poster is a JPG that VideoStorage generates from an early frame while it
 * optimises the upload. It is nullable on its own: ffmpeg may be missing on a
 * given host, in which case the clip still plays and the card falls back to the
 * product photo, which is what the badge did before this existed.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('tbl_product')) {
            return;
        }

        Schema::table('tbl_product', function (Blueprint $table) {
            if (!Schema::hasColumn('tbl_product', 'product_video')) {
                $table->string('product_video')->nullable()->after('multiple_images');
            }
            if (!Schema::hasColumn('tbl_product', 'product_video_poster')) {
                $table->string('product_video_poster')->nullable()->after('product_video');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('tbl_product')) {
            return;
        }

        // Dropped one at a time, and only if present: a half-applied `up()` (the
        // first column added, the second failing) must still roll back cleanly.
        Schema::table('tbl_product', function (Blueprint $table) {
            if (Schema::hasColumn('tbl_product', 'product_video_poster')) {
                $table->dropColumn('product_video_poster');
            }
            if (Schema::hasColumn('tbl_product', 'product_video')) {
                $table->dropColumn('product_video');
            }
        });
    }
};

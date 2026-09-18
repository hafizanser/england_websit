<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Repositories\ProductRepo;
use App\Support\Api;
use App\Support\ChunkedUpload;
use App\Support\Uploads;
use App\Support\VideoStorage;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

/** Admin product management against the shared order_system catalogue (tbl_product). */
class ProductController extends Controller
{
    public function index()
    {
        return Api::ok(['data' => (new ProductRepo())->all()]);
    }

    public function show(Request $request, string $id)
    {
        $product = (new ProductRepo())->getById((int) $id);
        if (!$product) {
            Api::halt('Product nahi mila', 404);
        }
        return Api::ok(['product' => $product]);
    }

    public function store(Request $request)
    {
        $this->assertBodyArrived($request);
        $d = $request->all();
        if (mb_strlen(trim((string) ($d['product_name'] ?? ''))) < 2) {
            Api::halt('Product ka naam likhein', 422);
        }

        $data = $this->payload($d);

        if ($request->hasFile('product_image')) {
            $data['product_image'] = Uploads::save($request->file('product_image'));
        }

        $gallery = [];
        foreach ($this->fileList($request, 'multiple_images') as $file) {
            $gallery[] = Uploads::save($file, (string) rand(100, 999));
        }
        $data['multiple_images'] = $gallery;

        $data += $this->videoColumns($request, null);

        return Api::ok(['product' => (new ProductRepo())->insert($data)], 201);
    }

    public function update(Request $request, string $id)
    {
        $id = (int) $id;
        $model = new ProductRepo();
        $existing = $model->getById($id);
        if (!$existing) {
            Api::halt('Product nahi mila', 404);
        }

        $this->assertBodyArrived($request);
        $d = $request->all();
        $data = $this->payload($d);

        if ($request->hasFile('product_image')) {
            $data['product_image'] = Uploads::save($request->file('product_image'));
            if (!empty($existing['product_image'])) {
                Uploads::delete($existing['product_image']);
            }
        }

        $old = $existing['multiple_images'] ?? [];
        if (array_key_exists('existing_images', $d)) {
            $keep = $d['existing_images'];
            if (is_string($keep)) {
                $decoded = json_decode($keep, true);
                $keep = is_array($decoded) ? $decoded : array_filter(array_map('trim', explode(',', $keep)));
            }
            $keep = is_array($keep) ? array_values($keep) : [];
            foreach (array_diff($old, $keep) as $removed) {
                Uploads::delete($removed);
            }
        } else {
            $keep = $old;
        }
        foreach ($this->fileList($request, 'multiple_images') as $file) {
            $keep[] = Uploads::save($file, (string) rand(100, 999));
        }
        $data['multiple_images'] = array_values(array_filter($keep));

        $data += $this->videoColumns($request, $existing);

        return Api::ok(['product' => $model->update($id, $data)]);
    }

    public function destroy(Request $request, string $id)
    {
        (new ProductRepo())->delete((int) $id);
        return Api::ok(['deleted' => (int) $id]);
    }

    // ---- helpers -----------------------------------------------------------

    /**
     * The product's preview clip, as columns to write — or an EMPTY ARRAY meaning
     * "this request said nothing about the video, leave it exactly as it is".
     *
     * That empty return is the important case, not an afterthought. The admin list
     * flips Active/Inactive by re-submitting the whole product row
     * (AdminProducts.jsx → toggleStatus), and that submission carries no file and
     * no removal flag. Returning nulls there — or folding these columns into
     * payload() with the rest — would mean every toggle silently deleted the clip
     * the admin had just uploaded. ProductRepo::prepareRow only writes columns it
     * is actually given, so saying nothing is how you say "don't touch it".
     *
     * Four things can be asked for, and only one of them per request:
     *
     *   product_video_upload  the id of a clip already uploaded in pieces
     *                         (Admin\VideoUploadController) — how the dashboard
     *                         sends every video now; stored, the previous clip deleted
     *   a new file            the same, for a clip sent inside this request
     *   product_video_action  'remove' → the clip is deleted and the columns cleared
     *   anything else         no change
     *
     * @return array{product_video?:string|null,product_video_poster?:string|null}
     */
    private function videoColumns(Request $request, ?array $existing): array
    {
        // A clip uploaded in pieces beforehand. One long request was being cut
        // off by the host at ~300 s — see App\Support\ChunkedUpload. The pieces
        // are discarded whatever happens here: stored, refused or incomplete.
        $uploadId = trim((string) $request->input('product_video_upload', ''));
        if ($uploadId !== '') {
            try {
                $stored = VideoStorage::storeProductUpload(ChunkedUpload::finish($uploadId));
            } finally {
                ChunkedUpload::discard($uploadId);
            }
            $this->deleteVideo($existing);

            return [
                'product_video'        => $stored['video_file'],
                'product_video_poster' => $stored['poster_file'],
            ];
        }

        // A REJECTED UPLOAD MUST NOT LOOK LIKE NO UPLOAD.
        //
        // `hasFile()` is false for a file PHP refused as well as for one that was
        // never sent — Laravel's isValidFile() only checks that the temp path is
        // non-empty, and a file over upload_max_filesize has no temp path. Both
        // therefore fell into the "nothing was said about the video" branch
        // below, which is the branch that deliberately changes nothing. The
        // result was the worst possible outcome: the admin waits out a 64 MB
        // upload, the save returns 200, the dashboard says "Product update ho
        // gaya", and the clip is nowhere. Ask the file why it is invalid first.
        $upload = $request->file('product_video');
        if ($upload instanceof UploadedFile && !$upload->isValid()) {
            Api::halt(self::uploadErrorMessage($upload->getError()), 422);
        }

        if ($request->hasFile('product_video')) {
            // Stored without transcoding in this request — see
            // VideoStorage::storeProductUpload. A full ffmpeg encode here would
            // hold the request for minutes, and this host ends every request at
            // ~300 s with a 503. A web-ready upload (what the admin panel's
            // compressor produces) is kept as-is; anything else is finished by a
            // detached background job.
            $stored = VideoStorage::storeProductUpload($request->file('product_video'));
            $this->deleteVideo($existing);

            return [
                'product_video'        => $stored['video_file'],
                'product_video_poster' => $stored['poster_file'],
            ];
        }

        if ((string) $request->input('product_video_action', '') === 'remove') {
            $this->deleteVideo($existing);

            return ['product_video' => null, 'product_video_poster' => null];
        }

        return [];
    }

    /**
     * A POST whose body PHP threw away before Laravel ever saw it.
     *
     * When a request exceeds post_max_size, PHP discards $_POST AND $_FILES
     * wholesale and carries on with an empty request. Without this check the
     * consequences are silent and destructive rather than merely confusing: on
     * create, the caller gets "Product ka naam likhein" for a form they filled
     * in correctly; on UPDATE, payload() reads a missing product_name as '' and
     * writes that over the real one — an oversized video upload would rename the
     * product to nothing.
     */
    private function assertBodyArrived(Request $request): void
    {
        $declared = (int) $request->server('CONTENT_LENGTH', 0);
        if ($declared > 0 && count($request->all()) === 0 && count($request->allFiles()) === 0) {
            Api::halt(
                'File bohat bari hai — server ne poori request hi reject kar di (post_max_size). '
                . 'Chhoti video use karein, ya hosting par post_max_size barhwaein.',
                413
            );
        }
    }

    /** Why PHP refused an uploaded file, in words the dashboard can act on. */
    private static function uploadErrorMessage(int $code): string
    {
        return match ($code) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE =>
                'Video server ki upload limit se bari hai (upload_max_filesize). '
                . 'Chhoti clip use karein, ya hosting par limit barhwaein.',
            UPLOAD_ERR_PARTIAL =>
                'Video adhoori upload hui — connection toot gaya. Dobara koshish karein.',
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE =>
                'Server video ko save nahi kar saka (temp folder ka masla). Hosting support se rabta karein.',
            UPLOAD_ERR_EXTENSION =>
                'Server ki kisi PHP extension ne upload rok diya.',
            default => 'Video upload nahi ho saki. Dobara koshish karein.',
        };
    }

    /** Drop a product's previously stored clip + poster (best-effort). */
    private function deleteVideo(?array $existing): void
    {
        if (!$existing) {
            return;
        }
        VideoStorage::delete($existing['product_video'] ?? null);
        VideoStorage::delete($existing['product_video_poster'] ?? null);
    }

    /** Normalise a single-or-multi file field to a flat list of UploadedFile. */
    private function fileList(Request $request, string $key): array
    {
        $f = $request->file($key);
        if ($f === null) {
            return [];
        }
        return is_array($f) ? array_values($f) : [$f];
    }

    private function payload(array $d): array
    {
        return [
            'category_id'             => $this->filled($d, 'category_id') ? (int) $d['category_id'] : null,
            'product_name'            => (string) ($d['product_name'] ?? ''),
            'short_description'        => $this->strOrNull($d, 'short_description'),
            'product_description'      => $this->strOrNull($d, 'product_description'),
            'piece_price'             => (float) ($d['piece_price'] ?? 0),
            'box_price'               => (float) ($d['box_price'] ?? 0),
            'cotton_price'            => (float) ($d['cotton_price'] ?? 0),
            'packet_price'            => $this->numOrNull($d, 'packet_price'),
            'dozen_price'             => $this->numOrNull($d, 'dozen_price'),
            'bundle_price'            => $this->numOrNull($d, 'bundle_price'),
            'unit_types'              => ProductRepo::normalizeUnitTypes($d['unit_types'] ?? []),
            'production_piece_price'  => $this->numOrNull($d, 'production_piece_price'),
            'production_box_price'    => $this->numOrNull($d, 'production_box_price'),
            'production_cotton_price' => $this->numOrNull($d, 'production_cotton_price'),
            'production_packet_price' => $this->numOrNull($d, 'production_packet_price'),
            'production_dozen_price'  => $this->numOrNull($d, 'production_dozen_price'),
            'production_bundle_price' => $this->numOrNull($d, 'production_bundle_price'),
            'dozen_in_box'            => (float) ($d['dozen_in_box'] ?? 0),
            'boxes_in_cotton'         => (int) ($d['boxes_in_cotton'] ?? 0),
            'pieces_per_bundle'       => $this->numOrNull($d, 'pieces_per_bundle'),
            'pieces_per_packet'       => $this->numOrNull($d, 'pieces_per_packet'),
            'total_stock_cotton'      => (float) ($d['total_stock_cotton'] ?? 0),
            'mrp_piece'               => $this->numOrNull($d, 'mrp_piece'),
            'mrp_box'                 => $this->numOrNull($d, 'mrp_box'),
            'mrp_carton'              => $this->numOrNull($d, 'mrp_carton'),
            'mrp_packet'              => $this->numOrNull($d, 'mrp_packet'),
            'mrp_dozen'               => $this->numOrNull($d, 'mrp_dozen'),
            'mrp_bundle'              => $this->numOrNull($d, 'mrp_bundle'),
            'show_profit_breakdown'   => $this->boolInt($d, 'show_profit_breakdown', true),
            'is_featured'             => $this->boolInt($d, 'is_featured', false),
            'is_active'               => $this->boolInt($d, 'is_active', true),
        ];
    }

    private function filled(array $d, string $k): bool
    {
        return isset($d[$k]) && trim((string) $d[$k]) !== '';
    }

    private function strOrNull(array $d, string $k): ?string
    {
        return $this->filled($d, $k) ? (string) $d[$k] : null;
    }

    private function numOrNull(array $d, string $k): ?float
    {
        return $this->filled($d, $k) ? (float) $d[$k] : null;
    }

    private function boolInt(array $d, string $k, bool $default): int
    {
        if (!array_key_exists($k, $d)) {
            return $default ? 1 : 0;
        }
        return in_array($d[$k], [true, 1, '1', 'true', 'on', 'yes'], true) ? 1 : 0;
    }
}

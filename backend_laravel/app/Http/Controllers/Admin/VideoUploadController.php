<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Api;
use App\Support\ChunkedUpload;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

/**
 * A product video, uploaded in pieces before the product itself is saved. Why
 * pieces at all — the host's 300 s cut-off and HTTP/2's 64 KB window — is in
 * App\Support\ChunkedUpload.
 *
 *   POST   /admin/video-uploads         {name, size}          → {id, chunk_bytes, chunks}
 *   POST   /admin/video-uploads/{id}    multipart index+chunk  → {ok}
 *   DELETE /admin/video-uploads/{id}                           → {ok}  (abandon)
 *
 * The product save then sends `product_video_upload=<id>` in place of the file
 * (Admin\ProductController::videoColumns).
 */
class VideoUploadController extends Controller
{
    public function start(Request $request)
    {
        return Api::ok(ChunkedUpload::start(
            (string) $request->input('name', ''),
            (int) $request->input('size', 0),
        ));
    }

    public function chunk(Request $request, string $id)
    {
        $piece = $request->file('chunk');
        if ($piece instanceof UploadedFile && !$piece->isValid()) {
            Api::halt(self::pieceError($piece->getError()), $piece->getError() === UPLOAD_ERR_PARTIAL ? 409 : 422);
        }
        if (!$piece instanceof UploadedFile) {
            Api::halt('Video ka hissa server tak nahi pohncha.', 409);
        }

        ChunkedUpload::put($id, (int) $request->input('index', -1), $piece);

        return Api::ok();
    }

    public function discard(string $id)
    {
        ChunkedUpload::discard($id);

        return Api::ok();
    }

    /** Why PHP refused a piece, in words the dashboard can act on. */
    private static function pieceError(int $code): string
    {
        return match ($code) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE =>
                'Video ka hissa server ki upload limit (upload_max_filesize) se bara hai.',
            UPLOAD_ERR_PARTIAL =>
                'Video ka hissa adhoora pohncha.',
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE =>
                'Server video ko save nahi kar saka (temp folder ka masla). Hosting support se rabta karein.',
            default => 'Video upload nahi ho saki. Dobara koshish karein.',
        };
    }
}

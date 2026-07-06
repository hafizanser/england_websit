<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Repositories\HomepageVideoRepo;
use App\Support\Api;
use App\Support\VideoStorage;
use Illuminate\Http\Request;

/** Admin homepage-reel management — full CRUD + drag/drop reorder. */
class HomepageVideoController extends Controller
{
    public function index()
    {
        return Api::ok(['data' => (new HomepageVideoRepo())->all()]);
    }

    public function store(Request $request)
    {
        $repo = new HomepageVideoRepo();
        $data = $this->resolveSource($request, null);
        $data['title']     = self::str($request->input('title'));
        $data['position']  = self::position($request);
        $data['is_active'] = self::boolInt($request, 'is_active', true);

        return Api::ok(['video' => $repo->insert($data)], 201);
    }

    public function update(Request $request, string $id)
    {
        $id = (int) $id;
        $repo = new HomepageVideoRepo();
        $existing = $repo->getById($id);
        if (!$existing) {
            Api::halt('Video nahi mila', 404);
        }

        // Only touch a field when it was actually submitted, so partial updates
        // (e.g. the list's active-toggle, which sends no title) never wipe values.
        $data = $this->resolveSource($request, $existing);
        if ($request->has('title')) {
            $data['title'] = self::str($request->input('title'));
        }
        if ($request->filled('position')) {
            $data['position'] = self::position($request);
        }
        if ($request->has('is_active')) {
            $data['is_active'] = self::boolInt($request, 'is_active', (bool) $existing['is_active']);
        }

        return Api::ok(['video' => $repo->update($id, $data)]);
    }

    public function destroy(Request $request, string $id)
    {
        (new HomepageVideoRepo())->remove((int) $id);
        return Api::ok(['deleted' => (int) $id]);
    }

    /** POST /admin/homepage-videos/reorder  { order: [id, id, ...] } */
    public function reorder(Request $request)
    {
        $order = $request->input('order', []);
        if (is_string($order)) {
            $decoded = json_decode($order, true);
            $order = is_array($decoded) ? $decoded : array_filter(array_map('trim', explode(',', $order)));
        }
        if (!is_array($order)) {
            Api::halt('Order list chahiye', 422);
        }
        return Api::ok(['data' => (new HomepageVideoRepo())->reorder($order)]);
    }

    /**
     * Turn the submitted source (an uploaded file OR a Google Drive link) into the
     * stored columns. Only ONE source is active per request. Drive links are
     * re-hosted (downloaded + optimised) so they play identically to uploads; if
     * the download fails we fall back to a direct Drive stream URL. On edit with
     * no new source the existing files are kept untouched.
     *
     * @return array{source_type?:string,video_file?:string|null,poster_file?:string|null,drive_url?:string|null}
     */
    private function resolveSource(Request $request, ?array $existing): array
    {
        $type = (string) $request->input('source_type', $existing['source_type'] ?? 'upload');

        // 1) A new file was uploaded → optimise + store (wins over any link).
        if ($request->hasFile('video')) {
            $stored = VideoStorage::saveUpload($request->file('video'));
            $this->deleteOldFiles($existing);
            return [
                'source_type' => 'upload',
                'video_file'  => $stored['video_file'],
                'poster_file' => $stored['poster_file'],
                'drive_url'   => null,
            ];
        }

        // 2) A Google Drive link was provided → re-host it (or fall back to direct).
        $driveUrl = trim((string) $request->input('drive_url', ''));
        if ($type === 'drive' && $driveUrl !== '') {
            // Unchanged link on edit → keep the already-stored (re-hosted) file.
            if ($existing && ($existing['drive_url'] ?? '') === $driveUrl && !empty($existing['video_file'])) {
                return ['source_type' => 'drive', 'drive_url' => $driveUrl];
            }
            if (VideoStorage::driveId($driveUrl) === null) {
                Api::halt('Google Drive link theek nahi lagta', 422);
            }
            $stored = VideoStorage::saveFromDrive($driveUrl);
            $this->deleteOldFiles($existing);
            if ($stored) {
                return [
                    'source_type' => 'drive',
                    'video_file'  => $stored['video_file'],
                    'poster_file' => $stored['poster_file'],
                    'drive_url'   => $driveUrl,
                ];
            }
            // Re-host failed (private / quota) → play straight from Drive.
            return [
                'source_type' => 'drive',
                'video_file'  => VideoStorage::driveDirectUrl($driveUrl),
                'poster_file' => null,
                'drive_url'   => $driveUrl,
            ];
        }

        // 3) No new source.
        if (!$existing) {
            Api::halt('Video upload karein ya Google Drive link dein', 422);
        }
        return []; // keep existing files/source as-is
    }

    private function deleteOldFiles(?array $existing): void
    {
        if (!$existing) {
            return;
        }
        VideoStorage::delete($existing['video_file'] ?? null);
        VideoStorage::delete($existing['poster_file'] ?? null);
    }

    private static function str($v): ?string
    {
        $v = trim((string) $v);
        return $v === '' ? null : $v;
    }

    private static function position(Request $request): int
    {
        return max(1, (int) $request->input('position', 1));
    }

    private static function boolInt(Request $request, string $key, bool $default): int
    {
        if (!$request->has($key)) {
            return $default ? 1 : 0;
        }
        return in_array($request->input($key), [true, 1, '1', 'true', 'on', 'yes'], true) ? 1 : 0;
    }
}

<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Controller;
use App\Core\Response;
use App\Core\VideoStorage;
use App\Models\HomepageVideo;

/** Admin homepage-reel management — full CRUD + drag/drop reorder. */
class HomepageVideoController extends Controller
{
    public function index(): void
    {
        $this->requireAdmin();
        Response::ok(['data' => (new HomepageVideo())->all()]);
    }

    public function store(): void
    {
        $this->requireAdmin();
        $model = new HomepageVideo();
        $data = $this->resolveSource(null);
        $data['title']     = self::str($this->request->input('title'));
        $data['position']  = $this->position();
        $data['is_active'] = $this->boolInt('is_active', true);

        Response::ok(['video' => $model->insert($data)], 201);
    }

    public function update(array $p): void
    {
        $this->requireAdmin();
        $id = (int)$p['id'];
        $model = new HomepageVideo();
        $existing = $model->getById($id);
        if (!$existing) {
            Response::error('Video nahi mila', 404);
        }

        // Only touch a field when it was actually submitted, so partial updates
        // (e.g. the list's active-toggle, which sends no title) never wipe values.
        $d = $this->request->all();
        $data = $this->resolveSource($existing);
        if (array_key_exists('title', $d)) {
            $data['title'] = self::str($d['title']);
        }
        if (array_key_exists('position', $d) && trim((string)$d['position']) !== '') {
            $data['position'] = $this->position();
        }
        if (array_key_exists('is_active', $d)) {
            $data['is_active'] = $this->boolInt('is_active', (bool)$existing['is_active']);
        }

        Response::ok(['video' => $model->update($id, $data)]);
    }

    public function destroy(array $p): void
    {
        $this->requireAdmin();
        (new HomepageVideo())->remove((int)$p['id']);
        Response::ok(['deleted' => (int)$p['id']]);
    }

    /** POST /admin/homepage-videos/reorder  { order: [id, id, ...] } */
    public function reorder(): void
    {
        $this->requireAdmin();
        $order = $this->request->input('order', []);
        if (is_string($order)) {
            $decoded = json_decode($order, true);
            $order = is_array($decoded) ? $decoded : array_filter(array_map('trim', explode(',', $order)));
        }
        if (!is_array($order)) {
            Response::error('Order list chahiye', 422);
        }
        Response::ok(['data' => (new HomepageVideo())->reorder($order)]);
    }

    /**
     * Turn the submitted source (uploaded file OR Google Drive link) into stored
     * columns. Only ONE source is active per request. Drive links are re-hosted
     * (downloaded + optimised) so they play identically to uploads; if the
     * download fails we fall back to a direct Drive stream URL. On edit with no
     * new source the existing files are kept untouched.
     */
    private function resolveSource(?array $existing): array
    {
        $type = (string)$this->request->input('source_type', $existing['source_type'] ?? 'upload');

        // 1) A new file was uploaded → optimise + store (wins over any link).
        if ($this->request->hasFile('video')) {
            $stored = VideoStorage::saveUpload($this->request->file('video'));
            $this->deleteOldFiles($existing);
            return [
                'source_type' => 'upload',
                'video_file'  => $stored['video_file'],
                'poster_file' => $stored['poster_file'],
                'drive_url'   => null,
            ];
        }

        // 2) A Google Drive link was provided → re-host it (or fall back to direct).
        $driveUrl = trim((string)$this->request->input('drive_url', ''));
        if ($type === 'drive' && $driveUrl !== '') {
            // Unchanged link on edit → keep the already-stored (re-hosted) file.
            if ($existing && ($existing['drive_url'] ?? '') === $driveUrl && !empty($existing['video_file'])) {
                return ['source_type' => 'drive', 'drive_url' => $driveUrl];
            }
            if (VideoStorage::driveId($driveUrl) === null) {
                Response::error('Google Drive link theek nahi lagta', 422);
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
            Response::error('Video upload karein ya Google Drive link dein', 422);
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
        $v = trim((string)$v);
        return $v === '' ? null : $v;
    }

    private function position(): int
    {
        return max(1, (int)$this->request->input('position', 1));
    }

    private function boolInt(string $key, bool $default): int
    {
        $d = $this->request->all();
        if (!array_key_exists($key, $d)) {
            return $default ? 1 : 0;
        }
        return in_array($d[$key], [true, 1, '1', 'true', 'on', 'yes'], true) ? 1 : 0;
    }
}

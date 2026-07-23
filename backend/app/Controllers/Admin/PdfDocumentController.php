<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Controller;
use App\Core\PdfStorage;
use App\Core\Response;
use App\Models\PdfDocument;

class PdfDocumentController extends Controller
{
    public function index(): void
    {
        $this->requireAdmin();
        Response::ok(['data' => (new PdfDocument())->all()]);
    }

    public function show(array $p): void
    {
        $this->requireAdmin();
        $id = (int)$p['id'];
        $model = new PdfDocument();
        $doc = $model->getById($id);
        if (!$doc) {
            Response::error('Document not found', 404);
        }
        Response::ok(['document' => $doc]);
    }

    public function store(): void
    {
        $this->requireAdmin();
        $model = new PdfDocument();
        $data = $this->resolveFile(null);
        $data['title']     = self::str($this->request->input('title'));
        $data['position']  = $this->position();

        if (!$data['title']) {
            Response::error('Title required hai', 422);
        }
        if (!$data['file_path']) {
            Response::error('PDF file required hai', 422);
        }

        Response::ok(['document' => $model->insert($data)], 201);
    }

    public function update(array $p): void
    {
        $this->requireAdmin();
        $id = (int)$p['id'];
        $model = new PdfDocument();
        $existing = $model->getById($id);
        if (!$existing) {
            Response::error('Document not found', 404);
        }

        $d = $this->request->all();
        $data = $this->resolveFile($existing);
        if (array_key_exists('title', $d)) {
            $data['title'] = self::str($d['title']);
        }
        if (array_key_exists('position', $d) && trim((string)$d['position']) !== '') {
            $data['position'] = $this->position();
        }

        Response::ok(['document' => $model->update($id, $data)]);
    }

    public function destroy(array $p): void
    {
        $this->requireAdmin();
        (new PdfDocument())->remove((int)$p['id']);
        Response::ok(['deleted' => (int)$p['id']]);
    }

    private function resolveFile(?array $existing): array
    {
        if ($this->request->hasFile('file')) {
            $stored = PdfStorage::saveUpload($this->request->file('file'));
            $this->deleteOldFile($existing);
            return ['file_path' => $stored];
        }
        if (!$existing) {
            return [];
        }
        return [];
    }

    private function deleteOldFile(?array $existing): void
    {
        if (!$existing) {
            return;
        }
        PdfStorage::delete($existing['file_path'] ?? null);
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
}

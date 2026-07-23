<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Repositories\PdfDocumentRepo;
use App\Support\Api;
use App\Support\PdfStorage;
use Illuminate\Http\Request;

/** Admin PDF Catalog management — full CRUD. */
class PdfDocumentController extends Controller
{
    public function index()
    {
        return Api::ok(['data' => (new PdfDocumentRepo())->all()]);
    }

    public function show(string $id)
    {
        $id = (int)$id;
        $repo = new PdfDocumentRepo();
        $doc = $repo->getById($id);
        if (!$doc) {
            Api::halt('Document not found', 404);
        }
        return Api::ok(['document' => $doc]);
    }

    public function store(Request $request)
    {
        $repo = new PdfDocumentRepo();
        $data = $this->resolveFile($request, null);
        $data['title']     = self::str($request->input('title'));
        $data['position']  = self::position($request);

        if (!$data['title']) {
            Api::halt('Title required hai', 422);
        }
        if (!$data['file_path']) {
            Api::halt('PDF file required hai', 422);
        }

        return Api::ok(['document' => $repo->insert($data)], 201);
    }

    public function update(Request $request, string $id)
    {
        $id = (int) $id;
        $repo = new PdfDocumentRepo();
        $existing = $repo->getById($id);
        if (!$existing) {
            Api::halt('Document nahi mila', 404);
        }

        $data = $this->resolveFile($request, $existing);
        if ($request->has('title')) {
            $data['title'] = self::str($request->input('title'));
        }
        if ($request->filled('position')) {
            $data['position'] = self::position($request);
        }

        return Api::ok(['document' => $repo->update($id, $data)]);
    }

    public function destroy(Request $request, string $id)
    {
        (new PdfDocumentRepo())->remove((int) $id);
        return Api::ok(['deleted' => (int) $id]);
    }

    private function resolveFile(Request $request, ?array $existing): array
    {
        if ($request->hasFile('file')) {
            $stored = PdfStorage::saveUpload($request->file('file'));
            $this->deleteOldFile($existing);
            return [
                'file_path'  => $stored,
            ];
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
        $v = trim((string) $v);
        return $v === '' ? null : $v;
    }

    private static function position(Request $request): int
    {
        return max(1, (int) $request->input('position', 1));
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Repositories\BlogRepo;
use App\Support\Api;
use App\Support\Uploads;
use Illuminate\Http\Request;

/** Admin blog management — full CRUD. */
class BlogController extends Controller
{
    public function index()
    {
        return Api::ok(['data' => (new BlogRepo())->list()]);
    }

    public function show(Request $request, string $id)
    {
        $blog = (new BlogRepo())->getById((int) $id);
        if (!$blog) {
            Api::halt('Blog nahi mila', 404);
        }
        return Api::ok(['blog' => $blog]);
    }

    public function store(Request $request)
    {
        $d = $request->all();
        if (mb_strlen(trim((string) ($d['title'] ?? ''))) < 2) {
            Api::halt('Blog ka title likhein', 422);
        }

        $data = $this->payload($d);
        if ($request->hasFile('image')) {
            $data['image'] = Uploads::save($request->file('image'), '', true);
        }

        return Api::ok(['blog' => (new BlogRepo())->insert($data)], 201);
    }

    public function update(Request $request, string $id)
    {
        $id = (int) $id;
        $model = new BlogRepo();
        $existing = $model->getById($id);
        if (!$existing) {
            Api::halt('Blog nahi mila', 404);
        }

        $d = $request->all();
        if (mb_strlen(trim((string) ($d['title'] ?? ''))) < 2) {
            Api::halt('Blog ka title likhein', 422);
        }

        $data = $this->payload($d);
        if ($request->hasFile('image')) {
            $data['image'] = Uploads::save($request->file('image'), '', true);
            if (!empty($existing['image'])) {
                Uploads::delete($existing['image']);
            }
        }

        return Api::ok(['blog' => $model->update($id, $data)]);
    }

    public function destroy(Request $request, string $id)
    {
        (new BlogRepo())->remove((int) $id);
        return Api::ok(['deleted' => (int) $id]);
    }

    private function payload(array $d): array
    {
        $data = [
            'title'   => (string) ($d['title'] ?? ''),
            'excerpt' => (string) ($d['excerpt'] ?? ''),
            'content' => (string) ($d['content'] ?? ''),
            'author'  => trim((string) ($d['author'] ?? '')) !== '' ? (string) $d['author'] : 'England',
            'status'  => (string) ($d['status'] ?? 'published'),
        ];
        if (array_key_exists('slug', $d)) {
            $data['slug'] = (string) $d['slug'];
        }
        return $data;
    }
}

<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Controller;
use App\Core\Response;
use App\Core\Uploads;
use App\Models\Blog;

/** Admin blog management — full CRUD, persisted to the database. */
class BlogController extends Controller
{
    public function index(): void
    {
        $this->requireAdmin();
        Response::ok(['data' => (new Blog())->list()]);
    }

    public function show(array $p): void
    {
        $this->requireAdmin();
        $blog = (new Blog())->getById((int)$p['id']);
        if (!$blog) {
            Response::error('Blog nahi mila', 404);
        }
        Response::ok(['blog' => $blog]);
    }

    public function store(): void
    {
        $this->requireAdmin();
        $d = $this->request->all();
        if (mb_strlen(trim((string)($d['title'] ?? ''))) < 2) {
            Response::error('Blog ka title likhein', 422);
        }

        $data = $this->payload($d);
        if ($this->request->hasFile('image')) {
            $data['image'] = Uploads::save($this->request->file('image'), '', true);
        }

        Response::ok(['blog' => (new Blog())->insert($data)], 201);
    }

    public function update(array $p): void
    {
        $this->requireAdmin();
        $id = (int)$p['id'];
        $model = new Blog();
        $existing = $model->getById($id);
        if (!$existing) {
            Response::error('Blog nahi mila', 404);
        }

        $d = $this->request->all();
        if (mb_strlen(trim((string)($d['title'] ?? ''))) < 2) {
            Response::error('Blog ka title likhein', 422);
        }

        $data = $this->payload($d);
        if ($this->request->hasFile('image')) {
            $data['image'] = Uploads::save($this->request->file('image'), '', true);
            if (!empty($existing['image'])) {
                Uploads::delete($existing['image']);
            }
        }

        Response::ok(['blog' => $model->update($id, $data)]);
    }

    public function destroy(array $p): void
    {
        $this->requireAdmin();
        (new Blog())->remove((int)$p['id']);
        Response::ok(['deleted' => (int)$p['id']]);
    }

    /** Build the writable column set from request input (image handled separately). */
    private function payload(array $d): array
    {
        $data = [
            'title'   => (string)($d['title'] ?? ''),
            'excerpt' => (string)($d['excerpt'] ?? ''),
            'content' => (string)($d['content'] ?? ''),
            'author'  => trim((string)($d['author'] ?? '')) !== '' ? (string)$d['author'] : 'England',
            'status'  => (string)($d['status'] ?? 'published'),
        ];
        if (array_key_exists('slug', $d)) {
            $data['slug'] = (string)$d['slug'];
        }
        return $data;
    }
}

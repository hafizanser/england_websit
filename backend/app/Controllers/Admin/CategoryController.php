<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Controller;
use App\Core\Response;
use App\Core\Uploads;
use App\Models\RefCategory;

/** Admin category management against the shared order_system catalogue. */
class CategoryController extends Controller
{
    public function index(): void
    {
        $this->requireAdmin();
        Response::ok(['data' => (new RefCategory())->all()]);
    }

    public function store(): void
    {
        $this->requireAdmin();
        $d = $this->request->all();
        $name = trim((string)($d['name'] ?? ''));
        if (mb_strlen($name) < 2) {
            Response::error('Category ka naam likhein', 422);
        }

        $model = new RefCategory();
        if ($model->nameExists($name)) {
            Response::error('Yeh category pehle se mojood hai', 422);
        }

        $data = [
            'name'          => $name,
            'slug'          => RefCategory::slugify($name),
            'display_order' => (int)($d['display_order'] ?? 0),
            'is_active'     => $this->boolInt($d, 'is_active', true),
        ];
        if ($this->request->hasFile('image')) {
            $data['image_path'] = Uploads::save($this->request->file('image'), '', true);
        }

        Response::ok(['category' => $model->insert($data)], 201);
    }

    public function update(array $p): void
    {
        $this->requireAdmin();
        $id = (int)$p['id'];
        $model = new RefCategory();
        $existing = $model->getById($id);
        if (!$existing) {
            Response::error('Category nahi mili', 404);
        }

        $d = $this->request->all();
        $name = trim((string)($d['name'] ?? ''));
        if (mb_strlen($name) < 2) {
            Response::error('Category ka naam likhein', 422);
        }
        if ($model->nameExists($name, $id)) {
            Response::error('Yeh category pehle se mojood hai', 422);
        }

        $data = [
            'name'          => $name,
            'slug'          => RefCategory::slugify($name),
            'display_order' => (int)($d['display_order'] ?? 0),
            'is_active'     => $this->boolInt($d, 'is_active', true),
        ];
        if ($this->request->hasFile('image')) {
            $data['image_path'] = Uploads::save($this->request->file('image'), '', true);
            if (!empty($existing['image_path'])) {
                Uploads::delete($existing['image_path']);
            }
        }

        Response::ok(['category' => $model->update($id, $data)]);
    }

    public function destroy(array $p): void
    {
        $this->requireAdmin();
        (new RefCategory())->delete((int)$p['id']);
        Response::ok(['deleted' => (int)$p['id']]);
    }

    private function boolInt(array $d, string $k, bool $default): int
    {
        if (!array_key_exists($k, $d)) {
            return $default ? 1 : 0;
        }
        return in_array($d[$k], [true, 1, '1', 'true', 'on', 'yes'], true) ? 1 : 0;
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Repositories\CategoryRepo;
use App\Support\Api;
use App\Support\Uploads;
use Illuminate\Http\Request;

/** Admin category management against the shared order_system catalogue. */
class CategoryController extends Controller
{
    public function index()
    {
        return Api::ok(['data' => (new CategoryRepo())->all()]);
    }

    public function store(Request $request)
    {
        $d = $request->all();
        $name = trim((string) ($d['name'] ?? ''));
        if (mb_strlen($name) < 2) {
            Api::halt('Category ka naam likhein', 422);
        }

        $model = new CategoryRepo();
        if ($model->nameExists($name)) {
            Api::halt('Yeh category pehle se mojood hai', 422);
        }

        $data = [
            'name'          => $name,
            'slug'          => CategoryRepo::slugify($name),
            'display_order' => (int) ($d['display_order'] ?? 0),
            'is_active'     => $this->boolInt($d, 'is_active', true),
        ];
        if ($request->hasFile('image')) {
            $data['image_path'] = Uploads::save($request->file('image'), '', true);
        }

        return Api::ok(['category' => $model->insert($data)], 201);
    }

    public function update(Request $request, string $id)
    {
        $id = (int) $id;
        $model = new CategoryRepo();
        $existing = $model->getById($id);
        if (!$existing) {
            Api::halt('Category nahi mili', 404);
        }

        $d = $request->all();
        $name = trim((string) ($d['name'] ?? ''));
        if (mb_strlen($name) < 2) {
            Api::halt('Category ka naam likhein', 422);
        }
        if ($model->nameExists($name, $id)) {
            Api::halt('Yeh category pehle se mojood hai', 422);
        }

        $data = [
            'name'          => $name,
            'slug'          => CategoryRepo::slugify($name),
            'display_order' => (int) ($d['display_order'] ?? 0),
            'is_active'     => $this->boolInt($d, 'is_active', true),
        ];
        if ($request->hasFile('image')) {
            $data['image_path'] = Uploads::save($request->file('image'), '', true);
            if (!empty($existing['image_path'])) {
                Uploads::delete($existing['image_path']);
            }
        }

        return Api::ok(['category' => $model->update($id, $data)]);
    }

    public function destroy(Request $request, string $id)
    {
        (new CategoryRepo())->delete((int) $id);
        return Api::ok(['deleted' => (int) $id]);
    }

    private function boolInt(array $d, string $k, bool $default): int
    {
        if (!array_key_exists($k, $d)) {
            return $default ? 1 : 0;
        }
        return in_array($d[$k], [true, 1, '1', 'true', 'on', 'yes'], true) ? 1 : 0;
    }
}

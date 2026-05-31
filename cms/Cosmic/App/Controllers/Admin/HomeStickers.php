<?php
namespace App\Controllers\Admin;

use App\Models\Log;
use App\Models\Profiles;

use Core\View;

class HomeStickers
{
    public function view()
    {
        View::renderTemplate('Admin/Management/homestickers.html', [
            'permission' => 'housekeeping_home_stickers',
            'categorys'  => Profiles::getAllCategorys(),
            'items'      => Profiles::getAllItems(),
        ]);
    }

    // ── Category CRUD ────────────────────────────────────────────────────────

    public function createcategory()
    {
        $name = input()->post('name')->value;
        $type = input()->post('type')->value ?? 's';

        if(empty($name)) {
            response()->json(["status" => "error", "message" => "Name is required."]);
            return;
        }

        Profiles::createCategory($type, $name);
        Log::addStaffLog('-1', 'Created sticker category: ' . $name, request()->player->id, 'homestickers');
        response()->json(["status" => "success", "message" => "Category created."]);
    }

    public function updatecategory()
    {
        $id   = (int) input()->post('id')->value;
        $name = input()->post('name')->value;

        if(!$id || empty($name)) {
            response()->json(["status" => "error", "message" => "Invalid input."]);
            return;
        }

        Profiles::updateCategory($id, $name);
        Log::addStaffLog('-1', 'Updated sticker category #' . $id, request()->player->id, 'homestickers');
        response()->json(["status" => "success", "message" => "Category updated."]);
    }

    public function deletecategory()
    {
        $id = (int) input()->post('id')->value;

        if(!$id) {
            response()->json(["status" => "error", "message" => "Invalid ID."]);
            return;
        }

        Profiles::deleteCategory($id);
        Log::addStaffLog('-1', 'Deleted sticker category #' . $id, request()->player->id, 'homestickers');
        response()->json(["status" => "success", "message" => "Category deleted."]);
    }

    public function getcategorys()
    {
        $categorys = Profiles::getAllCategorys();
        response()->json(["categorys" => $categorys]);
    }

    // ── Item CRUD ────────────────────────────────────────────────────────────

    public function createitem()
    {
        $data     = input()->post('data')->value;
        $name     = input()->post('name')->value;
        $category = (int) input()->post('category')->value;
        $price    = (int) input()->post('price')->value;
        $type     = input()->post('type')->value ?? 's';

        if(empty($data) || empty($name) || $category < 1) {
            response()->json(["status" => "error", "message" => "All fields are required."]);
            return;
        }

        Profiles::createItem($type, $data, $name, $category, $price);
        Log::addStaffLog('-1', 'Created sticker item: ' . $name, request()->player->id, 'homestickers');
        response()->json(["status" => "success", "message" => "Sticker created."]);
    }

    public function updateitem()
    {
        $id       = (int) input()->post('id')->value;
        $data     = input()->post('data')->value;
        $name     = input()->post('name')->value;
        $category = (int) input()->post('category')->value;
        $price    = (int) input()->post('price')->value;

        if(!$id || empty($data) || empty($name) || $category < 1) {
            response()->json(["status" => "error", "message" => "Invalid input."]);
            return;
        }

        Profiles::updateItem($id, $data, $name, $category, $price);
        Log::addStaffLog('-1', 'Updated sticker item #' . $id, request()->player->id, 'homestickers');
        response()->json(["status" => "success", "message" => "Sticker updated."]);
    }

    public function deleteitem()
    {
        $id = (int) input()->post('id')->value;

        if(!$id) {
            response()->json(["status" => "error", "message" => "Invalid ID."]);
            return;
        }

        Profiles::deleteItem($id);
        Log::addStaffLog('-1', 'Deleted sticker item #' . $id, request()->player->id, 'homestickers');
        response()->json(["status" => "success", "message" => "Sticker deleted."]);
    }

    public function getitems()
    {
        $items = Profiles::getAllItems();
        response()->json(["items" => $items]);
    }
}

<?php
namespace App\Controllers\Admin;

use App\Config;
use App\Models\Admin;

use Core\View;

use Library\Json;
use Library\HotelApi;

class FurniCreator
{
    private $data;

    public function __construct()
    {
        $this->data = new \stdClass();
    }

    /**
     * Render the Furniture Creator housekeeping page.
     */
    public function view()
    {
        View::renderTemplate('Admin/Management/furnicreator.html', [
            'permission' => 'housekeeping_furni_creator',
        ]);
    }

    /**
     * Create a new furnis_custom record and store uploaded images.
     * Status is set to 'processing'; the furni-generator service picks it up.
     */
    public function create()
    {
        $validate = request()->validator->validate([
            'public_name'             => 'required|max:100',
            'width'                   => 'required|numeric',
            'length'                  => 'required|numeric',
            'stack_height'            => 'required',
            'page_id'                 => 'required|numeric',
            'allow_stack'             => 'required|in:0,1',
            'allow_sit'               => 'required|in:0,1',
            'allow_lay'               => 'required|in:0,1',
            'allow_walk'              => 'required|in:0,1',
            'allow_gift'              => 'required|in:0,1',
            'allow_trade'             => 'required|in:0,1',
            'allow_recycle'           => 'required|in:0,1',
            'allow_marketplace_sell'  => 'required|in:0,1',
            'allow_inventory_stack'   => 'required|in:0,1',
            'type'                    => 'required',
            'interaction_type'        => 'required',
            'interaction_modes_count' => 'required|numeric',
            'catalog_name'            => 'required',
            'cost_credits'            => 'required|numeric',
            'cost_points'             => 'required|numeric',
            'points_type'             => 'required|numeric',
            'amount'                  => 'required|numeric',
            'limited_sells'           => 'required|numeric',
            'limited_stack'           => 'required|numeric',
        ]);

        if (!$validate->isSuccess()) {
            echo json_encode(['status' => 'error', 'message' => 'Fill in all required fields.']);
            exit;
        }

        $furniData = [
            'public_name'             => input()->post('public_name')->value,
            'type'                    => input()->post('type')->value,
            'width'                   => (int) input()->post('width')->value,
            'length'                  => (int) input()->post('length')->value,
            'stack_height'            => (float) input()->post('stack_height')->value,
            'allow_stack'             => (int) input()->post('allow_stack')->value,
            'allow_sit'               => (int) input()->post('allow_sit')->value,
            'allow_lay'               => (int) input()->post('allow_lay')->value,
            'allow_walk'              => (int) input()->post('allow_walk')->value,
            'allow_gift'              => (int) input()->post('allow_gift')->value,
            'allow_trade'             => (int) input()->post('allow_trade')->value,
            'allow_recycle'           => (int) input()->post('allow_recycle')->value,
            'allow_marketplace_sell'  => (int) input()->post('allow_marketplace_sell')->value,
            'allow_inventory_stack'   => (int) input()->post('allow_inventory_stack')->value,
            'interaction_type'        => input()->post('interaction_type')->value,
            'interaction_modes_count' => (int) input()->post('interaction_modes_count')->value,
            'page_id'                 => (int) input()->post('page_id')->value,
            'catalog_name'            => input()->post('catalog_name')->value,
            'cost_credits'            => (int) input()->post('cost_credits')->value,
            'cost_points'             => (int) input()->post('cost_points')->value,
            'points_type'             => (int) input()->post('points_type')->value,
            'amount'                  => (int) input()->post('amount')->value,
            'limited_sells'           => (int) input()->post('limited_sells')->value,
            'limited_stack'           => (int) input()->post('limited_stack')->value,
            'status'                  => 'processing',
        ];

        $furniId = Admin::createCustomFurni($furniData);

        if (!$furniId) {
            echo json_encode(['status' => 'error', 'message' => 'Failed to create furni record.']);
            exit;
        }

        // Handle image uploads
        $uploadDir = __DIR__ . '/../../../public/uploads/furni_creator/' . $furniId . '/';
        if (!is_dir($uploadDir)) {
            if (!mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
                echo json_encode(['status' => 'error', 'message' => 'Failed to create upload directory.']);
                exit;
            }
        }

        $imagesMeta = [];
        $allowedTypes = ['image/png', 'image/gif'];
        $allowedExts  = ['png', 'gif'];
        if (!empty($_FILES)) {
            foreach ($_FILES as $fieldName => $fileData) {
                // Accept both rotation slots (rotation_N) and interaction-state slots (state_N)
                if (strpos($fieldName, 'rotation_') !== 0 && strpos($fieldName, 'state_') !== 0) {
                    continue;
                }
                if (empty($fileData['tmp_name']) || $fileData['error'] !== UPLOAD_ERR_OK) {
                    continue;
                }

                // Validate MIME type via content inspection
                $mime = mime_content_type($fileData['tmp_name']);
                if (!in_array($mime, $allowedTypes, true)) {
                    continue;
                }

                // Confirm the file is a genuine image
                if (getimagesize($fileData['tmp_name']) === false) {
                    continue;
                }

                // Validate the original extension too
                $origExt = strtolower(pathinfo($fileData['name'], PATHINFO_EXTENSION));
                if (!in_array($origExt, $allowedExts, true)) {
                    continue;
                }

                $ext = ($mime === 'image/gif') ? 'gif' : 'png';
                $destFilename = $fieldName . '.' . $ext;
                $destPath = $uploadDir . $destFilename;
                if (move_uploaded_file($fileData['tmp_name'], $destPath)) {
                    $imagesMeta[$fieldName] = $destFilename;
                }
            }
        }

        Admin::updateCustomFurniImages($furniId, json_encode($imagesMeta));

        echo json_encode([
            'status'  => 'success',
            'message' => 'Furni creation job submitted.',
            'id'      => $furniId,
        ]);
        exit;
    }

    /**
     * Return all furnis_custom items as JSON.
     */
    public function getItems()
    {
        $items = Admin::getCustomFurnis();
        echo Json::raw($items);
    }

    /**
     * Return a single furnis_custom item by POST id.
     */
    public function getItemById()
    {
        $id = (int) input()->post('id')->value;
        $item = Admin::getCustomFurniById($id);
        if (!$item) {
            echo json_encode(['status' => 'error', 'message' => 'Item not found.']);
            exit;
        }
        echo Json::raw($item);
    }

    /**
     * Return the processing status of a furnis_custom item (for polling).
     */
    public function getStatus()
    {
        $id = (int) input()->post('id')->value;
        $item = Admin::getCustomFurniById($id);
        if (!$item) {
            echo json_encode(['status' => 'error', 'message' => 'Item not found.']);
            exit;
        }
        echo json_encode([
            'id'         => $item->id,
            'status'     => $item->status,
            'item_name'  => $item->item_name,
            'sprite_id'  => $item->sprite_id,
            'nitro_file' => $item->nitro_file,
        ]);
        exit;
    }

    /**
     * Move the generated Nitro asset to the live assets directory and
     * create the corresponding rows in items_base and catalog_items.
     * Sets status to 'done' and disables the button on the UI side.
     */
    public function addToGame()
    {
        $id = (int) input()->post('id')->value;
        $item = Admin::getCustomFurniById($id);

        if (!$item) {
            echo json_encode(['status' => 'error', 'message' => 'Item not found.']);
            exit;
        }
        if ($item->status !== 'pending') {
            echo json_encode(['status' => 'error', 'message' => 'Item is not in pending state.']);
            exit;
        }

        // Insert into items_base
        $itemsBaseData = [
            'sprite_id'               => (int) $item->sprite_id,
            'item_name'               => $item->item_name,
            'public_name'             => $item->public_name,
            'type'                    => $item->type,
            'width'                   => (int) $item->width,
            'length'                  => (int) $item->length,
            'stack_height'            => (float) $item->stack_height,
            'allow_stack'             => (int) $item->allow_stack,
            'allow_sit'               => (int) $item->allow_sit,
            'allow_lay'               => (int) $item->allow_lay,
            'allow_walk'              => (int) $item->allow_walk,
            'allow_gift'              => (int) $item->allow_gift,
            'allow_trade'             => (int) $item->allow_trade,
            'allow_recycle'           => (int) $item->allow_recycle,
            'allow_marketplace_sell'  => (int) $item->allow_marketplace_sell,
            'allow_inventory_stack'   => (int) $item->allow_inventory_stack,
            'interaction_type'        => $item->interaction_type,
            'interaction_modes_count' => (int) $item->interaction_modes_count,
            'vending_ids'             => '0',
            'multiheight'             => '0',
            'customparams'            => '',
            'effect_id_male'          => 0,
            'effect_id_female'        => 0,
            'clothing_on_walk'        => '',
        ];

        $result = Admin::addCustomFurniToGame($item, $itemsBaseData);

        if (!$result) {
            echo json_encode(['status' => 'error', 'message' => 'Failed to add furni to game.']);
            exit;
        }

        Admin::updateCustomFurniStatus($id, 'done');

        if (Config::apiEnabled) {
            HotelApi::execute('updatecatalog');
            HotelApi::execute('updateitems');
        }

        echo json_encode(['status' => 'success', 'message' => 'Furni added to game successfully.']);
        exit;
    }

    /**
     * Delete a furnis_custom item (only allowed if status != 'done').
     */
    public function deleteItem()
    {
        $id = (int) input()->post('id')->value;
        $item = Admin::getCustomFurniById($id);

        if (!$item) {
            echo json_encode(['status' => 'error', 'message' => 'Item not found.']);
            exit;
        }
        if ($item->status === 'done') {
            echo json_encode(['status' => 'error', 'message' => 'Cannot delete an item already added to the game.']);
            exit;
        }

        Admin::deleteCustomFurni($id);
        echo json_encode(['status' => 'success', 'message' => 'Item deleted.']);
        exit;
    }
}

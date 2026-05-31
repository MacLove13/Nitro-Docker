<?php
namespace App\Controllers\Admin;

use App\Config;
use App\Models\Admin;

use Core\View;

use Library\Json;
use Library\HotelApi;

use QueryBuilder;

class Crackable
{
    private $data;

    public function __construct()
    {
        $this->data = new \stdClass();
    }

    public function view()
    {
        View::renderTemplate('Admin/Management/crackable.html', ['permission' => 'housekeeping_crackable']);
    }

    public function getList()
    {
        $items = Admin::getCrackableItems();

        if ($items === null) {
            echo json_encode([]);
            exit;
        }

        $result = [];
        foreach ($items as $item) {
            $result[] = [
                'item_id'     => $item->item_id,
                'item_name'   => $item->item_name,
                'public_name' => $item->public_name,
                'sprite_id'   => $item->sprite_id,
                'count'       => $item->count,
            ];
        }

        echo json_encode($result);
        exit;
    }

    public function getDetail()
    {
        $item_id = (int) (input()->post('item_id')->value ?? 0);

        if ($item_id <= 0) {
            echo json_encode(['status' => 'error', 'message' => 'Invalid item ID.']);
            exit;
        }

        $crackable = Admin::getCrackableById($item_id);

        if (!$crackable) {
            echo json_encode(['status' => 'error', 'message' => 'Crackable not found.']);
            exit;
        }

        $entries = array_filter(explode(';', $crackable->prizes));
        $totalWeight = 0;
        $parsed = [];

        foreach ($entries as $entry) {
            $parts = explode(':', $entry);
            if (count($parts) !== 2) continue;
            $prizeItemId = (int) $parts[0];
            $weight      = (int) $parts[1];
            if ($prizeItemId <= 0) continue;
            $totalWeight += $weight;
            $parsed[] = ['item_id' => $prizeItemId, 'weight' => $weight];
        }

        $prizes = [];
        foreach ($parsed as $p) {
            $furni = Admin::getFurnitureById($p['item_id']);
            $prizes[] = [
                'item_id'     => $p['item_id'],
                'item_name'   => $furni ? $furni->item_name : ('item_' . $p['item_id']),
                'public_name' => $furni ? ($furni->public_name ?? '') : '',
                'weight'      => $p['weight'],
                'percentage'  => $totalWeight > 0 ? round(($p['weight'] / $totalWeight) * 100, 2) : 0,
            ];
        }

        usort($prizes, fn($a, $b) => $b['percentage'] <=> $a['percentage']);

        echo json_encode([
            'status'      => 'success',
            'item_id'     => $crackable->item_id,
            'item_name'   => $crackable->item_name,
            'public_name' => $crackable->public_name,
            'sprite_id'   => $crackable->sprite_id,
            'count'       => $crackable->count,
            'prizes'      => $prizes,
        ]);
        exit;
    }

    public function savePrizes()
    {
        $item_id = (int) (input()->post('item_id')->value ?? 0);
        $prizes_raw = input()->post('prizes')->value ?? '';

        if ($item_id <= 0) {
            echo json_encode(['status' => 'error', 'message' => 'Invalid item ID.']);
            exit;
        }

        $crackable = Admin::getCrackableById($item_id);

        if (!$crackable) {
            echo json_encode(['status' => 'error', 'message' => 'Crackable not found.']);
            exit;
        }

        // Validate and sanitize the prizes string (format: item_id:weight;item_id:weight)
        $entries = array_filter(explode(';', trim($prizes_raw)));
        $valid = [];

        foreach ($entries as $entry) {
            $parts = explode(':', trim($entry));
            if (count($parts) !== 2) continue;
            $prizeItemId = (int) $parts[0];
            $weight      = (int) $parts[1];
            if ($prizeItemId <= 0 || $weight <= 0) continue;
            $valid[] = $prizeItemId . ':' . $weight;
        }

        $prizes_string = implode(';', $valid);

        Admin::updateCrackablePrizes($item_id, $prizes_string);

        if (Config::apiEnabled) {
            HotelApi::execute('updatecatalog');
        }

        echo json_encode(['status' => 'success', 'message' => 'Prêmios atualizados com sucesso!']);
        exit;
    }

    public function getFurniByName()
    {
        $query = input()->post('query')->value ?? '';

        if (empty($query)) {
            echo json_encode([]);
            exit;
        }

        $items = Admin::getItems($query, 20);
        $result = [];

        foreach ($items as $item) {
            $result[] = [
                'id'          => $item->id,
                'item_name'   => $item->item_name,
                'public_name' => $item->public_name,
                'sprite_id'   => $item->sprite_id,
            ];
        }

        echo json_encode($result);
        exit;
    }
}

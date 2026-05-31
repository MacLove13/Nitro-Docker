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

        $parsed      = $this->parsePrizes($crackable->prizes);
        $totalWeight = array_sum(array_column($parsed, 'weight'));

        $prizes = [];
        foreach ($parsed as $p) {
            $furni    = Admin::getFurnitureById($p['item_id']);
            $prizes[] = [
                'item_id'     => $p['item_id'],
                'item_name'   => $furni ? $furni->item_name : ('item_' . $p['item_id']),
                'public_name' => $furni ? ($furni->public_name ?? '') : '',
                'weight'      => $p['weight'],
                'percentage'  => $totalWeight > 0 ? round(($p['weight'] / $totalWeight) * 100, 2) : 0,
            ];
        }

        // Sort by percentage descending for the initial detail view display.
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
        $item_id    = (int) (input()->post('item_id')->value ?? 0);
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

        $parsed        = $this->parsePrizes($prizes_raw);
        $valid_entries = [];

        foreach ($parsed as $p) {
            $valid_entries[] = $p['item_id'] . ':' . $p['weight'];
        }

        $prizes_string = implode(';', $valid_entries);

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

        $items  = Admin::getItems($query, 20);
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

    /**
     * Parses a prizes string in the format "item_id:weight;item_id:weight"
     * and returns an array of ['item_id' => int, 'weight' => int] entries.
     */
    private function parsePrizes(string $prizes_raw): array
    {
        $entries = array_filter(explode(';', trim($prizes_raw)));
        $parsed  = [];

        foreach ($entries as $entry) {
            $parts = explode(':', trim($entry));
            if (count($parts) !== 2) continue;
            $prizeItemId = (int) $parts[0];
            $weight      = (int) $parts[1];
            if ($prizeItemId <= 0 || $weight <= 0) continue;
            $parsed[] = ['item_id' => $prizeItemId, 'weight' => $weight];
        }

        return $parsed;
    }
}

<?php
namespace App\Controllers\Home;

use App\Config;
use App\Helper;
use App\Models\Community;
use App\Models\Core;
use App\Models\Player;
use App\Models\Profiles;

use Core\Locale;
use Core\View;

use Library\Json;

use stdClass;

class Profile
{
    private $myWidgets = [];
  
    public function __construct()
    {
        $this->data = new stdClass();
    }

    public function profile($username = null)
    {
        if($username == null && isset(request()->player->username)) {
            $username = request()->player->username;
        }

        if($username == null) {
            redirect('/');
            exit;
        }

        $player = Player::getDataByUsername($username);
        if($player == null) {
            redirect('/');
            exit;
        }
      

        $this->data->player = $player;
        $this->data->player->last_online = $this->data->player->last_online;
        $this->data->player->settings = Player::getSettings($player->id);

        $this->data->player->badges = Player::getBadges($player->id);
        $this->data->player->friends = Player::getFriends($player->id);

        $this->data->player->groups = Player::getGroups($player->id);
        $this->data->player->rooms = Player::getRooms($player->id);
        $this->data->player->photos = Player::getPhotos($player->id);

        $this->data->player->badgeCount = count($this->data->player->badges);
        $this->data->player->friendCount = count($this->data->player->friends);
        $this->data->player->groupCount = count($this->data->player->groups);
        $this->data->player->roomCount = count($this->data->player->rooms);
        $this->data->player->photoCount = count($this->data->player->photos);

        $this->data->player->feeds = Community::getFeedsByUserid($player->id);
        $this->data->player->feedCount = count($this->data->player->feeds);
        $this->data->player->feedCountTotal = count($this->data->player->feeds);
      
        $this->data->player->widgets = Profiles::getWidgets($player->id);
        $this->data->player->background = Profiles::getBackground($player->id);
        $this->data->player->notes = Profiles::getNotes($player->id);
      
        foreach ($this->data->player->feeds as $row) {
            $row->likes = Community::getLikes($row->id);
        }

        $this->template();
    }

    public function feeds($offset = null, $user_id = null)
    {
        $feeds = Community::getFeedsByUserIdOffset($offset, $user_id, 6);

        foreach ($feeds as $row) {
            $from_user = Player::getDataById($row->from_user_id, array('username','look'));
            $row->from_username = $from_user->username;
            $row->figure = $from_user->look ?? null;
            $row->likes = Community::getLikes($row->id);
            $row->message = Helper::bbCode($row->message);
        }

        return $feeds;
    }

    public function search()
    {
        if(!Player::exists(input('search'))) {
            response()->json(["status" => "error", "message" => Locale::get('core/notification/profile_notfound')]);
        }

        response()->json(["replacepage" => "profile/" . input('search')]);
    }
  
    public function inventory()
    {
        if (!request()->player->id) {
            response()->json(["status" => "error", "message" => Locale::get('core/notification/something_wrong')]);
            return;
        }

        $player_id = request()->player->id;

        // Available widgets (all configured minus already placed)
        $allWidgets = explode(";", Core::settings()->available_profile_widgets);
        $availableWidgets = [];
        foreach ($allWidgets as $widget) {
            $widget = trim($widget);
            if ($widget !== '' && !Profiles::hasWidget($player_id, $widget)) {
                $availableWidgets[] = $widget;
            }
        }

        $stickerCategorys    = Profiles::getCategorysForType('s');
        $stickerInventory    = Profiles::getInventory($player_id);
        $bgCategorys         = Profiles::getCategorysForType('b');
        $bgInventory         = Profiles::getBackgroundInventory($player_id);

        response()->json([
            "status"            => "success",
            "widgets"           => $availableWidgets,
            "sticker_categorys" => $stickerCategorys,
            "sticker_inventory" => $stickerInventory,
            "bg_categorys"      => $bgCategorys,
            "bg_inventory"      => $bgInventory,
        ]);
    }

    public function shop()
    {
        if (!request()->player->id) {
            response()->json(["status" => "error", "message" => Locale::get('core/notification/something_wrong')]);
            return;
        }

        $player_id = request()->player->id;
        $player    = Player::getDataById($player_id, ['id', 'credits']);

        $stickerCategorys = Profiles::getCategorysForType('s');
        $stickerItems     = Profiles::getItems('s');
        $bgCategorys      = Profiles::getCategorysForType('b');
        $bgItems          = Profiles::getItems('b');

        // Mark backgrounds the player already owns
        $bgInventory = Profiles::getBackgroundInventory($player_id);
        $ownedBgIds  = array_map(function($b) { return (int) $b->id; }, $bgInventory);
        foreach ($bgItems as $item) {
            $item->owned = in_array((int) $item->id, $ownedBgIds);
        }

        response()->json([
            "status"           => "success",
            "credits"          => (int) $player->credits,
            "sticker_categorys"=> $stickerCategorys,
            "sticker_items"    => $stickerItems,
            "bg_categorys"     => $bgCategorys,
            "bg_items"         => $bgItems,
        ]);
    }

    public function store()
    {
        return $this->add();
    }

    public function add()
    {
        if(!request()->player->id) {
            response()->json(["status" => "error", "message" => Locale::get('core/notification/something_wrong')]);
            return;
        }
        
        if(input('data') == "w") {
            
            $widgets = explode(";", Core::settings()->available_profile_widgets);
 
            foreach($widgets as $widget) {
                if(!Profiles::hasWidget(request()->player->id, $widget)) {
                    $myWidgets[] = $widget;
                }
            }
          
            if(input()->post('type')->value == "p") {
                Profiles::insert(request()->player->id, input()->post('add')->value, '0', '0', 'default_skin', input('data'));
                response()->json(["status" => "success", "replacepage" => "/profile/" . request()->player->username ]);
                return;
            }
        }

        if(input('data') == "s") {
            $categorys = Profiles::getCategorys();
            $items = Profiles::getItems('s');
            $inventory = Profiles::getInventory(request()->player->id);
            $player = Player::getDataById(request()->player->id, ['id', 'credits']);

            response()->json([
                "items"     => $items,
                "categorys" => $categorys,
                "inventory" => $inventory,
                "credits"   => (int) $player->credits,
                "widgets"   => $myWidgets ?? null,
            ]);
            return;
        }

        $categorys = Profiles::getCategorys();
        $items = Profiles::getItems(input('data'));

        response()->json(["items" => $items, "categorys" => $categorys, "widgets" => $myWidgets ?? null]);
    }

    public function buy()
    {
        if(!request()->player->id) {
            response()->json(["status" => "error", "message" => Locale::get('core/notification/something_wrong')]);
            return;
        }

        $catalogue_id = (int) input()->post('catalogue_id')->value;
        if(!$catalogue_id) {
            response()->json(["status" => "error", "message" => "Item inválido."]);
            return;
        }

        $item = Profiles::getCatalogueItem($catalogue_id);
        if(!$item) {
            response()->json(["status" => "error", "message" => "Item não encontrado."]);
            return;
        }

        $player = Player::getDataById(request()->player->id, ['id', 'credits']);
        if($player->credits < $item->price) {
            response()->json(["status" => "error", "message" => "Créditos insuficientes."]);
            return;
        }

        $existing = Profiles::hasInInventory(request()->player->id, $catalogue_id);

        // Backgrounds: one-time purchase only
        if ($item->type === 'b') {
            if ($existing) {
                response()->json(["status" => "error", "message" => "Você já possui este background."]);
                return;
            }
            Player::update(request()->player->id, ['credits' => $player->credits - $item->price]);
            Profiles::addToInventory(request()->player->id, $catalogue_id);
        } else {
            // Stickers: stackable — increment quantity if already owned
            Player::update(request()->player->id, ['credits' => $player->credits - $item->price]);
            if ($existing) {
                Profiles::incrementInventoryQuantity(request()->player->id, $catalogue_id);
                $item->quantity = $existing->quantity + 1;
            } else {
                Profiles::addToInventory(request()->player->id, $catalogue_id);
                $item->quantity = 1;
            }
        }

        response()->json([
            "status"  => "success",
            "message" => "Compra realizada com sucesso!",
            "credits" => $player->credits - $item->price,
            "item"    => $item,
        ]);
    }
  
    public function useSticker()
    {
        if(!request()->player->id) {
            response()->json(["status" => "error", "message" => Locale::get('core/notification/something_wrong')]);
            return;
        }

        $catalogue_id = (int) input()->post('catalogue_id')->value;
        if(!$catalogue_id) {
            response()->json(["status" => "error", "message" => "Item inválido."]);
            return;
        }

        $inv = Profiles::hasInInventory(request()->player->id, $catalogue_id);
        if(!$inv || $inv->quantity < 1) {
            response()->json(["status" => "error", "message" => "Você não possui este sticker no inventário."]);
            return;
        }

        // Decrement quantity or remove from inventory if last one
        if($inv->quantity > 1) {
            Profiles::decrementInventoryQuantity(request()->player->id, $catalogue_id);
            $newQty = $inv->quantity - 1;
        } else {
            Profiles::removeFromInventory(request()->player->id, $catalogue_id);
            $newQty = 0;
        }

        response()->json(["status" => "success", "quantity" => $newQty]);
    }

    public function remove() 
    {
        if(!request()->player->id) {
            response()->json(["status" => "error", "message" => Locale::get('core/notification/something_wrong')]);
            return;
        }

        $item_id = input('id');
        $type    = input('type');

        // If it's a sticker, return it to inventory
        if($type === 's') {
            $home = Profiles::getHomeItem(request()->player->id, $item_id);
            if($home) {
                $catalogue = Profiles::getCatalogueItemByData($home->name);
                if($catalogue) {
                    $inv = Profiles::hasInInventory(request()->player->id, $catalogue->id);
                    if($inv) {
                        Profiles::incrementInventoryQuantity(request()->player->id, $catalogue->id);
                    } else {
                        Profiles::addToInventory(request()->player->id, $catalogue->id);
                    }
                }
            }
        }

        Profiles::remove(request()->player->id, $item_id, $type);
        response()->json(["status" => "success", "message" => "Widget deleted!"]); 
    }

    public function save()
    {
        if(!request()->player->id) {
            response()->json(["status" => "error", "message" => Locale::get('core/notification/something_wrong')]);
        }
      
        $items = json_decode(input()->post('draggable')->value);
        foreach($items as $i => $v){
            if(Profiles::hasWidget(request()->player->id, $v[0])) {
                Profiles::update(request()->player->id, $v[0], $v[1], $v[2], $v[3], $v[4]);
            } else {
                Profiles::insert(request()->player->id, $v[0], $v[1], $v[2], $v[3], $v[4]);
            }
        }
      
        if(Profiles::hasBackground(request()->player->id, input('background'))) {
            Profiles::saveBackground(request()->player->id, input('background'));
        } else {
            Profiles::insertBackground(request()->player->id, input('background'));
        }
      
        response()->json(["status" => "success", "message" => "Homepage successfully saved."]);
    }
  
    public function template()
    {
        View::renderTemplate('Home/profile.html', [
         'title' => $this->data->player->username,
         'page'  => 'profile',
         'data'  => $this->data,
        ]);
    }
}

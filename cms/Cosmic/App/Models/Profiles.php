<?php
namespace App\Models;

use PDO;
use QueryBuilder;

class Profiles
{
    public static function hasWidget($user_id, $name)
    {
        return QueryBuilder::table('website_profile_homes')->setFetchMode(PDO::FETCH_CLASS, get_called_class())->where('user_id', $user_id)->where('name', $name)->get();
    }
  
    public static function hasBackground($user_id)
    {
        return QueryBuilder::table('website_profile_homes')->setFetchMode(PDO::FETCH_CLASS, get_called_class())->where('user_id', $user_id)->where('type', 'b')->get();
    }

    public static function getWidgets($user_id)
    {
        return QueryBuilder::table('website_profile_homes')->setFetchMode(PDO::FETCH_CLASS, get_called_class())->where('user_id', $user_id)->whereIn('type', array('s','w'))->orderBy('z')->get();
    }

    public static function getItems($data)
    {
        return QueryBuilder::table('website_profile_catalogues')->setFetchMode(PDO::FETCH_CLASS, get_called_class())->where('type', $data)->get();
    }

    public static function getBackground($user_id)
    {
        return QueryBuilder::table('website_profile_homes')->setFetchMode(PDO::FETCH_CLASS, get_called_class())->where('type', 'b')->where('user_id', $user_id)->first();
    }

    public static function getNotes($user_id)
    {
        return QueryBuilder::table('website_profile_homes')->setFetchMode(PDO::FETCH_CLASS, get_called_class())->where('user_id', $user_id)->where('type', 'n')->get();
    }

    public static function getCategorys()
    {
        return QueryBuilder::table('website_profile_catalogues_cats')->setFetchMode(PDO::FETCH_CLASS, get_called_class())->where('type', 's')->get();
    }

    public static function getCategorysForType($type)
    {
        return QueryBuilder::table('website_profile_catalogues_cats')
            ->setFetchMode(PDO::FETCH_CLASS, get_called_class())
            ->where('type', $type)
            ->get();
    }

    public static function saveBackground($user_id, $name)
    {
        return QueryBuilder::table('website_profile_homes')->setFetchMode(PDO::FETCH_CLASS, get_called_class())->where('user_id', $user_id)->where('type', 'b')->update(array('name' => $name));;
    }
  
    public static function insertBackground($user_id, $name)
    {
        return QueryBuilder::table('website_profile_homes')->setFetchMode(PDO::FETCH_CLASS, get_called_class())->insert(array('user_id' => $user_id, 'name' => $name, 'type' => 'b'));   
    }
  
    public static function update($user_id, $name, $top, $left, $skin, $type)
    {
        $data = array(
            'name' => $name,
            'skin' => $skin,
            'x' => $left,
            'y' => $top,
            'type' => $type
        );
      
        return QueryBuilder::table('website_profile_homes')->setFetchMode(PDO::FETCH_CLASS, get_called_class())->where('user_id', $user_id)->where('name', $name)->update($data);
    }

    public static function insert($user_id, $name, $top, $left, $skin, $type)
    {
        $data = array(
            'user_id' => $user_id,
            'name' => $name,
            'skin' => $skin,
            'x' => $left,
            'y' => $top,
            'type' => $type
        );
      
        return QueryBuilder::table('website_profile_homes')->setFetchMode(PDO::FETCH_CLASS, get_called_class())->insert($data);
    }

    public static function remove($user_id, $item_id, $type)
    {
        return QueryBuilder::table('website_profile_homes')->where('id', $item_id)->where('user_id', $user_id)->where('type', $type)->delete();
    }

    // ── Sticker inventory (Web Store) ────────────────────────────────────────

    public static function getInventory($user_id)
    {
        return QueryBuilder::table('website_profile_inventories')
            ->join('website_profile_catalogues', 'website_profile_inventories.catalogue_id', '=', 'website_profile_catalogues.id')
            ->select([
                'website_profile_catalogues.id',
                'website_profile_catalogues.type',
                'website_profile_catalogues.data',
                'website_profile_catalogues.name',
                'website_profile_catalogues.category',
                'website_profile_catalogues.price',
                'website_profile_inventories.quantity',
            ])
            ->setFetchMode(PDO::FETCH_CLASS, get_called_class())
            ->where('website_profile_inventories.user_id', $user_id)
            ->where('website_profile_catalogues.type', 's')
            ->get();
    }

    public static function getBackgroundInventory($user_id)
    {
        return QueryBuilder::table('website_profile_inventories')
            ->join('website_profile_catalogues', 'website_profile_inventories.catalogue_id', '=', 'website_profile_catalogues.id')
            ->select([
                'website_profile_catalogues.id',
                'website_profile_catalogues.type',
                'website_profile_catalogues.data',
                'website_profile_catalogues.name',
                'website_profile_catalogues.category',
                'website_profile_catalogues.price',
                'website_profile_inventories.quantity',
            ])
            ->setFetchMode(PDO::FETCH_CLASS, get_called_class())
            ->where('website_profile_inventories.user_id', $user_id)
            ->where('website_profile_catalogues.type', 'b')
            ->get();
    }

    public static function decrementInventoryQuantity($user_id, $catalogue_id)
    {
        return QueryBuilder::table('website_profile_inventories')
            ->where('user_id', $user_id)
            ->where('catalogue_id', $catalogue_id)
            ->decrement('quantity', 1);
    }

    public static function removeFromInventory($user_id, $catalogue_id)
    {
        return QueryBuilder::table('website_profile_inventories')
            ->where('user_id', $user_id)
            ->where('catalogue_id', $catalogue_id)
            ->delete();
    }

    public static function getHomeItem($user_id, $item_id)
    {
        return QueryBuilder::table('website_profile_homes')
            ->setFetchMode(PDO::FETCH_CLASS, get_called_class())
            ->where('user_id', $user_id)
            ->where('id', $item_id)
            ->first();
    }

    public static function getCatalogueItemByData($data)
    {
        return QueryBuilder::table('website_profile_catalogues')
            ->setFetchMode(PDO::FETCH_CLASS, get_called_class())
            ->where('data', $data)
            ->first();
    }

    public static function incrementInventoryQuantity($user_id, $catalogue_id)
    {
        return QueryBuilder::table('website_profile_inventories')
            ->where('user_id', $user_id)
            ->where('catalogue_id', $catalogue_id)
            ->increment('quantity', 1);
    }

    public static function hasInInventory($user_id, $catalogue_id)
    {
        return QueryBuilder::table('website_profile_inventories')
            ->setFetchMode(PDO::FETCH_CLASS, get_called_class())
            ->where('user_id', $user_id)
            ->where('catalogue_id', $catalogue_id)
            ->first();
    }

    public static function addToInventory($user_id, $catalogue_id)
    {
        return QueryBuilder::table('website_profile_inventories')->insert([
            'user_id'      => $user_id,
            'catalogue_id' => $catalogue_id,
            'quantity'     => 1,
            'purchased_at' => time(),
        ]);
    }

    public static function getCatalogueItem($id)
    {
        return QueryBuilder::table('website_profile_catalogues')
            ->setFetchMode(PDO::FETCH_CLASS, get_called_class())
            ->where('id', $id)
            ->first();
    }

    // ── Admin catalogue management ───────────────────────────────────────────

    public static function getAllCategorys()
    {
        return QueryBuilder::table('website_profile_catalogues_cats')
            ->setFetchMode(PDO::FETCH_CLASS, get_called_class())
            ->get();
    }

    public static function createCategory($type, $name)
    {
        return QueryBuilder::table('website_profile_catalogues_cats')->insert([
            'type' => $type,
            'name' => $name,
        ]);
    }

    public static function updateCategory($id, $name)
    {
        return QueryBuilder::table('website_profile_catalogues_cats')
            ->where('id', $id)
            ->update(['name' => $name]);
    }

    public static function deleteCategory($id)
    {
        return QueryBuilder::table('website_profile_catalogues_cats')
            ->where('id', $id)
            ->delete();
    }

    public static function getAllItems()
    {
        return QueryBuilder::table('website_profile_catalogues')
            ->setFetchMode(PDO::FETCH_CLASS, get_called_class())
            ->get();
    }

    public static function createItem($type, $data, $name, $category, $price)
    {
        return QueryBuilder::table('website_profile_catalogues')->insert([
            'type'     => $type,
            'data'     => $data,
            'name'     => $name,
            'category' => $category,
            'price'    => (int) $price,
        ]);
    }

    public static function updateItem($id, $data, $name, $category, $price)
    {
        return QueryBuilder::table('website_profile_catalogues')
            ->where('id', $id)
            ->update([
                'data'     => $data,
                'name'     => $name,
                'category' => $category,
                'price'    => (int) $price,
            ]);
    }

    public static function deleteItem($id)
    {
        return QueryBuilder::table('website_profile_catalogues')
            ->where('id', $id)
            ->delete();
    }
}


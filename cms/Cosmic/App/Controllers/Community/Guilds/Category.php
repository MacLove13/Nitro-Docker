<?php
namespace App\Controllers\Community\Guilds;

use App\Helper;
use App\Models\Guild;
use App\Models\Player;

use Core\Locale;
use Core\View;

use Library\Json;

class Category {
  
    public function __construct()
    {
        if(!request()->guild->read_forum) {
            if(request()->isAjax()) {
                response()->json(["status" => "error", "message" => Locale::get('core/notification/invisible')]);
            }
          
            redirect('/guilds');
        }
    }
  
    public function index($slug, $page = 1)
    {  
        $guild = request()->guild;
      
        $guild->slug = Helper::convertSlug($guild->name);

        if($page == 1) {
            $topics = Guild::getForumTopics(Helper::slug($slug), 10);
        } else {
            $offset = ($page - 1) * 10;
            $topics = Guild::getForumTopics(Helper::slug($slug), 10, $offset);
        }

        $totalPages   = ceil(count(Guild::getForumTopics(Helper::slug($slug))) / 10);

        foreach($topics as $topic) {
            $topic->author      = Player::getDataById($topic->opener_id, array('username', 'look'));
            $topic->latest_post = Guild::getLatestForumPost($topic->id);
            $topic->totalposts  = count(Guild::getPostsById($topic->id));
            $topic->slug        = Helper::convertSlug($topic->subject);

            if($topic->latest_post) {
                $topic->latest_post->author = Player::getDataById($topic->latest_post->user_id, array('username', 'look'));
            }
        }
      
        $guild->total = $totalPages;
        $guild->topic = $topics;

        View::renderTemplate('Community/Guilds/category.html', [
            'title'   => $guild->name,
            'page'    => 'forum',
            'forums'  => $guild,
            'currentpage' => $page
        ]);
    }
  
    public function create()
    {
        $validate = request()->validator->validate([
            'title'     => 'required|min:6|max:50',
            'message'   => 'required',
            'guild_id'  => 'required|numeric'
        ]);

        if(!$validate->isSuccess()) {
            exit;
        }
      
        if(!request()->player->id) {
            response()->json(["status" => "error", "message" => Locale::get('core/notification/something_wrong')]);
        }
      
        $slug     = Helper::convertSlug($title);
        $forums   = Guild::getGuild($cat_id);
      
        if (request()->player === null || empty($forums)) {
            response()->json(["status" => "error", "message" => Locale::get('core/notification/something_wrong')]);
        }
      
        if(!request()->guild->post_threads != false) {
            response()->json(["status" => "error", "message" => Locale::get('core/notification/no_permissions')]);
        }
      
        $topic_id = Guild::createTopic(input('guild_id'), Helper::FilterString(input('title')), request()->player->id, $slug); 
        $reply_id = Guild::createReply($topic_id, Helper::FilterString(Helper::tagByUser(input('message'))), request()->player->id);
      
        response()->json(["status" => "success", "message" => Locale::get('core/notification/message_placed'), "replacepage" => "guilds/{$forums->id}/thread/{$topic_id}-{$slug}"]);
    }
}
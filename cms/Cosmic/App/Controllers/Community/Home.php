<?php
namespace App\Controllers\Community;

use App\Models\Community;
use App\Models\Player;

use Core\Locale;
use Core\View;

class Home
{
    public function index()
    {
        $news   = Community::getNews(5);
        $habbos = Community::getRandomUsers(18);
        $rooms  = Community::getPopularRooms(5);

        View::renderTemplate('Community/home.html', [
            'title'  => Locale::get('core/title/community/index'),
            'page'   => 'community_home',
            'news'   => $news,
            'habbos' => $habbos,
            'rooms'  => $rooms,
        ]);
    }
}

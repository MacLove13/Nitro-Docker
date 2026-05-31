<?php
namespace App\Controllers\Community;

use Core\Locale;
use Core\View;

class Fansites
{
    public function index()
    {
        View::renderTemplate('Community/fansites.html', [
            'title' => Locale::get('core/title/community/fansites'),
            'page'  => 'community_fansites',
        ]);
    }
}

<?php
namespace App\Middleware;

class CsrfMiddleware extends \Pecee\Http\Middleware\BaseCsrfVerifier
{
    public const POST_KEY = 'csrftoken';
  
    // except post requests
    protected $except = ['/settings/namechange/availability', 'housekeeping/*'];
}

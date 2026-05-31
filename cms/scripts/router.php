<?php

error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ini_set('display_errors', '0');

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = __DIR__ . '/../../var/www/html/public' . $path;

if ($path !== '/' && is_file($file)) {
    return false;
}

require __DIR__ . '/../../var/www/html/public/index.php';

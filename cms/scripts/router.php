<?php

error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ini_set('display_errors', '0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = __DIR__ . '/../../var/www/html/public' . $path;

// Serve static files with CORS headers
if ($path !== '/' && is_file($file)) {
    header('Access-Control-Allow-Origin: *');
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mimeTypes = [
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif'  => 'image/gif',
        'webp' => 'image/webp',
        'css'  => 'text/css',
        'js'   => 'application/javascript',
        'json' => 'application/json',
        'svg'  => 'image/svg+xml',
        'ico'  => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2'=> 'font/woff2',
    ];
    if (isset($mimeTypes[$ext])) {
        header('Content-Type: ' . $mimeTypes[$ext]);
        readfile($file);
        exit;
    }
    return false;
}

require __DIR__ . '/../../var/www/html/public/index.php';

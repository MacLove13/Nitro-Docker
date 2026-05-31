<?php
namespace Library;

use App\Config;
use App\Models\Core;

use Library\Json;

class HotelApi
{ 
    public static function execute($param, $data = null)
    {
        if(!Config::apiEnabled) {
            return json_encode(["status" => "error", "message" => "Socket API has been disabled"]);
        }
      
        $data = json_encode(array('key' => $param, 'data' => $data));

        $apiSettings = Core::settings();

        // Prefer ext-sockets when available.
        if (function_exists('socket_create')) {
            $socket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
            
            if ($socket === false) {
                return json_encode(["status" => "error", "message" => "socket_create() failed: reason: " . socket_strerror(socket_last_error()) . ""]);
            }

            $result = socket_connect($socket, $apiSettings->rcon_api_host, $apiSettings->rcon_api_port);
            if ($result === false) {
                return json_encode(["status" => "error", "message" => "socket_connect() failed.\nReason: " . socket_strerror(socket_last_error()) . ""]);
            }

            if(socket_write($socket, $data, strlen($data)) === false){
                return json_encode(["status" => "error", "message" => socket_strerror(socket_last_error($socket))]);
            }

            return socket_read($socket, 2048);
        }

        // Fallback for environments where ext-sockets is not enabled.
        $stream = @stream_socket_client('tcp://' . $apiSettings->rcon_api_host . ':' . $apiSettings->rcon_api_port, $errno, $errstr, 2);
        if ($stream === false) {
            return json_encode(["status" => "error", "message" => "stream_socket_client() failed.\nReason: " . $errstr . " (" . $errno . ")"]);
        }

        if (@fwrite($stream, $data) === false) {
            fclose($stream);
            return json_encode(["status" => "error", "message" => "stream write failed"]);
        }

        @stream_set_timeout($stream, 2);
        $response = @fread($stream, 2048);
        fclose($stream);

        return $response;
    }
}

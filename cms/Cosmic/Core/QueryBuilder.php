<?php
namespace Core;

use App\Config;

use Exception;
use PDO;
use Pixie\Connection;

class QueryBuilder {

    public function __construct() {
      
        $dotenv = new \Symfony\Component\Dotenv\Dotenv(true);
        $dotenv->loadEnv(dirname(__DIR__).'/.env');

        $config = [
            'driver'    => getenv('DB_DRIVER'), 
            'host'      => getenv('DB_HOST'),
            'database'  => getenv('DB_NAME'),
            'username'  => getenv('DB_USER'),
            'password'  => getenv('DB_PASS'),
            'charset'   => getenv('DB_CHARSET'), 
            'collation' => getenv('DB_COLLATION'),
            'options'   => [
                PDO::ATTR_TIMEOUT => 5,
                PDO::ATTR_EMULATE_PREPARES => false,
            ],
        ];

        try {
          new Connection('mysql', $config, 'QueryBuilder');
        } catch (PDOException $e) {
          echo "Database Error: The user could not be added.<br>".$e->getMessage();
        } catch (Exception $e) {
          echo "General Error: The user could not be added.<br>".$e->getMessage();
        }
    }
}
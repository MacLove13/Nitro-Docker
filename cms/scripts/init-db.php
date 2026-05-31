<?php

$host = getenv('DB_HOST') ?: 'mysql';
$port = getenv('DB_PORT') ?: '3306';
$db = getenv('DB_NAME') ?: 'arcturus';
$user = getenv('DB_USER') ?: 'arcturus_user';
$pass = getenv('DB_PASS') ?: 'arcturus_pw';
$charset = getenv('DB_CHARSET') ?: 'utf8';
$sqlPath = getenv('COSMIC_SQL') ?: '/database/Cosmic R2.3_base.sql';

$dsn = "mysql:host={$host};port={$port};dbname={$db};charset={$charset}";
$pdo = null;

for ($attempt = 1; $attempt <= 60; $attempt++) {
    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        break;
    } catch (Throwable $e) {
        if ($attempt === 60) {
            throw $e;
        }

        sleep(2);
    }
}

$count = (int) $pdo->query("
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = " . $pdo->quote($db) . "
      AND table_name = 'website_settings'
")->fetchColumn();

if ($count === 0 && is_file($sqlPath)) {
    echo "Importing Cosmic CMS database tables...\n";
    $pdo->exec(file_get_contents($sqlPath));
} elseif ($count > 0) {
    echo "Cosmic CMS database tables already exist; skipping import.\n";
}

$count = (int) $pdo->query("
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = " . $pdo->quote($db) . "
      AND table_name = 'website_settings'
")->fetchColumn();

// Run pending SQL migrations
$migrationsDir = '/database/migrations';
if ($count > 0 && is_dir($migrationsDir)) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS cms_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    $applied = $pdo->query("SELECT filename FROM cms_migrations")->fetchAll(PDO::FETCH_COLUMN);
    $files = glob($migrationsDir . '/*.sql');
    sort($files);

    foreach ($files as $file) {
        $filename = basename($file);
        if (!in_array($filename, $applied)) {
            echo "Applying migration: {$filename}\n";
            $pdo->exec(file_get_contents($file));
            $stmt = $pdo->prepare("INSERT INTO cms_migrations (filename) VALUES (?)");
            $stmt->execute([$filename]);
        }
    }
}

if ($count > 0) {
    $pdo->exec("
        ALTER TABLE users ADD COLUMN IF NOT EXISTS secret_key VARCHAR(40) NULL DEFAULT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode VARCHAR(11) NULL DEFAULT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_rank INT(2) NULL DEFAULT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS template ENUM('light','dark') NULL DEFAULT 'light';
        ALTER TABLE users MODIFY mail VARCHAR(500);
        ALTER TABLE bans MODIFY COLUMN machine_id VARCHAR(255) NOT NULL DEFAULT '';
    ");

    $pdo->exec("
        UPDATE website_settings SET value = 'arcturus' WHERE `key` = 'rcon_api_host';
        UPDATE website_settings SET value = '3001' WHERE `key` = 'rcon_api_port';
    ");
}

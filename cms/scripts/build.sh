#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/var/www/html}"
DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-arcturus}"
DB_USER="${DB_USER:-arcturus_user}"
DB_PASS="${DB_PASS:-arcturus_pw}"
DB_CHARSET="${DB_CHARSET:-utf8}"
DB_COLLATION="${DB_COLLATION:-utf8_general_ci}"
CMS_DOMAIN="${CMS_DOMAIN:-localhost:8082}"
CMS_NITRO_PATH="${CMS_NITRO_PATH:-http://localhost:1080}"
CMS_ASSET_PATH="${CMS_ASSET_PATH:-http://localhost:8080}"
CMS_FIGURE_PATH="${CMS_FIGURE_PATH:-https://habbo.com.br/habbo-imaging}"
CMS_SHORTNAME="${CMS_SHORTNAME:-Nitro}"
CMS_SITENAME="${CMS_SITENAME:-Nitro}"
CMS_SECRET_TOKEN="${CMS_SECRET_TOKEN:-NITRO-CMS-local-secret}"
COSMIC_SQL="${COSMIC_SQL:-/database/Cosmic R2.3_base.sql}"

export DB_HOST DB_PORT DB_NAME DB_USER DB_PASS DB_CHARSET DB_COLLATION COSMIC_SQL

cd "$APP_DIR"

if [ ! -f .env ]; then
    cat > .env <<EOF
DB_DRIVER=mysql
DB_HOST=$DB_HOST
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS
DB_CHARSET=$DB_CHARSET
DB_COLLATION=$DB_COLLATION
EOF
fi

if [ ! -f App/Config.php ]; then
    cat > App/Config.php <<EOF
<?php
namespace App;

class Config
{
    const client = array(
        'client_radio' => '',
        'nitro_path' => '$CMS_NITRO_PATH'
    );

    const site = array(
        'domain' => '$CMS_DOMAIN',
        'cpath' => '$CMS_ASSET_PATH',
        'fpath' => '$CMS_FIGURE_PATH',
        'shortname' => '$CMS_SHORTNAME',
        'sitename' => '$CMS_SITENAME'
    );

    const language = 'EN';
    const region = 'America/Sao_Paulo';
    const SECRET_TOKEN = '$CMS_SECRET_TOKEN';

    const mailHost = 'localhost';
    const mailFrom = 'noreply@localhost';
    const mailUser = '';
    const mailPass = '';
    const mailPort = 587;

    const look = array(
        'male' => array(
            'hr-802-37.hd-185-1.ch-804-82.lg-280-73.sh-3068-1408-1408.wa-2001',
            'hr-893-36.hd-208-8.ch-225-73.lg-270-64.sh-300-64.ea-1406.wa-2001',
            'hr-170-35.hd-190-10.ch-267-72.lg-3290-64.sh-3068-1408-72.cp-3125-64'
        ),
        'female' => array(
            'hr-890-35.hd-629-8.ch-665-76.lg-696-76.sh-730-64.ha-1003-64',
            'hr-890-37.hd-605-8.ch-650-76.lg-715-76.sh-907-71.he-3274-71.fa-3276-1408.ca-1812.wa-2008',
            'hr-545-45.hd-600-14.ch-650-76.lg-696-64.sh-907-76.he-1602-1408.wa-3210-1408-1408'
        )
    );

    const currencys = array(
        0 => 'credits',
        5 => 'diamonds',
        101 => 'duckets'
    );

    const apiEnabled = true;
    const debug = false;
    const view = 'App/View';
    const vpnLocation = '/../ASN.mmdb';
}
EOF
fi

mkdir -p public/tmp public/uploads
chown -R www-data:www-data public/tmp public/uploads

if [ ! -d vendor ] || [ ! -f vendor/autoload.php ]; then
    composer install --no-interaction --prefer-dist --no-progress
fi

echo "Waiting for CMS database target ${DB_HOST}:${DB_PORT}/${DB_NAME}..."
php /app/scripts/init-db.php

exec php -S 0.0.0.0:80 -t public /app/scripts/router.php

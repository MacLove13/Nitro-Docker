FROM meu-app-laravel:latest

COPY scripts/build.sh /app/scripts/build.sh
COPY scripts/init-db.php /app/scripts/init-db.php
COPY scripts/router.php /app/scripts/router.php

RUN chmod +x /app/scripts/build.sh

WORKDIR /var/www/html

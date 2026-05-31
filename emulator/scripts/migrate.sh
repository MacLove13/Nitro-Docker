#!/bin/bash
set -euo pipefail

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-arcturus}"
DB_USER="${DB_USER:-arcturus_user}"
DB_PASSWORD="${DB_PASSWORD:-arcturus_pw}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/app/migrations}"
MIGRATIONS_TABLE="${MIGRATIONS_TABLE:-schema_migrations}"

mysql_base=(mysql --ssl=0 -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASSWORD" "$DB_NAME")

echo "Waiting for database migrations target ${DB_HOST}:${DB_PORT}/${DB_NAME}..."
until mysqladmin --ssl=0 ping -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASSWORD" --silent; do
    sleep 2
done

"${mysql_base[@]}" -e "
CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`migration\` VARCHAR(255) NOT NULL,
    \`applied_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`migration\` (\`migration\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "Migrations directory not found: $MIGRATIONS_DIR"
    exit 0
fi

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    [ -e "$migration_file" ] || continue

    migration="$(basename "$migration_file")"
    case "$migration" in
        *"'"*)
            echo "Invalid migration filename: $migration"
            exit 1
            ;;
    esac

    applied_count="$("${mysql_base[@]}" -N -B -e "SELECT COUNT(*) FROM \`${MIGRATIONS_TABLE}\` WHERE \`migration\` = '$migration';")"

    if [ "$applied_count" != "0" ]; then
        echo "Skipping already applied migration: $migration"
        continue
    fi

    echo "Applying migration: $migration"
    "${mysql_base[@]}" < "$migration_file"
    "${mysql_base[@]}" -e "INSERT INTO \`${MIGRATIONS_TABLE}\` (\`migration\`) VALUES ('$migration');"
done

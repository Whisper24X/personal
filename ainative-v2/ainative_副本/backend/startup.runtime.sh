#!/usr/bin/env bash
set -e

DB_HOST="${DATABASE_HOST:-postgres}"
DB_PORT="${DATABASE_PORT:-5432}"

/opt/wait-for-it.sh "${DB_HOST}:${DB_PORT}"

node ./node_modules/typeorm/cli.js --dataSource=dist/database/data-source.js migration:run

node dist/main

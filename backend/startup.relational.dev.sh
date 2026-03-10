#!/usr/bin/env bash
set -e

DB_HOST="${DATABASE_HOST:-postgres}"
DB_PORT="${DATABASE_PORT:-5432}"
RUN_SEED="${AINATIVE_RUN_SEED:-true}"

/opt/wait-for-it.sh "${DB_HOST}:${DB_PORT}"

node ./node_modules/typeorm/cli.js --dataSource=dist/database/data-source.js migration:run

if [ "${RUN_SEED}" = "true" ]; then
  node dist/database/seeds/relational/run-seed.js
fi

node dist/main

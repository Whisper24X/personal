#!/usr/bin/env bash
set -e

export NODE_ENV="${NODE_ENV:-development}"
DB_HOST="${DATABASE_HOST:-postgres}"
DB_PORT="${DATABASE_PORT:-5432}"
RUN_SEED="${AINATIVE_RUN_SEED:-true}"

/opt/wait-for-it.sh "${DB_HOST}:${DB_PORT}"
npm run migration:run
if [ "${RUN_SEED}" = "true" ]; then
  npm run seed:run:relational
fi
npm run start:prod

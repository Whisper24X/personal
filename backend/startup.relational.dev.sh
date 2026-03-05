#!/usr/bin/env bash
set -e

export NODE_ENV="${NODE_ENV:-development}"

/opt/wait-for-it.sh postgres:5432
npm run migration:run
npm run seed:run:relational
npm run start:prod

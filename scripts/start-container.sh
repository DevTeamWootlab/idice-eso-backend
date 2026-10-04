#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  node scripts/run-production-bootstrap.mjs
fi

exec node dist/main.js
#!/bin/sh
set -eu

python -m backend.db_ready

if [ "$#" -eq 0 ] || [ "$1" = "gunicorn" ]; then
  if [ "$#" -gt 0 ]; then
    shift
  fi

  set -- gunicorn backend.backend:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind "${HOST:-0.0.0.0}:${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-2}" \
    "$@"
fi

exec "$@"

#!/bin/sh
set -eu

if [ -n "${POCKETBASE_EMAIL:-}" ] && [ -n "${POCKETBASE_PASSWORD:-}" ]; then
  /pb/pocketbase superuser upsert "${POCKETBASE_EMAIL}" "${POCKETBASE_PASSWORD}" --dir=/pb/pb_data || true
fi

exec /pb/pocketbase serve --http=0.0.0.0:8090 --dir=/pb/pb_data

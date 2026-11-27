#!/bin/sh
set -eu

PB_DATA_DIR="${PB_DATA_DIR:-/pb/pb_data}"
PB_SEED_ZIP="${POCKETBASE_SEED_ZIP:-}"
PB_SEED_FORCE="${POCKETBASE_SEED_FORCE:-false}"

if [ -n "${PB_SEED_ZIP}" ] && [ -f "${PB_SEED_ZIP}" ]; then
  if [ "${PB_SEED_FORCE}" = "true" ] || [ ! -f "${PB_DATA_DIR}/data.db" ]; then
    echo "[pocketbase] Seeding ${PB_DATA_DIR} from ${PB_SEED_ZIP}..."
    SEED_TMP="${PB_DATA_DIR}/.seed_tmp"
    rm -rf "${SEED_TMP}"
    mkdir -p "${SEED_TMP}"
    unzip -qo "${PB_SEED_ZIP}" -d "${SEED_TMP}"

    if [ ! -f "${SEED_TMP}/data.db" ]; then
      echo "[pocketbase] ERROR: ${PB_SEED_ZIP} does not contain data.db; aborting seed." >&2
      rm -rf "${SEED_TMP}"
      exit 1
    fi

    rm -rf "${PB_DATA_DIR:?}/data.db" \
           "${PB_DATA_DIR:?}/data.db-shm" \
           "${PB_DATA_DIR:?}/data.db-wal" \
           "${PB_DATA_DIR:?}/auxiliary.db" \
           "${PB_DATA_DIR:?}/auxiliary.db-shm" \
           "${PB_DATA_DIR:?}/auxiliary.db-wal" \
           "${PB_DATA_DIR:?}/storage" \
           "${PB_DATA_DIR:?}/types.d.ts"

    for item in storage types.d.ts auxiliary.db; do
      if [ -e "${SEED_TMP}/${item}" ]; then
        mv "${SEED_TMP}/${item}" "${PB_DATA_DIR}/${item}"
      fi
    done

    # Move data.db last so an interrupted seed never leaves a half-populated DB marked as seeded.
    mv "${SEED_TMP}/data.db" "${PB_DATA_DIR}/data.db"
    rm -rf "${SEED_TMP}"
    echo "[pocketbase] Seed completed successfully."
  else
    echo "[pocketbase] Existing data.db detected in ${PB_DATA_DIR}; skipping auto-seed (set POCKETBASE_SEED_FORCE=true to overwrite)."
  fi
fi

if [ -n "${POCKETBASE_EMAIL:-}" ] && [ -n "${POCKETBASE_PASSWORD:-}" ]; then
  /pb/pocketbase superuser upsert "${POCKETBASE_EMAIL}" "${POCKETBASE_PASSWORD}" --dir="${PB_DATA_DIR}" || true
fi

exec /pb/pocketbase serve --http=0.0.0.0:8090 --dir="${PB_DATA_DIR}" --migrationsDir=/pb/pb_migrations --hooksDir=/pb/pb_hooks

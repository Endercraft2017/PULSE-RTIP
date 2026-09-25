#!/bin/sh
# =============================================================================
# Container entrypoint (Railway)
# =============================================================================
# Runs migrations ONLY when the SQLite file does not exist yet. Re-running
# them against a live DB is unsafe: table-rebuild migrations such as 009
# recreate `reports` from a fixed column list and would drop columns added
# by later migrations (video_path, deleted_at, ...).
set -e

DB_PATH="${SQLITE_PATH:-/app/src/database/offline/pulse_rtip.db}"

if [ "${APP_MODE:-offline}" != "production" ] && [ ! -f "$DB_PATH" ]; then
  echo "[start] No database at $DB_PATH - creating schema"
  npm run migrate
fi

exec node server.js

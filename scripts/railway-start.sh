#!/bin/sh
# =============================================================================
# Container entrypoint (Railway)
# =============================================================================
# Runs ledger-protected migrations on startup, including upgrades of existing
# SQLite databases. Take a database backup before deploying a schema upgrade.
# SEED_DEMO=1 additionally loads the demo accounts/data into an empty DB.
set -e

DB_PATH="${SQLITE_PATH:-/app/src/database/offline/pulse_rtip.db}"

if [ "${APP_MODE:-offline}" != "production" ]; then
  npm run migrate
else
  node ../database/migrations/migrate.js --upgrade-dispatch
fi

# Opt-in demo data (SEED_DEMO=1). The seed inserts with hard-coded user IDs,
# so it only runs while the users table is empty - never on a DB with real
# accounts. A seed failure is logged but does not block startup.
if [ "${SEED_DEMO:-0}" = "1" ] && [ "${APP_MODE:-offline}" != "production" ]; then
  USER_COUNT=$(DB_PATH="$DB_PATH" node -e "
    const db = new (require('better-sqlite3'))(process.env.DB_PATH, { readonly: true });
    console.log(db.prepare('SELECT COUNT(*) AS c FROM users').get().c);
  " 2>/dev/null || echo "error")
  if [ "$USER_COUNT" = "0" ]; then
    echo "[start] SEED_DEMO=1 and users table is empty - seeding demo data"
    npm run seed || echo "[start] Seed failed - continuing without demo data"
  else
    echo "[start] SEED_DEMO=1 but users table has '$USER_COUNT' rows - skipping seed"
  fi
fi

exec node server.js

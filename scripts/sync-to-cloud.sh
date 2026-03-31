#!/usr/bin/env bash
# sync-to-cloud.sh — Snapshot local Supabase public schema data to Supabase Cloud.
# Usage: CLOUD_DB_URL=<url> bash scripts/sync-to-cloud.sh
# Or:    npm run sync:cloud  (reads CLOUD_DB_URL from .env.local automatically via dotenv-cli)
set -euo pipefail

# Require CLOUD_DB_URL
CLOUD_DB_URL="${CLOUD_DB_URL:?ERROR: CLOUD_DB_URL not set. Add it to apps/web/.env.local}"
LOCAL_PORT="${LOCAL_SUPABASE_DB_PORT:-54322}"
DUMP_FILE="/tmp/notiflow_sync_$(date +%Y%m%d_%H%M%S).dump"

echo ""
echo "=== NotiFlow Cloud Sync ==="
echo "Local port : $LOCAL_PORT"
echo "Dump file  : $DUMP_FILE"
echo ""

# Verify local Supabase is running
pg_isready --host=127.0.0.1 --port="$LOCAL_PORT" --username=postgres > /dev/null 2>&1 \
  || { echo "ERROR: Local Supabase is not running. Start with: npm run supabase:start"; exit 1; }

echo "[1/3] Dumping local public schema data..."
pg_dump \
  --host=127.0.0.1 --port="$LOCAL_PORT" \
  --username=postgres --dbname=postgres \
  --schema=public \
  --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  -Fc \
  -f "$DUMP_FILE"

DUMP_SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
echo "    Dump complete: $DUMP_SIZE"

echo "[2/3] Restoring to Cloud..."
pg_restore \
  --dbname="$CLOUD_DB_URL" \
  --schema=public \
  --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  --clean \
  --if-exists \
  -j 4 \
  "$DUMP_FILE"

echo "[3/3] Verifying row counts on Cloud..."
psql "$CLOUD_DB_URL" --tuples-only --no-align \
  -c "SELECT relname || ': ' || n_live_tup
      FROM pg_stat_user_tables
      WHERE schemaname='public' AND n_live_tup > 0
      ORDER BY n_live_tup DESC
      LIMIT 15;" \
  | grep -v '^$'

echo ""
echo "=== Sync complete ==="
echo "Dump saved to: $DUMP_FILE"

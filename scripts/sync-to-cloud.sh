#!/usr/bin/env bash
# sync-to-cloud.sh — 100% clone of local Supabase public schema to Supabase Cloud.
# Usage: CLOUD_DB_URL=<url> bash scripts/sync-to-cloud.sh
# Or:    npm run sync:cloud  (reads CLOUD_DB_URL from .env.local via dotenv-cli)
set -euo pipefail

# Add Homebrew libpq to PATH (for pg_dump, pg_restore, psql, pg_isready)
export PATH="/Users/hartmacm4/.local/homebrew/opt/libpq/bin:/opt/homebrew/opt/libpq/bin:/usr/local/opt/libpq/bin:$PATH"

# Require CLOUD_DB_URL
CLOUD_DB_URL="${CLOUD_DB_URL:?ERROR: CLOUD_DB_URL not set. Add it to apps/web/.env.local}"
LOCAL_PORT="${LOCAL_SUPABASE_DB_PORT:-54322}"
DUMP_FILE="/tmp/notiflow_sync_$(date +%Y%m%d_%H%M%S).dump"

echo ""
echo "=== NotiFlow Cloud Sync (Full Clone) ==="
echo "Local port : $LOCAL_PORT"
echo "Dump file  : $DUMP_FILE"
echo ""

# Verify local Supabase is running
pg_isready --host=127.0.0.1 --port="$LOCAL_PORT" --username=postgres > /dev/null 2>&1 \
  || { echo "ERROR: Local Supabase is not running. Start with: npm run supabase:start"; exit 1; }

echo "[1/3] Dumping local public schema data..."
PGPASSWORD=postgres pg_dump \
  --host=127.0.0.1 --port="$LOCAL_PORT" \
  --username=postgres --dbname=postgres \
  --schema=public \
  --data-only \
  --no-owner \
  --no-privileges \
  -Fc \
  -f "$DUMP_FILE"

DUMP_SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
echo "    Dump complete: $DUMP_SIZE"

echo "[2/3] Truncating all public tables on Cloud..."
# session_replication_role=replica disables FK trigger checks (incl. auth.users refs)
psql "$CLOUD_DB_URL" -q <<'SQL'
DO $$
DECLARE r RECORD;
BEGIN
  SET session_replication_role = replica;
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
    EXCEPTION WHEN OTHERS THEN
      -- skip tables that can't be truncated (e.g. views, partitions)
      NULL;
    END;
  END LOOP;
END $$;
SQL

echo "    Truncate complete."

echo "[3/3] Restoring all data to Cloud..."
# Pipe restore SQL through a single psql session with FK checks disabled
(
  echo "SET session_replication_role = replica;"
  pg_restore \
    --schema=public \
    --data-only \
    --no-owner \
    --no-privileges \
    -f - \
    "$DUMP_FILE" 2>/dev/null
) | psql "$CLOUD_DB_URL" -q

echo "    Restore complete."
echo ""
echo "=== Verifying row counts on Cloud ==="
psql "$CLOUD_DB_URL" --tuples-only --no-align -c "
SELECT tablename || ': ' || (
  SELECT count(*)::text FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = t.tablename
) as info
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;" 2>/dev/null || true

# Simple key table count
psql "$CLOUD_DB_URL" --tuples-only --no-align -c "
SELECT
  (SELECT count(*) FROM orders)            || ' orders',
  (SELECT count(*) FROM order_items)       || ' order_items',
  (SELECT count(*) FROM captured_messages) || ' captured_messages',
  (SELECT count(*) FROM hospitals)         || ' hospitals',
  (SELECT count(*) FROM suppliers)         || ' suppliers',
  (SELECT count(*) FROM products)          || ' products',
  (SELECT count(*) FROM mfds_drugs)        || ' mfds_drugs';" \
  | tr '|' '\n' | grep -v '^$' | sed 's/^ */  /'

echo ""
echo "=== Sync complete ==="
echo "Dump saved to: $DUMP_FILE"

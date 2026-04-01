#!/usr/bin/env bash
# sync-to-cloud.sh — Snapshot local Supabase public schema data to Supabase Cloud.
# Usage: CLOUD_DB_URL=<url> bash scripts/sync-to-cloud.sh
# Or:    npm run sync:cloud  (reads CLOUD_DB_URL from .env.local automatically via dotenv-cli)
set -euo pipefail

# Add Homebrew libpq to PATH (for pg_dump, pg_restore, psql, pg_isready)
export PATH="/Users/hartmacm4/.local/homebrew/opt/libpq/bin:/opt/homebrew/opt/libpq/bin:/usr/local/opt/libpq/bin:$PATH"

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

echo "[2/3] Restoring to Cloud..."
# Note: --disable-triggers requires superuser (not available on Cloud pooler)
# Use table-by-table restore in dependency order instead
# First truncate, then restore in FK-safe order
psql "$CLOUD_DB_URL" -q -c "
DO \$\$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND tablename NOT IN ('app_filters','audit_logs','my_drugs','my_devices','filter_rules','mobile_devices','categories','captured_messages')
  LOOP
    BEGIN EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END \$\$;
" 2>/dev/null || true

# Restore tables in FK dependency order
TABLES=(
  categories suppliers hospitals products partner_products partner_product_aliases
  hospital_products orders order_items order_comments
  captured_messages mobile_devices device_tokens
  notification_logs company_settings
  mfds_drugs mfds_devices mfds_items mfds_sync_logs mfds_sync_meta
  kpis_reports order_patterns order_forecasts forecast_items
  archived_messages product_box_specs
)

for TABLE in "${TABLES[@]}"; do
  pg_restore \
    --dbname="$CLOUD_DB_URL" \
    --schema=public \
    --data-only \
    --no-owner \
    --no-privileges \
    --table="$TABLE" \
    "$DUMP_FILE" 2>/dev/null || true
done

echo "[3/3] Verifying row counts on Cloud..."
psql "$CLOUD_DB_URL" --tuples-only --no-align \
  -c "SELECT
        (SELECT count(*) FROM orders)            || ' orders' ,
        (SELECT count(*) FROM hospitals)         || ' hospitals',
        (SELECT count(*) FROM suppliers)         || ' suppliers',
        (SELECT count(*) FROM captured_messages) || ' captured_messages',
        (SELECT count(*) FROM mfds_drugs)        || ' mfds_drugs';" \
  | tr '|' '\n' | grep -v '^$' | sed 's/^ */  /'

echo ""
echo "=== Sync complete ==="
echo "Dump saved to: $DUMP_FILE"

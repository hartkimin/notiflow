#!/usr/bin/env bash
# migrate-to-cloud.sh — One-time initial migration from local Supabase to Supabase Cloud.
# Run from repo root: bash scripts/migrate-to-cloud.sh
# Requires: supabase CLI logged in, CLOUD_DB_URL set, CLOUD_PROJECT_REF set
set -euo pipefail

CLOUD_PROJECT_REF="${CLOUD_PROJECT_REF:?ERROR: CLOUD_PROJECT_REF not set (e.g. export CLOUD_PROJECT_REF=abcdefghij)}"
CLOUD_DB_URL="${CLOUD_DB_URL:?ERROR: CLOUD_DB_URL not set}"
LOCAL_PORT="${LOCAL_SUPABASE_DB_PORT:-54322}"
DUMP_FILE="/tmp/notiflow_initial_$(date +%Y%m%d_%H%M%S).dump"

echo ""
echo "=================================================="
echo "  NotiFlow → Supabase Cloud Migration"
echo "  Project ref : $CLOUD_PROJECT_REF"
echo "  Local port  : $LOCAL_PORT"
echo "=================================================="
echo ""

# --- Pre-flight: verify local Supabase is running ---
echo "[pre-flight] Checking local Supabase..."
pg_isready --host=127.0.0.1 --port="$LOCAL_PORT" --username=postgres > /dev/null 2>&1 \
  || { echo "ERROR: Local Supabase is not running. Start with: npm run supabase:start"; exit 1; }
echo "  Local Supabase: OK"

# --- Pre-flight: verify Supabase CLI is logged in ---
echo "[pre-flight] Checking Supabase CLI login..."
supabase projects list > /dev/null 2>&1 \
  || { echo "ERROR: Not logged in. Run: supabase login"; exit 1; }
echo "  Supabase CLI: logged in"

echo ""
echo ">>> MANUAL STEP REQUIRED: Verify extensions in Cloud dashboard"
echo "    URL: https://supabase.com/dashboard/project/$CLOUD_PROJECT_REF/database/extensions"
echo "    Enable if not already on: pgvector, uuid-ossp, pg_trgm, unaccent, fuzzystrmatch"
echo "    pg_net is pre-enabled — verify it's in the 'extensions' schema."
echo ""
read -r -p "Press ENTER when extensions are confirmed..."

# --- Step 1: Check Cloud migration history ---
echo ""
echo "[1/5] Checking Cloud migration history..."
CLOUD_MIGRATIONS=$(psql "$CLOUD_DB_URL" --tuples-only --no-align \
  -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;" 2>/dev/null || echo "")

if [ -n "$CLOUD_MIGRATIONS" ]; then
  echo "  WARNING: Cloud already has migrations applied:"
  echo "$CLOUD_MIGRATIONS"
  echo ""
  echo "  Run 'supabase db push --dry-run --project-ref $CLOUD_PROJECT_REF' to preview conflicts."
  echo "  Then decide: repair individual migrations, or drop the public schema and start clean."
  echo "  To drop and start clean:"
  echo "    psql \"$CLOUD_DB_URL\" -c \"DROP SCHEMA public CASCADE; CREATE SCHEMA public;\""
  echo ""
  read -r -p "Continue with db push anyway? (y/N): " CONFIRM
  [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]] || { echo "Aborted."; exit 1; }
else
  echo "  Cloud migration history: clean"
fi

# --- Step 2: Push migrations ---
echo ""
echo "[2/5] Pushing 68 migrations to Cloud..."
cd packages/supabase
supabase link --project-ref "$CLOUD_PROJECT_REF"
supabase db push
cd ../..
echo "  Migrations pushed."

# --- Step 3: Configure DB-level settings ---
echo ""
echo "[3/5] Configuring app.settings.* on Cloud DB..."
echo "  Enter your Cloud service role key (from dashboard > Settings > API > service_role):"
read -r -s CLOUD_SERVICE_ROLE_KEY

psql "$CLOUD_DB_URL" << SQL
ALTER DATABASE postgres SET "app.settings.supabase_url" = 'https://${CLOUD_PROJECT_REF}.supabase.co';
ALTER DATABASE postgres SET "app.settings.service_role_key" = '${CLOUD_SERVICE_ROLE_KEY}';
SQL
echo "  app.settings configured."

echo ""
echo ">>> MANUAL STEP REQUIRED: Enable custom_access_token_hook in Cloud dashboard"
echo "    URL: https://supabase.com/dashboard/project/$CLOUD_PROJECT_REF/auth/hooks"
echo "    Enable 'custom_access_token_hook' → function: public.custom_access_token_hook"
echo ""
read -r -p "Press ENTER when hook is enabled..."

# --- Step 4: Deploy Edge Functions and secrets ---
echo ""
echo "[4/5] Deploying Edge Functions..."
cd packages/supabase
supabase functions deploy --project-ref "$CLOUD_PROJECT_REF"
cd ../..
echo "  Edge Functions deployed."
echo ""
echo ">>> MANUAL STEP REQUIRED: Set Edge Function secrets"
echo "    Run the following (fill in your values):"
cat << 'SECRETS'
supabase secrets set --project-ref $CLOUD_PROJECT_REF \
  ANTHROPIC_API_KEY=<your-anthropic-key> \
  FCM_SERVICE_ACCOUNT='<your-fcm-json>' \
  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> \
  CRON_SECRET=<your-cron-secret>
SECRETS
echo ""
read -r -p "Press ENTER when secrets are set..."

# --- Step 5: Data migration ---
echo ""
echo "[5/5] Migrating data: local → Cloud..."
echo "  Dumping local public schema data..."
PGPASSWORD=postgres pg_dump \
  --host=127.0.0.1 --port="$LOCAL_PORT" \
  --username=postgres --dbname=postgres \
  --schema=public \
  --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  -Fc \
  -f "$DUMP_FILE"

echo "  Restoring to Cloud..."
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

echo "  Data migration complete. Dump saved to: $DUMP_FILE"

# --- Verification ---
echo ""
echo "=== POST-MIGRATION VERIFICATION ==="
echo ""
echo "Row counts on Cloud:"
psql "$CLOUD_DB_URL" --tuples-only --no-align \
  -c "SELECT relname || ': ' || n_live_tup
      FROM pg_stat_user_tables
      WHERE schemaname='public' AND n_live_tup > 0
      ORDER BY n_live_tup DESC
      LIMIT 15;" \
  | grep -v '^$'

echo ""
echo ">>> MANUAL STEP REQUIRED: Configure Realtime in Cloud dashboard"
echo "    URL: https://supabase.com/dashboard/project/$CLOUD_PROJECT_REF/database/replication"
echo "    Enable replication for: orders, order_items, captured_messages, mobile_sync_queue"
echo ""
read -r -p "Press ENTER when Realtime is configured..."

echo ""
echo "=================================================="
echo "  Phase 1 Migration COMPLETE"
echo ""
echo "  Next steps:"
echo "  1. Verify the checklist in the spec doc"
echo "  2. Use 'npm run sync:cloud' for periodic snapshot syncs"
echo "  3. When ready to cut over, follow Phase 3 in the spec"
echo "=================================================="

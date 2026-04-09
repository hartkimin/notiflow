#!/usr/bin/env bash
# sync-to-cloud.sh — 100% clone of local Supabase (auth + public) to Supabase Cloud.
# Usage: CLOUD_DB_URL=<url> bash scripts/sync-to-cloud.sh
# Or:    npm run sync:cloud  (reads CLOUD_DB_URL from .env.local via dotenv-cli)
set -euo pipefail

# Add Homebrew libpq to PATH (for pg_dump, pg_restore, psql, pg_isready)
export PATH="/Users/hartmacm4/.local/homebrew/opt/libpq/bin:/opt/homebrew/opt/libpq/bin:/usr/local/opt/libpq/bin:$PATH"

# Require CLOUD_DB_URL
CLOUD_DB_URL="${CLOUD_DB_URL:?ERROR: CLOUD_DB_URL not set. Add it to apps/web/.env.local}"
LOCAL_PORT="${LOCAL_SUPABASE_DB_PORT:-54322}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
AUTH_DUMP_FILE="/tmp/notiflow_auth_${TIMESTAMP}.dump"
PUBLIC_DUMP_FILE="/tmp/notiflow_public_${TIMESTAMP}.dump"

echo ""
echo "=== NotiFlow Cloud Sync (Full Clone: auth + public) ==="
echo "Local port : $LOCAL_PORT"
echo ""

# Verify local Supabase is running
pg_isready --host=127.0.0.1 --port="$LOCAL_PORT" --username=postgres > /dev/null 2>&1 \
  || { echo "ERROR: Local Supabase is not running. Start with: npm run supabase:start"; exit 1; }

# ── Step 1: Dump ────────────────────────────────────────────────────────────
echo "[1/4] Dumping local auth + public schema data..."

PGPASSWORD=postgres pg_dump \
  --host=127.0.0.1 --port="$LOCAL_PORT" \
  --username=postgres --dbname=postgres \
  --schema=auth \
  --data-only --no-owner --no-privileges \
  --exclude-table=auth.schema_migrations \
  -Fc -f "$AUTH_DUMP_FILE"

PGPASSWORD=postgres pg_dump \
  --host=127.0.0.1 --port="$LOCAL_PORT" \
  --username=postgres --dbname=postgres \
  --schema=public \
  --data-only --no-owner --no-privileges \
  -Fc -f "$PUBLIC_DUMP_FILE"

echo "    auth:   $(du -sh "$AUTH_DUMP_FILE" | cut -f1)"
echo "    public: $(du -sh "$PUBLIC_DUMP_FILE" | cut -f1)"

# ── Step 2: Truncate auth on Cloud ──────────────────────────────────────────
echo "[2/4] Truncating auth tables on Cloud..."
psql "$CLOUD_DB_URL" -q <<'SQL'
SET session_replication_role = replica;
TRUNCATE auth.identities, auth.mfa_amr_claims, auth.mfa_challenges, auth.mfa_factors,
         auth.refresh_tokens, auth.sessions, auth.one_time_tokens,
         auth.flow_state, auth.audit_log_entries CASCADE;
TRUNCATE auth.users CASCADE;
SQL
echo "    Done."

# ── Step 3: Restore auth ────────────────────────────────────────────────────
echo "[3/4] Restoring auth data to Cloud..."
(
  echo "SET session_replication_role = replica;"
  pg_restore --schema=auth --data-only --no-owner --no-privileges -f - "$AUTH_DUMP_FILE" 2>/dev/null
) | psql "$CLOUD_DB_URL" -q
echo "    Done."

# ── Step 4: Truncate + Restore public ───────────────────────────────────────
echo "[4/4] Truncating + Restoring public data to Cloud..."
psql "$CLOUD_DB_URL" -q <<'SQL'
DO $$
DECLARE r RECORD;
BEGIN
  SET session_replication_role = replica;
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
SQL

(
  echo "SET session_replication_role = replica;"
  pg_restore --schema=public --data-only --no-owner --no-privileges -f - "$PUBLIC_DUMP_FILE" 2>/dev/null
) | psql "$CLOUD_DB_URL" -q
echo "    Done."

# ── Verify ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Verification ==="
psql "$CLOUD_DB_URL" --tuples-only --no-align -c "
SELECT
  (SELECT count(*) FROM auth.users)        || ' auth.users',
  (SELECT count(*) FROM orders)            || ' orders',
  (SELECT count(*) FROM order_items)       || ' order_items',
  (SELECT count(*) FROM captured_messages) || ' captured_messages',
  (SELECT count(*) FROM hospitals)         || ' hospitals',
  (SELECT count(*) FROM suppliers)         || ' suppliers',
  (SELECT count(*) FROM mfds_drugs)        || ' mfds_drugs';" \
  | tr '|' '\n' | grep -v '^$' | sed 's/^ */  /'

echo ""
echo "=== Sync complete ==="
echo "Dumps saved: $AUTH_DUMP_FILE, $PUBLIC_DUMP_FILE"

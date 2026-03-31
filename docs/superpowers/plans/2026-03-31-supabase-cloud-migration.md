# Supabase Cloud Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate NotiFlow from a local Supabase Docker instance to Supabase Cloud, with a safe parallel-operation period followed by a clean cutover.

**Architecture:** Phase 1 applies all 68 migrations and copies data to Cloud one time. Phase 2 creates a `sync-to-cloud.sh` script that periodically snapshots local data to Cloud while the app remains on local. Phase 3 is a documented cutover runbook — update env vars, redeploy, rebuild Android APK, then shut down local.

**Tech Stack:** Supabase CLI, pg_dump/pg_restore, bash, Node.js (npm scripts)

**Spec:** `docs/superpowers/specs/2026-03-31-supabase-cloud-migration-design.md`

---

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `scripts/migrate-to-cloud.sh` | Create | One-time Phase 1 script: pre-flight + db push + data dump/restore |
| `scripts/sync-to-cloud.sh` | Create | Phase 2 periodic sync: pg_dump local → pg_restore Cloud |
| `apps/web/.env.cloud.example` | Create | Template of Cloud env vars to fill in from Supabase dashboard |
| `package.json` (root) | Modify | Add `sync:cloud` npm script |

---

## Task 1: Create `.env.cloud.example` template

**Files:**
- Create: `apps/web/.env.cloud.example`

- [ ] **Step 1: Create the Cloud env var template**

```bash
cat > apps/web/.env.cloud.example << 'EOF'
# Supabase Cloud — copy values from: https://supabase.com/dashboard/project/<cloud-ref>/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://<cloud-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<cloud-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<cloud-service-role-key>

# Cloud DB direct connection (for pg_dump/pg_restore sync)
# From: https://supabase.com/dashboard/project/<cloud-ref>/settings/database
# Use "Connection string" > "URI" format, replace [YOUR-PASSWORD]
CLOUD_DB_URL=postgresql://postgres:<password>@db.<cloud-ref>.supabase.co:5432/postgres

# Keep existing values unchanged:
PARSE_API_SECRET=<same-as-current>
CRON_SECRET=<same-as-current>
NEXT_PUBLIC_FIREBASE_API_KEY=<same-as-current>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=notiflow-55905
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=252695962733
NEXT_PUBLIC_FIREBASE_APP_ID=<same-as-current>
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<same-as-current>
FCM_SERVICE_ACCOUNT=<same-as-current>
EOF
```

- [ ] **Step 2: Add `CLOUD_DB_URL` to your local `.env.local`**

Open `apps/web/.env.local` and add at the bottom:
```bash
# Supabase Cloud DB (for sync-to-cloud.sh)
CLOUD_DB_URL=postgresql://postgres:<password>@db.<cloud-ref>.supabase.co:5432/postgres
```
Fill in the actual password and project ref from the Supabase dashboard.

- [ ] **Step 3: Commit**

```bash
git add apps/web/.env.cloud.example
git commit -m "chore: add Supabase Cloud env var template"
```

---

## Task 2: Create `sync-to-cloud.sh` (Phase 2 periodic sync script)

**Files:**
- Create: `scripts/sync-to-cloud.sh`

- [ ] **Step 1: Create the sync script**

```bash
cat > scripts/sync-to-cloud.sh << 'SCRIPT'
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
SCRIPT

chmod +x scripts/sync-to-cloud.sh
```

- [ ] **Step 2: Add `sync:cloud` npm script to root `package.json`**

Edit `package.json` — add to the `scripts` object:
```json
"sync:cloud": "dotenv -e apps/web/.env.local -- bash scripts/sync-to-cloud.sh"
```

The full scripts block becomes:
```json
"scripts": {
  "dev:web": "npm run dev --workspace=apps/web",
  "build:web": "npm run build --workspace=apps/web",
  "lint:web": "npm run lint --workspace=apps/web",
  "supabase:start": "npx supabase start --workdir packages/supabase",
  "supabase:stop": "npx supabase stop --workdir packages/supabase",
  "supabase:status": "npx supabase status --workdir packages/supabase",
  "supabase:reset": "npx supabase db reset --workdir packages/supabase",
  "dev:local": "npm run supabase:start && npm run dev:web",
  "docker:web": "node -e \"process.env.APP_VERSION=require('./apps/web/package.json').version; require('child_process').execSync('docker compose up web --build -d', {stdio:'inherit',env:process.env})\"",
  "docker:web:stop": "docker compose down",
  "docker:web:logs": "docker compose logs -f web",
  "sync:cloud": "dotenv -e apps/web/.env.local -- bash scripts/sync-to-cloud.sh"
}
```

- [ ] **Step 3: Install `dotenv-cli` as dev dependency (needed for npm run sync:cloud)**

```bash
npm install --save-dev dotenv-cli
```

- [ ] **Step 4: Verify the script syntax is correct**

```bash
bash -n scripts/sync-to-cloud.sh && echo "Syntax OK"
```
Expected: `Syntax OK`

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-to-cloud.sh package.json package-lock.json
git commit -m "feat: add sync-to-cloud.sh for periodic snapshot sync to Supabase Cloud"
```

---

## Task 3: Create `migrate-to-cloud.sh` (Phase 1 one-time migration script)

**Files:**
- Create: `scripts/migrate-to-cloud.sh`

This script wraps all Phase 1 manual steps into a guided checklist runner. It performs the automated parts and prints clear instructions for the dashboard steps that must be done manually.

- [ ] **Step 1: Create the migration script**

```bash
cat > scripts/migrate-to-cloud.sh << 'SCRIPT'
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
SCRIPT

chmod +x scripts/migrate-to-cloud.sh
```

- [ ] **Step 2: Verify script syntax**

```bash
bash -n scripts/migrate-to-cloud.sh && echo "Syntax OK"
```
Expected: `Syntax OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-to-cloud.sh
git commit -m "feat: add migrate-to-cloud.sh for one-time Phase 1 migration to Supabase Cloud"
```

---

## Task 4: Phase 1 — Run the initial migration

> **This task is INTERACTIVE** — it requires dashboard actions and your Cloud credentials. Run from your local machine with local Supabase running.

**Prerequisites:**
- Local Supabase running (`npm run supabase:start`)
- `CLOUD_DB_URL` and `CLOUD_PROJECT_REF` available (from Supabase Cloud dashboard)
- Supabase CLI installed globally

- [ ] **Step 1: Log in to Supabase CLI**

```bash
supabase login
```
Follow the browser prompt to authenticate.

- [ ] **Step 2: Verify you can see your Cloud project**

```bash
supabase projects list
```
Expected: Your Cloud project appears in the list. Note the `ref` value — this is your `CLOUD_PROJECT_REF`.

- [ ] **Step 3: Run the migration script**

```bash
export CLOUD_PROJECT_REF=<your-project-ref>
export CLOUD_DB_URL=postgresql://postgres:<password>@db.<cloud-ref>.supabase.co:5432/postgres
bash scripts/migrate-to-cloud.sh
```
Follow all interactive prompts. The script will pause at each dashboard step.

- [ ] **Step 4: Verify Phase 1 checklist (from spec)**

Run against Cloud DB:
```sql
-- Migration count
SELECT count(*) FROM supabase_migrations.schema_migrations;
-- Expected: 68

-- Key table row counts (compare to local)
SELECT relname, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('orders','hospitals','suppliers','products','captured_messages','mfds_items')
ORDER BY relname;

-- Extensions
SELECT name, installed_version FROM pg_available_extensions
WHERE name IN ('vector','uuid-ossp','pg_net','pg_trgm','unaccent','fuzzystrmatch')
  AND installed_version IS NOT NULL;

-- app.settings (verify webhooks will work)
SELECT current_setting('app.settings.supabase_url', true) AS url,
       length(current_setting('app.settings.service_role_key', true)) > 0 AS key_set;
```

- [ ] **Step 5: Test Edge Functions on Cloud**

```bash
# Test ai-product-search (replace with your Cloud URL and anon key)
curl -s -X POST "https://<cloud-ref>.supabase.co/functions/v1/ai-product-search" \
  -H "Authorization: Bearer <cloud-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}' | head -c 200
```
Expected: JSON response (not a 500 or auth error).

---

## Task 5: Phase 2 — Test periodic sync

- [ ] **Step 1: Verify `CLOUD_DB_URL` is set in `apps/web/.env.local`**

```bash
grep CLOUD_DB_URL apps/web/.env.local
```
Expected: the line is present and non-empty.

- [ ] **Step 2: Run a test sync**

```bash
npm run sync:cloud
```
Expected output pattern:
```
=== NotiFlow Cloud Sync ===
[1/3] Dumping local public schema data...
    Dump complete: 15M
[2/3] Restoring to Cloud...
[3/3] Verifying row counts on Cloud...
orders: 142
hospitals: 23
...
=== Sync complete ===
```

- [ ] **Step 3: Spot-check a few rows match**

```bash
# Check latest order on local
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT id, order_no, status, created_at FROM orders ORDER BY created_at DESC LIMIT 3;"

# Check same rows exist on Cloud
psql "$CLOUD_DB_URL" \
  -c "SELECT id, order_no, status, created_at FROM orders ORDER BY created_at DESC LIMIT 3;"
```
Expected: identical results.

---

## Task 6: Phase 3 Cutover Runbook (documentation only — execute when ready)

> **This task is a runbook** — do not execute until you have confirmed Cloud is healthy via repeated sync runs. The cutover creates a brief maintenance window.

**Files:**
- Create: `docs/superpowers/specs/cutover-runbook.md`

- [ ] **Step 1: Create the cutover runbook**

```bash
cat > docs/superpowers/specs/cutover-runbook.md << 'EOF'
# Supabase Cloud Cutover Runbook

Execute when Cloud has been validated through multiple successful sync runs.

## Pre-cutover checklist
- [ ] At least 3 successful `npm run sync:cloud` runs with matching row counts
- [ ] Cloud Edge Functions responding correctly
- [ ] Push notifications working on Cloud
- [ ] Clinic staff notified of maintenance window + session re-login required

## Cutover steps

### 1. Maintenance mode
Enable Vercel maintenance page or deploy a temporary "System maintenance" build.

### 2. Drain in-flight requests
Wait ~30 seconds after last user activity.

### 3. Final sync
```bash
npm run sync:cloud
```
Note: this is the last time local data goes to Cloud.

### 4. Update `apps/web/.env.local`
Replace local values with Cloud values (see `apps/web/.env.cloud.example`):
- `NEXT_PUBLIC_SUPABASE_URL` → `https://<cloud-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Cloud anon key
- `SUPABASE_SERVICE_ROLE_KEY` → Cloud service role key

### 5. Update Vercel environment variables
Supabase dashboard → Settings → API → copy URL, anon key, service_role key.
Vercel dashboard → Project → Settings → Environment Variables.
Update the three Supabase variables for Production environment.

### 6. Redeploy on Vercel
Trigger a new deployment (push empty commit or trigger via Vercel dashboard).

### 7. Rebuild Android APK
Update `apps/mobile/local.properties`:
```
SUPABASE_URL=https://<cloud-ref>.supabase.co
SUPABASE_KEY=<cloud-anon-key>
```
Build and distribute:
```bash
cd apps/mobile
./gradlew assembleRelease
```
Distribute APK to ALL clinic devices before step 9. Devices with old APK will fail to connect.

### 8. Smoke test
- [ ] Web app loads and user can log in
- [ ] Create a test order end-to-end
- [ ] Parse a test message via AI pipeline
- [ ] Realtime subscription fires on status change
- [ ] Push notification delivered to test device
- [ ] Android device (updated APK) connects and syncs

### 9. Remove maintenance mode
Re-enable normal Vercel deployment.

### 10. Stop local Supabase
```bash
npm run supabase:stop
```

## Rollback (if Cloud has issues)
1. Re-enable maintenance mode.
2. Revert `apps/web/.env.local` to local values.
3. Restart local: `npm run supabase:start`
4. Revert Vercel env vars and redeploy.
5. Rollback Android APK distribution if already pushed.
EOF
```

- [ ] **Step 2: Commit the runbook**

```bash
git add docs/superpowers/specs/cutover-runbook.md
git commit -m "docs: add Phase 3 cutover runbook for Supabase Cloud migration"
```

---

## Summary

| Phase | What it does | How to trigger |
|---|---|---|
| Phase 1 (one-time) | Schema + data to Cloud | `bash scripts/migrate-to-cloud.sh` |
| Phase 2 (ongoing) | Snapshot sync local → Cloud | `npm run sync:cloud` |
| Phase 3 (when ready) | Cutover + shut down local | Follow `docs/superpowers/specs/cutover-runbook.md` |

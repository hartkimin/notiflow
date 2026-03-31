# Supabase Cloud Migration Design

**Date:** 2026-03-31
**Status:** Approved

---

## Problem

The NotiFlow production database currently runs on a local Supabase instance (Docker, localhost:54321). This creates a single point of failure with no off-site backup. The goal is to migrate to Supabase Cloud as the primary database, with a safe transition period where local continues to serve the app while Cloud is validated via periodic snapshot sync.

---

## Goals

1. Replicate the full local schema (68 migrations) and all data to Supabase Cloud.
2. Run both environments in parallel — the app writes to local, Cloud receives periodic snapshot backups.
3. Cut over to Cloud once it is confirmed healthy, then shut down local.

---

## Non-Goals

- Real-time logical replication (Postgres WAL streaming) between local and Cloud.
- Dual-write at the application level.
- Keeping local running long-term as a secondary replica.

---

## Architecture

### Phase 1 — Initial Migration (one-time)

```
Local Supabase (Docker)          Supabase Cloud
─────────────────────            ──────────────────────
68 migration files           →   supabase db push
pg_dump public schema data   →   pg_restore
```

#### Pre-flight checks (before pushing)

1. In Supabase Cloud dashboard, verify these extensions are enabled under **Database > Extensions**:
   - `pgvector`
   - `uuid-ossp`
   - `pg_net` (pre-enabled on Cloud; verify it is in `extensions` schema)
   - `pg_trgm`, `unaccent`, `fuzzystrmatch`

2. Check the Cloud migration history to avoid conflicts:
   ```sql
   -- Run against Cloud DB
   SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
   ```
   If any versions match local files, repair with:
   ```bash
   supabase migration repair --status applied <version> --project-ref <cloud-ref>
   ```
   Or to mark all Cloud-existing migrations as applied without re-running:
   ```bash
   supabase db push --dry-run
   ```
   Review output before proceeding.

#### Migration steps

1. `supabase login` — authenticate CLI with Cloud account.
2. `supabase link --project-ref <cloud-ref>` — link repo to Cloud project (run from `packages/supabase/`).
3. Push all 68 migrations:
   ```bash
   supabase db push
   ```
   If Cloud has conflicting objects from its old schema, connect directly and drop them, then retry:
   ```bash
   # Drop old schema objects via psql connection to Cloud
   psql "<cloud-db-url>" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   supabase db push
   ```

4. Configure database-level settings required by webhook triggers (migrations 00004, 00067):
   ```sql
   -- Run against Cloud DB via psql or Supabase SQL editor
   ALTER DATABASE postgres SET "app.settings.supabase_url" = 'https://<cloud-ref>.supabase.co';
   ALTER DATABASE postgres SET "app.settings.service_role_key" = '<cloud-service-role-key>';
   ```
   Without these, push notification webhooks (`on_raw_message_inserted`, `on_order_created`, `on_web_push_created`) will silently fail.

5. Enable custom access token hook in Cloud dashboard:
   - Go to **Authentication > Hooks**
   - Enable `custom_access_token_hook` pointing to `public.custom_access_token_hook`
   - Note: `supabase db push` deploys the function but does NOT activate it automatically.

6. Deploy Edge Functions:
   ```bash
   supabase functions deploy --project-ref <cloud-ref>
   ```

7. Set Edge Function secrets:
   ```bash
   supabase secrets set --project-ref <cloud-ref> \
     ANTHROPIC_API_KEY=<value> \
     FCM_SERVICE_ACCOUNT='<json>' \
     SUPABASE_SERVICE_ROLE_KEY=<value> \
     CRON_SECRET=<value>
   ```

8. Data migration — dump `public` schema data only from local, restore to Cloud:
   ```bash
   # Dump public schema data only (exclude auth.* and system schemas)
   pg_dump \
     --host=127.0.0.1 --port=54322 --username=postgres --dbname=postgres \
     --schema=public \
     --data-only \
     --no-owner \
     --no-privileges \
     --disable-triggers \
     -Fc \
     -f local_data.dump

   # Restore to Cloud (connection string from Cloud dashboard > Settings > Database)
   pg_restore \
     --dbname="<cloud-connection-string>" \
     --schema=public \
     --data-only \
     --no-owner \
     --no-privileges \
     --disable-triggers \
     --clean \
     --if-exists \
     -j 4 \
     local_data.dump
   ```
   `--disable-triggers` defers FK checks during restore. `--clean --if-exists` truncates existing rows before inserting.

9. Configure Realtime publications in Cloud dashboard:
   - Go to **Database > Replication**
   - Enable replication for the same tables as local (see migration 00006):  `orders`, `order_items`, `captured_messages`, `mobile_sync_queue`

---

### Phase 2 — Parallel Operation (periodic snapshot sync)

The app continues pointing to local. Cloud receives full `public` schema snapshots on demand.

**Script: `scripts/sync-to-cloud.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Load Cloud connection string from env
CLOUD_DB_URL="${CLOUD_DB_URL:?CLOUD_DB_URL not set}"
LOCAL_PORT="${LOCAL_SUPABASE_DB_PORT:-54322}"
DUMP_FILE="/tmp/notiflow_sync_$(date +%Y%m%d_%H%M%S).dump"

echo "[sync] Dumping local public schema data..."
pg_dump \
  --host=127.0.0.1 --port="$LOCAL_PORT" \
  --username=postgres --dbname=postgres \
  --schema=public --data-only \
  --no-owner --no-privileges \
  --disable-triggers \
  -Fc -f "$DUMP_FILE"

echo "[sync] Restoring to Cloud..."
pg_restore \
  --dbname="$CLOUD_DB_URL" \
  --schema=public --data-only \
  --no-owner --no-privileges \
  --disable-triggers \
  --clean --if-exists \
  -j 4 \
  "$DUMP_FILE"

echo "[sync] Done. Dump: $DUMP_FILE"
# Log row count for verification
psql "$CLOUD_DB_URL" -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_live_tup DESC LIMIT 10;"
```

**npm script added to root `package.json`:**
```json
"sync:cloud": "bash scripts/sync-to-cloud.sh"
```

**Environment variable needed locally:**
```bash
# Add to apps/web/.env.local (not committed)
CLOUD_DB_URL=postgresql://postgres:<password>@db.<cloud-ref>.supabase.co:5432/postgres
```

---

### Phase 3 — Cutover (planned maintenance window)

**Before cutover — communicate to users:**
- JWT tokens issued by local Supabase are invalid on Cloud (different JWT secret).
- All active sessions (web + mobile) will require re-login after cutover.
- Notify clinic staff of brief maintenance window.

**Cutover steps:**

1. Put app into maintenance mode (set env var or temporary Vercel deployment).
2. Wait for all in-flight requests to drain (~30 seconds).
3. Run final sync:
   ```bash
   CLOUD_DB_URL=<cloud-db-url> npm run sync:cloud
   ```
4. Update `apps/web/.env.local` (for Docker/local dev going forward):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<cloud-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<cloud-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<cloud-service-role-key>
   ```
5. Update Vercel environment variables (Dashboard > Project > Settings > Environment Variables).
6. Rebuild and redeploy web app on Vercel.
7. **Rebuild Android APK** with new `local.properties`:
   ```
   SUPABASE_URL=https://<cloud-ref>.supabase.co
   SUPABASE_KEY=<cloud-anon-key>
   ```
   Distribute updated APK to all clinic devices. Until devices are updated, Android data will be lost (sent to stopped local instance).
8. Smoke test Cloud: create order, parse message, check realtime, verify push notification.
9. Remove maintenance mode.
10. Stop local Docker: `npm run supabase:stop`.

---

## Environment Variables

Three locations must be updated at cutover:

| Location | Variables |
|---|---|
| `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Vercel project settings | Same as above, plus `CRON_SECRET` |
| `apps/mobile/local.properties` | `SUPABASE_URL`, `SUPABASE_KEY` |

A `apps/web/.env.cloud.example` template file will be added showing which keys to populate from Cloud dashboard.

---

## Verification Checklist

### After Phase 1

- [ ] Cloud migration names match local: `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version` — compare against local `migrations/` directory listing
- [ ] Row counts match for key tables: `orders`, `hospitals`, `suppliers`, `products`, `captured_messages`, `mfds_items`, `mfds_drugs`, `mfds_devices`
- [ ] Extensions enabled: `pgvector`, `uuid-ossp`, `pg_net`, `pg_trgm`, `unaccent`, `fuzzystrmatch`
- [ ] `app.settings.supabase_url` and `app.settings.service_role_key` configured on Cloud DB
- [ ] Custom access token hook active in Cloud Authentication > Hooks
- [ ] Edge Functions deployed and secrets set
- [ ] Realtime replication configured for key tables

### After Phase 3 (Cutover)

- [ ] Web app loads and authenticates against Cloud
- [ ] Create new order end-to-end
- [ ] Parse a message via AI pipeline
- [ ] Realtime subscription fires on order status change
- [ ] Push notification delivered to test device
- [ ] Android app connects and syncs (after APK update)
- [ ] Vercel cron jobs execute successfully (check logs after next scheduled run)

---

## Files to Create / Modify

| File | Action |
|---|---|
| `scripts/sync-to-cloud.sh` | Create — periodic sync script |
| `scripts/migrate-to-cloud.sh` | Create — one-time initial migration script (wraps Phase 1 steps) |
| `package.json` (root) | Add `sync:cloud` npm script |
| `apps/web/.env.cloud.example` | Create — Cloud env var template |
| `packages/supabase/config.toml` | No change |

---

## Risks

| Risk | Mitigation |
|---|---|
| Cloud has conflicting old schema | Drop `public` schema on Cloud before `db push` if needed |
| Cloud migration history conflicts with local | Inspect and repair with `supabase migration repair` |
| `pg_restore` FK violations | `--disable-triggers` defers FK checks; `-j 4` parallelism safe with triggers disabled |
| Auth users not migrated | Acceptable — users re-create accounts or admin re-invites; auth data is separate from app data |
| JWT session invalidation at cutover | Communicate maintenance window to clinic staff in advance |
| Android devices with old APK after cutover | Prioritize APK distribution before cutover; consider brief overlap period |
| Webhook triggers silently failing | Mitigated by configuring `app.settings.*` in Phase 1 Step 4 |
| Vercel cron fires during cutover gap | Update Vercel env vars only after final sync completes; verify no cron is imminent |

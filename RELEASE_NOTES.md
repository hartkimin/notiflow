# NotiFlow Release Notes

## v0.1.0 — 2026-02-16

Initial integrated release after monorepo restructure. Covers web dashboard,
mobile app debugging, and Supabase backend stabilization.

### Web Dashboard (`apps/web`)

- **Realtime subscriptions** on all dashboard pages (hospitals, products, orders,
  suppliers) via Supabase Realtime
- **Order detail page** with print/PDF export
- **Dashboard analytics**: trend chart, hospital/product rankings
- **Manual parsing UI** for failed messages
- **Cron Jobs**: automated monthly sales report generation via Vercel Cron
- **Dark mode** toggle with system preference detection
- **Vercel Analytics** integration
- **Browser notifications** triggered by Supabase Realtime events
- **Responsive UI** enhancements for mobile and tablet viewports
- **PWA support**: web manifest, service worker, offline caching
- **Error handling**: toast notifications on all CRUD components now show actual
  Supabase error messages instead of generic failure text
- **Product insert fix**: `createProduct` now populates the required `name` column
  from `official_name`, fixing NOT NULL constraint violation on every product create
- **Product categories**: added missing `catheter`, `supplement`, `other` to dropdown
- **Code quality**: all ESLint errors/warnings resolved, Next.js deprecations fixed

### Mobile App (`apps/mobile`)

- **Thread safety fix**: `CaptureNotificationHelper` notification ID changed to
  `AtomicInteger` with atomic read-increment-wrap
- **Mutex race fix**: `AiMessageClassifier.unload()` now routes through
  `safeUnload()` to respect the mutex protecting `generate()`
- **Backup metadata fix**: `BackupManager.DB_VERSION` corrected from 18 to 21
  to match actual Room database version
- **Firebase/FCM disabled**: temporarily commented out until `google-services.json`
  is configured; `NotiFlowFcmService.kt` preserved as `.disabled`
- **Sync fix — CategoryDto `is_active`**: field was missing from DTO, causing
  category active state to be lost on every sync round-trip
- **Sync fix — FilterRule keywords**: disabled keywords were filtered out before
  push, permanently deleting them from Supabase; now all keywords are synced
- **Sync fix — `initialSync()` push logic**: only pushed rows missing from remote;
  locally-updated rows that already existed remotely were silently dropped.
  Now pushes rows that are locally newer (by `updatedAt` timestamp)
- **NotiFlow API removed**: `NotiFlowApiClient`, `NotiFlowModule` DI, and settings
  UI section removed (unused external API); source preserved as `.disabled`

### Supabase Backend (`packages/supabase`)

- **Mobile sync tables**: migration `00010` adds 7 tables (`categories`,
  `status_steps`, `filter_rules`, `captured_messages`, `app_filters`, `plans`,
  `day_categories`) with TEXT PKs and BIGINT timestamps matching mobile Room schema
- **RLS policies**: user-scoped `auth.uid() = user_id` on all mobile tables
- **Realtime publication**: all mobile tables added to `supabase_realtime`
- **Idempotent migration**: `DO $$` blocks check `pg_policies` and
  `pg_publication_tables` before creating, safe for re-runs
- **Migration `00011`**: adds `is_active BOOLEAN NOT NULL DEFAULT true` column
  to `categories` table to match mobile Room entity
- **Webhook triggers**: `device_tokens` table and deploy script for Edge Functions
- **Audit logs & analytics**: RPC functions for dashboard analytics
- **SQL fixes**: RLS consistency, missing admin policies, supplier index corrections,
  schema mismatch and payload validation fixes
- **Data retention**: weekly archive cron policy

### Infrastructure

- **Monorepo structure**: `apps/mobile`, `apps/web`, `packages/supabase`
- **Vercel deployment**: production deploy from `apps/web/`
- **Supabase CLI**: all 11 migrations applied and synced with remote
- **Git remote**: SSH (`git@github.com:hartkimin/notiflow.git`)

### Known Limitations

- FCM push notifications disabled (requires `google-services.json` from Firebase Console)
- `SupabaseDataSource` silently returns `emptyList()` on sync errors — error
  propagation to UI not yet implemented
- No automated E2E tests

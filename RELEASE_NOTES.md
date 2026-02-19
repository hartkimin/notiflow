# NotiFlow Release Notes

## v0.2.0 — 2026-02-19

주문서 양식 변경, 파싱 로직 통합, AI 제품 검색 기능 추가.

### Web Dashboard (`apps/web`)

- **주문 플랫 테이블**: `/orders` 페이지를 주문 단위 목록에서 아이템별 플랫
  테이블로 변경. 컬럼: 발주일, 배송일, 병원명, 품목, 수량/개, 수량/박스, 매입처,
  KPIS신고. 날짜 형식 MM/DD, 행 클릭 시 주문 상세 Sheet 유지.
  - `OrderItemFlat` 타입 추가 (`types.ts`)
  - `getOrderItems()` 쿼리: order_items 기반 플랫 조인
    (orders → hospitals → products → suppliers → product_box_specs → kpis_reports)
  - 박스 수량 자동 계산 (`product_box_specs.qty_per_box` 기반)
- **파싱 로직 통합**: "AI 테스트"와 "파싱 실행" 버튼의 파싱 로직 일치화.
  기존에는 AI 비활성화 시 파싱 실행이 즉시 중단(`pending_manual`)되었으나,
  이제 regex 폴백으로 정상 처리. `aiParse()` 내부의 폴백 로직에 위임.
- **주문 생성 보강**: `parseMessageDirect`에서 order_items 생성 시
  `box_spec_id`(제품 기본 박스 스펙)와 `calculated_pieces`(개수 환산) 자동 설정
- **AI 제품 검색**: `/api/ai-product-search` API 라우트 추가
- **파서 모듈 포팅**: Edge Function의 공유 파서를 Next.js Server Action용으로
  포팅 (`parser.ts`, `ai-client.ts`). 동일한 regex/AI/매칭 로직 공유.
- **메시지 목록 개선**: 인라인 AI 테스트, 병원 선택 다이얼로그 등 UX 보강
- **품목 목록 개선**: AI 기반 제품 검색 통합

### Supabase Backend (`packages/supabase`)

- **Migration `00017`**: `increment_alias_match_counts` RPC 함수 추가
  (별칭 매칭 횟수 추적)
- **공유 파서 개선**: `_shared/parser.ts`에 few-shot 예시, 인라인 파싱,
  역순 패턴 등 파싱 정확도 향상
- **test-parse 리팩토링**: Edge Function이 공유 모듈 사용하도록 간소화

---

## v0.1.0 — 2026-02-16

Initial integrated release after monorepo restructure. Covers web dashboard,
mobile app debugging, and Supabase backend stabilization.

### Web Dashboard (`apps/web`)

- **Device sync buttons**: per-device and bulk "전체 동기화" buttons on
  `/devices` page. Sets `sync_requested_at` in Supabase, triggering mobile
  sync via Realtime subscription.
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

- **Sync retry system**: added `needsSync` flag to `CapturedMessageEntity` (Room
  migration v21→v22). Messages that fail to sync (auth not ready, network error)
  are now automatically retried on next `initialSync()`. Fixes the issue where
  captured messages only synced when the manual sync button was pressed.
- **Auto-sync fix**: removed `forceSync()` call from `NotiFlowListenerService`
  that triggered a heavy full-sync (7 tables) on every message capture. This
  blocked second and subsequent messages from syncing (SYNCING guard). Now each
  message is pushed individually via the lightweight `syncMessage()` path.
- **WorkManager auto-retry**: `SyncRetryWorker` (`@HiltWorker`) automatically
  retries failed syncs when network is available. Exponential backoff (30s→8min),
  max 5 attempts. `HiltWorkerFactory` configured in `NotiFlowApp`.
- **Web-triggered sync**: mobile subscribes to `mobile_devices` Realtime changes;
  when web dashboard sets `sync_requested_at`, device runs `syncPendingMessages()`
- **Heartbeat throttle**: `registerDevice()` called on every successful sync
  (throttled to 1-minute intervals) for accurate `last_sync_at` tracking
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

# NotiFlow Release Notes

## v0.8.0 — 2026-02-22

검색 하이라이트, 5페이지 튜토리얼, 대화방 읽음 표시, 모바일 UX 개선 및 안정성 수정.

### Mobile App (`apps/mobile`)

#### 검색 키워드 하이라이트
- **HighlightedText 컴포저블**: `AnnotatedString` + `SpanStyle` 기반 검색 매치 노란색 배경 하이라이트.
  라이트/다크 모드 자동 전환. `activeMatchIndex`로 현재 매치 강조 지원
- **4개 화면 적용**: MessageListScreen (sender/content/appName), DashboardScreen (방 이름/마지막 메시지),
  KanbanScreen (sender/content), AppChatScreen (sender/content)
- **AppChatScreen 검색바**: TopAppBar에 검색 아이콘 추가 → 검색바 + 매치 카운터(N/M) +
  이전/다음(▲/▼) 매치 이동. `animateScrollToItem`으로 매치 위치 자동 스크롤

#### 5페이지 앱 튜토리얼
- **TutorialScreen**: HorizontalPager + Lottie 애니메이션 5페이지 풀스크린 튜토리얼.
  페이지: 알림 캡처, 대시보드, 타임라인/칸반, AI 분석, 설정
- **AppPreferences**: `isTutorialSeen` 플래그 추가. 첫 실행 시 온보딩 → 튜토리얼 → 로그인 흐름
- **설정에서 재열람**: 설정 > 일반 > "튜토리얼 다시 보기" 버튼으로 언제든 재진입 가능

#### 대화방 읽음 표시
- **Room DB v25→v26**: `roomName TEXT`, `isRead INTEGER NOT NULL DEFAULT 1` 컬럼 추가
- **읽지 않은 메시지 표시**: 대시보드 채팅룸 목록에서 미읽 메시지 시각적 구분
- **자동 읽음 처리**: 대화방 진입 시 `markRoomAsRead()` DAO 쿼리로 일괄 읽음 처리

#### 대시보드 개선
- **발신자 기반 그룹핑**: `roomName` 대신 `source + sender` 기반으로 대화방 그룹화하여
  동일 발신자의 다른 룸 이름 메시지가 분산되지 않도록 수정
- **검색 프리뷰 매칭**: 검색 시 마지막 메시지 대신 검색어가 실제 포함된 메시지를 프리뷰로 표시

#### UX 개선
- **선택 모드 바 최적화**: 전체선택/삭제 버튼을 텍스트 Button → 아이콘 Surface로 교체하여
  모바일에서 잘리지 않도록 컴팩트화 (패딩 8dp→4dp, 아이콘 22dp)
- **런처 아이콘**: XML 벡터 드로어블 → WebP 래스터 이미지로 전환 (모든 밀도 지원)

#### 버그 수정
- **앱 재설치 시 크래시 수정**: `EncryptedSharedPreferences.create()` 시
  `AEADBadTagException` 발생 (Android Keystore 키 잔존 + SharedPreferences 파일 삭제 불일치).
  try-catch + `deleteSharedPreferences()` 복구 패턴 적용

---

## v0.7.0 — 2026-02-22

상용화 배포를 위한 NotiFlow 디자인 통일 및 브랜딩 리프레시.
기능 변경 없이 디자인/스타일만 수정.

### Mobile App (`apps/mobile`)

- **NotiFlow Indigo 리브랜딩**: TWS Sky Blue(`#5DADE2`) → NotiFlow Indigo(`#6366F1`) 시그니처 컬러 전환.
  Color.kt 전면 재정의 — 시그니처 5색, 라이트/다크 모드 각 8색, 시맨틱 6색,
  카테고리 10색, 글래스모피즘 8색, 채팅 앱별 색상 토큰 100+개
- **Pretendard Variable 폰트 적용**: 시스템 기본 → Pretendard Variable TTF.
  12단계 타이포그래피 스케일 재정의 (Display/Headline/Title/Body/Label)
- **Tws* → NotiFlow* 전체 리네이밍**: Color.kt, Theme.kt, GlassComponents.kt,
  ColorPicker.kt, OnboardingScreen.kt 등 전체 코드베이스 55+ 참조 일괄 변환
- **TwsTheme → NotiFlowDesign 리네이밍**: CompositionLocalProvider 기반 글래스 색상
  접근자를 `NotiFlowDesign.glassColors`로 통일. 19개 UI 파일 일괄 수정
- **AppChatStyle 색상 토큰화**: 앱별(카카오톡/텔레그램/SMS/WhatsApp/기본) 채팅 스타일의
  20+ 하드코딩 색상을 Color.kt `NotiFlowChat*` 토큰으로 이동
- **그림자 전면 제거**: 20+ `.shadow()` 호출 제거, 0.5dp 인디고 기반 테두리로 대체.
  BottomNavigation만 예외 유지
- **수동 폰트 스케일링 제거**: `labelSmall.fontSize * 0.8f/0.85f` 패턴 15곳 →
  정의된 타이포그래피 스타일(labelSmall) 그대로 사용
- **비표준 간격 정규화**: 6dp→8dp, 10dp→12dp, 14dp→16dp, 92dp→88dp (4dp 그리드 준수)
- **SplashScreen 리디자인**: 슬레이트 블루 → 인디고/바이올렛 그래디언트, NotiFlowWarning 토큰 적용
- **DESIGN.md 갱신**: NotiFlow Indigo Glassmorphism 기반으로 전면 재작성.
  색상 팔레트, Pretendard 타이포그래피, 컴포넌트 가이드, 금지사항 명시

---

## v0.3.0 — 2026-02-22

알림 상세 화면 인라인 AI 분석 기능 추가.

### Mobile App (`apps/mobile`)

- **인라인 AI 분석**: 메시지 상세 화면에서 온디바이스 Gemma 3N으로 메시지 직접 분석.
  프리셋(요약/분석/번역/자유입력) 선택 후 "AI 분석" 버튼으로 스트리밍 결과 표시.
  결과를 `[AI]` 접두사 댓글로 저장 가능.
  - `MessageViewModel`에 `AiAnalysisState` sealed class, `analyzeWithAi()`,
    `saveAnalysisAsComment()`, `clearAnalysis()` 추가
  - `MessageDetailScreen`에 `AiAnalysisSection`, `StreamingTextDisplay` 컴포저블 추가
- **500자 출력 제한**: 프롬프트 지침 + 스트리밍 UI 중단 + 최종 트리밍 3중 방어
- **댓글 저장 크래시 수정**: `saveAnalysisAsComment`의 동기적 상태 전환이 Compose
  리컴포지션 중 `ClassCastException` 유발 → 비동기 코루틴 + 안전 캐스트로 수정
- **AI 스트리밍 ANR 수정**: 토큰별 StateFlow 업데이트가 `verticalScroll` Column
  전체 리컴포지션 유발 → 30자 스로틀 + 격리 컴포저블로 리컴포지션 범위 제한

---

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

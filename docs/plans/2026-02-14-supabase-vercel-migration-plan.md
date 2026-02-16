# Supabase + Vercel Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Docker 기반 6개 서비스(PostgreSQL, NocoDB, Redis, Express, Caddy, Next.js)를 Supabase + Vercel + Kotlin 앱 구성으로 전환한다.

**Architecture:** Supabase Database(PostgreSQL) + Auth + Edge Functions + Realtime이 백엔드 전체를 담당. Next.js Dashboard는 Vercel에 배포하며 `@supabase/ssr`로 직접 DB 쿼리. Kotlin 앱은 `supabase-kt`로 메시지 INSERT + FCM으로 푸시 수신.

**Tech Stack:** Supabase (Database, Auth, Edge Functions, Realtime), Next.js 16 + Vercel, Deno (Edge Functions), FCM v1 HTTP API

**Design Doc:** `docs/plans/2026-02-14-supabase-vercel-migration-design.md`

---

## Phase 1: Supabase 프로젝트 설정 + DB 마이그레이션

### Task 1: Supabase 프로젝트 생성 및 CLI 설정

**Files:**
- Create: `supabase/config.toml` (supabase init이 자동 생성)

**Step 1: Supabase CLI 설치**

Run: `npm install -g supabase`

**Step 2: 프로젝트 디렉토리에서 Supabase 초기화**

Run: `supabase init` (프로젝트 루트에서)

Expected: `supabase/` 폴더와 `config.toml` 생성

**Step 3: Supabase 대시보드에서 프로젝트 생성**

1. https://supabase.com/dashboard 접속
2. New Project 생성 (Free 플랜)
3. Region: Northeast Asia (ap-northeast-1) 또는 가장 가까운 리전
4. Project URL, `anon key`, `service_role key` 메모

**Step 4: CLI 로그인 및 프로젝트 연결**

Run: `supabase login` 후 `supabase link --project-ref <your-project-ref>`

**Step 5: 커밋**

Run: `git add supabase/ && git commit -m "chore: initialize Supabase project structure"`

---

### Task 2: DB 스키마 마이그레이션 파일 작성

**Files:**
- Create: `supabase/migrations/00001_initial_schema.sql`

**Step 1: 기존 init-db.sql 기반 마이그레이션 SQL 작성**

현재 `scripts/init-db.sql`의 14개 테이블을 Supabase 마이그레이션 형식으로 변환.

핵심 변경점:
- `dashboard_users` 테이블 제거
- `user_profiles` 테이블 추가 (UUID PK, `auth.users` FK)
- 모든 `TIMESTAMP` 컬럼을 `TIMESTAMPTZ`로 변경
- ENUM 타입들 그대로 유지
- 기존 트리거들 (updated_at 자동 갱신) 그대로 유지

user_profiles 테이블:

```sql
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  role       VARCHAR(20) NOT NULL DEFAULT 'viewer',  -- 'admin' | 'viewer' | 'app'
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Step 2: 마이그레이션 적용 확인**

Run: `supabase db reset`
Expected: 모든 테이블 생성 성공

**Step 3: 커밋**

Run: `git add supabase/migrations/ && git commit -m "feat: add initial DB migration for Supabase"`

---

### Task 3: RLS 정책 + Auth Hook 마이그레이션

**Files:**
- Create: `supabase/migrations/00002_rls_policies.sql`

**Step 1: RLS 헬퍼 함수 + 정책 SQL 작성**

주요 내용:

```sql
-- RLS 헬퍼 함수
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

RLS 정책 요약:

| 테이블 | admin | viewer | app |
|---|---|---|---|
| hospitals, products, suppliers 등 마스터 | CRUD | SELECT | - |
| orders, order_items | CRUD | SELECT | - |
| raw_messages | CRUD | SELECT | INSERT |
| settings | CRUD | - | - |
| user_profiles | CRUD | own SELECT | - |

Auth Hook (JWT에 role 주입):

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
  user_role TEXT;
BEGIN
  claims := event->'claims';
  SELECT role INTO user_role
    FROM public.user_profiles
    WHERE id = (event->>'user_id')::UUID;
  claims := jsonb_set(claims, '{user_role}', to_jsonb(COALESCE(user_role, 'viewer')));
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Supabase 대시보드에서 Auth Hook 활성화**

Dashboard > Authentication > Hooks > "Custom access token" > `public.custom_access_token_hook`

**Step 3: 커밋**

Run: `git add supabase/migrations/00002_rls_policies.sql && git commit -m "feat: add RLS policies and auth hook"`

---

### Task 4: AI 설정용 settings 시드 데이터 + 통계 RPC 함수

**Files:**
- Create: `supabase/seed.sql`
- Create: `supabase/migrations/00003_stats_functions.sql`

**Step 1: 시드 SQL 작성**

```sql
-- supabase/seed.sql
INSERT INTO settings (key, value) VALUES
  ('ai_enabled', 'true'),
  ('ai_model', '"claude-haiku-4-5-20251001"'),
  ('ai_parse_prompt', '"당신은 혈액투석 의료용품 주문 메시지를 파싱하는 전문가입니다."'),
  ('ai_auto_process', 'true'),
  ('ai_confidence_threshold', '0.7')
ON CONFLICT (key) DO NOTHING;
```

**Step 2: 통계 RPC 함수 작성**

기존 API Gateway의 stats 라우트가 사용하던 집계 쿼리를 PostgreSQL 함수로 변환.

- `get_daily_stats(target_date DATE)` — 일일 메시지/파싱/주문 통계
- `get_calendar_stats(target_month TEXT)` — 월별 캘린더 집계
- `get_sales_report(target_period TEXT)` — 매출 리포트 집계

**Step 3: 커밋**

Run: `git add supabase/ && git commit -m "feat: add seed data and stats RPC functions"`

---

### Task 5: 초기 admin 사용자 생성

**Step 1: Supabase 대시보드 Auth 설정**

- Authentication > Providers > Email: "Confirm email" 비활성화
- Authentication > Settings: "Enable sign up" 비활성화

**Step 2: admin 사용자 생성**

Dashboard > Authentication > Users > Add user:
- Email: `admin@notiflow.local`, Password: `admin123`

**Step 3: user_profiles에 admin 프로필 INSERT**

SQL Editor:

```sql
INSERT INTO user_profiles (id, name, role, is_active)
SELECT id, '관리자', 'admin', true
FROM auth.users WHERE email = 'admin@notiflow.local';
```

**Step 4: 확인**

```sql
SELECT u.email, p.name, p.role FROM auth.users u JOIN user_profiles p ON u.id = p.id;
```

---

## Phase 2: Supabase Edge Functions

### Task 6: parse-message Edge Function

**Files:**
- Create: `supabase/functions/parse-message/index.ts`

**핵심 로직** (기존 코드 포팅):

1. `api-gateway/src/services/regexParser.js` → Deno TypeScript로 변환
2. `api-gateway/src/config/prompts.js` → `buildParsePrompt()` 함수 포팅
3. `api-gateway/src/services/productMatcher.js` → Redis 의존 제거, Supabase 직접 쿼리로 5레벨 매칭
4. `api-gateway/src/services/orderGenerator.js` → `generateOrderNumber()` 포팅

**흐름:**

```
DB Webhook (raw_messages INSERT)
  -> settings에서 AI 설정 조회
  -> ai_enabled=false? -> pending_manual
  -> Claude API 파싱 (설정된 model + prompt) + regex fallback
  -> 5레벨 품목 매칭 (hospital_alias > global_alias > contains > name > unmatched)
  -> parse_history 저장
  -> ai_auto_process=false 또는 low confidence? -> needs_review
  -> 주문 자동 생성 (orders + order_items)
```

**환경변수:**

Run: `supabase secrets set CLAUDE_API_KEY=<key>`

**로컬 테스트:**

Run: `supabase functions serve parse-message --env-file supabase/.env.local`

**커밋:**

Run: `git add supabase/functions/parse-message/ && git commit -m "feat: add parse-message edge function"`

---

### Task 7: send-push Edge Function (FCM)

**Files:**
- Create: `supabase/functions/send-push/index.ts`

**핵심 로직:**

1. DB Webhook (orders INSERT) 트리거
2. 주문 상세 조회 (hospitals join)
3. FCM v1 HTTP API로 토픽 푸시 발송
4. notification_logs에 기록

**FCM 인증:** Google Service Account JSON → OAuth2 JWT 생성 → access_token 획득
- PEM private key → `crypto.subtle.importKey('pkcs8', ...)` → RS256 서명
- 토큰 요청: `https://oauth2.googleapis.com/token`

**환경변수:**

Run: `supabase secrets set FCM_SERVICE_ACCOUNT='<json>'`

**커밋:**

Run: `git add supabase/functions/send-push/ && git commit -m "feat: add send-push edge function (FCM)"`

---

### Task 8: manage-users + test-parse Edge Functions

**Files:**
- Create: `supabase/functions/manage-users/index.ts`
- Create: `supabase/functions/test-parse/index.ts`

**manage-users:**
- JWT에서 호출자 인증 + admin role 확인
- GET: `supabase.auth.admin.listUsers()` + user_profiles JOIN
- POST: `supabase.auth.admin.createUser()` + user_profiles INSERT
- PATCH: user_profiles UPDATE + 선택적 password 변경 + 마지막 admin 보호
- DELETE: user_profiles 비활성화 + 마지막 admin 보호

**test-parse:**
- parse-message의 파싱 로직만 실행 (DB 저장 없음)
- Dashboard AI 설정 페이지의 "파싱 테스트" 버튼에서 호출

> **공통 코드 추출:** `supabase/functions/_shared/parser.ts`로 regexParse, buildParsePrompt, matchProduct 추출하여 parse-message + test-parse에서 공유

**커밋:**

Run: `git add supabase/functions/ && git commit -m "feat: add manage-users and test-parse edge functions"`

---

### Task 9: Database Webhook 설정 + Edge Functions 배포

**Step 1: Supabase 대시보드에서 Webhook 생성**

| Webhook | Table | Event | Target |
|---|---|---|---|
| on_new_message | raw_messages | INSERT | parse-message |
| on_new_order | orders | INSERT | send-push |

**Step 2: 모든 Edge Functions 배포**

```
supabase functions deploy parse-message
supabase functions deploy send-push
supabase functions deploy manage-users
supabase functions deploy test-parse
```

**Step 3: 확인**

Run: `supabase functions list`
Expected: 4개 함수 모두 Active

---

## Phase 3: Dashboard — Supabase 클라이언트 설정

### Task 10: 의존성 교체

**Files:**
- Modify: `dashboard/package.json`

**Step 1: NextAuth 제거 + Supabase 설치**

```
cd dashboard
npm uninstall next-auth @auth/core
npm install @supabase/supabase-js @supabase/ssr
```

**Step 2: 커밋**

Run: `git add package.json package-lock.json && git commit -m "chore: replace next-auth with @supabase/ssr"`

---

### Task 11: Supabase 클라이언트 유틸리티 생성

**Files:**
- Create: `dashboard/src/lib/supabase/client.ts` — 브라우저용 (`createBrowserClient`)
- Create: `dashboard/src/lib/supabase/server.ts` — 서버 컴포넌트/Server Action용 (`createServerClient` + cookies)
- Create: `dashboard/src/lib/supabase/middleware.ts` — 미들웨어용 (세션 갱신 + 인증 가드 + 비활성 사용자 체크)

**패턴:** Supabase SSR 공식 가이드 (https://supabase.com/docs/guides/auth/server-side/nextjs)

**커밋:**

Run: `git add dashboard/src/lib/supabase/ && git commit -m "feat: add Supabase client utilities"`

---

### Task 12: 미들웨어 + config 전환

**Files:**
- Modify: `dashboard/src/middleware.ts` — NextAuth export → Supabase `updateSession()` 호출
- Modify: `dashboard/next.config.ts` — `output: "standalone"` 제거 (Vercel 불필요)
- Delete: `dashboard/src/lib/auth.ts`
- Delete: `dashboard/src/types/next-auth.d.ts`

**middleware.ts 교체:**

```typescript
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**next.config.ts:**

```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

**커밋:**

Run: `git add dashboard/src/middleware.ts dashboard/next.config.ts && git rm dashboard/src/lib/auth.ts dashboard/src/types/next-auth.d.ts && git commit -m "feat: replace NextAuth with Supabase Auth middleware"`

---

## Phase 4: Dashboard — 로그인 + 사이드바 전환

### Task 13: 로그인 페이지 Supabase Auth 전환

**Files:**
- Modify: `dashboard/src/components/login-form.tsx`

변경점:
- `import { signIn } from "next-auth/react"` 제거
- `import { createClient } from "@/lib/supabase/client"` 추가
- `signIn("credentials", {...})` → `supabase.auth.signInWithPassword({ email, password })`
- `username` 필드 → `email` 필드

**커밋:**

Run: `git add dashboard/src/components/login-form.tsx && git commit -m "feat: migrate login form to Supabase Auth"`

---

### Task 14: layout.tsx + app-sidebar.tsx 전환

**Files:**
- Modify: `dashboard/src/app/layout.tsx` — `SessionProvider` 제거
- Modify: `dashboard/src/components/app-sidebar.tsx` — NextAuth → Supabase

**layout.tsx:** `SessionProvider` 래퍼 제거 (Supabase는 cookie 기반으로 Provider 불필요)

**app-sidebar.tsx 변경점:**
- `import { signOut, useSession } from "next-auth/react"` 제거
- `import { createClient } from "@/lib/supabase/client"` 추가
- `useSession()` → `supabase.auth.getUser()` + `user_profiles` 쿼리
- `signOut()` → `supabase.auth.signOut()` + `router.push("/login")`
- `Brain` 아이콘 import 추가
- navItems에 AI 설정 메뉴 추가

**커밋:**

Run: `git add dashboard/src/app/layout.tsx dashboard/src/components/app-sidebar.tsx && git commit -m "feat: migrate layout and sidebar to Supabase Auth"`

---

## Phase 5: Dashboard — 데이터 레이어 마이그레이션

### Task 15: lib/queries/ 생성 (api.ts 대체)

**Files:**
- Create: `dashboard/src/lib/queries/hospitals.ts`
- Create: `dashboard/src/lib/queries/products.ts`
- Create: `dashboard/src/lib/queries/orders.ts`
- Create: `dashboard/src/lib/queries/suppliers.ts`
- Create: `dashboard/src/lib/queries/deliveries.ts`
- Create: `dashboard/src/lib/queries/messages.ts`
- Create: `dashboard/src/lib/queries/users.ts`
- Create: `dashboard/src/lib/queries/stats.ts`
- Create: `dashboard/src/lib/queries/settings.ts`
- Delete: `dashboard/src/lib/api.ts`

**변환 패턴:**

```
기존: apiFetch('/api/v1/hospitals?search=...')
목표: supabase.from("hospitals").select("*").ilike("name", "%...%")
```

각 파일은 기존 api.ts의 함수를 1:1로 대체:
- `getHospitals()` → `supabase.from("hospitals").select("*", { count: "exact" })`
- `getOrders()` → `supabase.from("orders").select("*, hospitals(name)")` + 필터
- `getDailyStats()` → `supabase.rpc("get_daily_stats", { target_date })`
- `getCalendarStats()` → `supabase.rpc("get_calendar_stats", { target_month })`
- `getSalesReport()` → `supabase.rpc("get_sales_report", { target_period })`
- `getUsers()` → Edge Function `manage-users` GET 호출

**커밋:**

Run: `git add dashboard/src/lib/queries/ && git rm dashboard/src/lib/api.ts && git commit -m "feat: replace API client with Supabase direct queries"`

---

### Task 16: lib/actions.ts Supabase 전환

**Files:**
- Modify: `dashboard/src/lib/actions.ts`

**변경점:**
- `apiMutate()` 헬퍼 제거
- 모든 mutation → `supabase.from("table").insert/update/delete()`
- Users 관련 actions → Edge Function `manage-users` HTTP 호출
- Settings 관련: `updateSetting(key, value)` 추가
- 모든 `revalidatePath`에서 `/dashboard` prefix 유지 (실제 URL 경로)

**커밋:**

Run: `git add dashboard/src/lib/actions.ts && git commit -m "feat: migrate actions to Supabase mutations"`

---

### Task 17: types.ts 업데이트 + 모든 페이지 import 변경

**Files:**
- Modify: `dashboard/src/lib/types.ts`
- Modify: 모든 `dashboard/src/app/dashboard/*/page.tsx` (12개)

**types.ts 변경:**
- `DashboardUser.id`: `number` → `string` (UUID)
- `DashboardUser.username` → `email`

**각 페이지 import 변경:**

```typescript
// 변경 전:
import { getHospitals } from "@/lib/api";
// 변경 후:
import { getHospitals } from "@/lib/queries/hospitals";
```

모든 12개 페이지에 동일 작업 수행.

**커밋:**

Run: `git add dashboard/src/ && git commit -m "refactor: update types and page imports for Supabase"`

---

## Phase 6: Dashboard — 신규 기능

### Task 18: AI 설정 페이지

**Files:**
- Create: `dashboard/src/app/dashboard/settings/page.tsx`
- Create: `dashboard/src/components/ai-settings.tsx`

**settings/page.tsx:** 서버 컴포넌트, `getSettings()` 호출

**ai-settings.tsx:** 클라이언트 컴포넌트
- AI 활성화 (Switch)
- 모델 선택 (Select: haiku, sonnet)
- 파싱 프롬프트 (Textarea, 여러 줄)
- 자동 주문 생성 (Switch)
- 매칭 신뢰도 기준 (Input type=number, 0.0~1.0)
- 테스트 카드: 메시지 입력 Textarea + "파싱 테스트" Button → `test-parse` Edge Function 호출 → 결과 표시
- 모든 변경은 `updateSetting()` Server Action으로 저장

**커밋:**

Run: `git add dashboard/src/app/dashboard/settings/ dashboard/src/components/ai-settings.tsx && git commit -m "feat: add AI settings page"`

---

### Task 19: Realtime 구독 Hook

**Files:**
- Create: `dashboard/src/hooks/use-realtime.ts`

```typescript
// 클라이언트 컴포넌트에서 사용
// supabase.channel().on("postgres_changes", ...).subscribe()
// 변경 시 router.refresh()
```

적용 대상: `order-table.tsx`, `message-list.tsx` 등 실시간 업데이트가 필요한 클라이언트 컴포넌트

**커밋:**

Run: `git add dashboard/src/hooks/ && git commit -m "feat: add Realtime subscription hook"`

---

### Task 20: user-list.tsx Supabase 전환

**Files:**
- Modify: `dashboard/src/components/user-list.tsx`

**변경점:**
- `DashboardUser.id` → `string` (UUID)
- `username` 필드 → `email` 필드
- 생성 다이얼로그: email + password + name + role
- Server Action: Edge Function 기반 createUser/updateUser/deleteUser

**커밋:**

Run: `git add dashboard/src/components/user-list.tsx && git commit -m "refactor: update user management for Supabase Auth"`

---

## Phase 7: Vercel 배포

### Task 21: 환경변수 + 배포

**Step 1: .env.local 생성 (개발용)**

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Step 2: .gitignore 확인**

`.env.local`이 .gitignore에 포함되어 있는지 확인

**Step 3: Vercel 배포**

```
npm i -g vercel
cd dashboard
vercel
```

**Step 4: Vercel 대시보드에서 환경변수 설정**

Settings > Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Step 5: 프로덕션 배포**

Run: `vercel --prod`

**커밋:**

Run: `git add dashboard/.gitignore && git commit -m "chore: configure Vercel deployment"`

---

## Phase 8: 정리 + 검증

### Task 22: Docker 파일 아카이브

**유지 (참조용):** `docker-compose.yml`, `Caddyfile`, `api-gateway/`, `scripts/`
- 로컬 개발이나 Edge Function 이전 시 원본 참조로 보존
- 선택적으로 `archive/` 폴더로 이동

**커밋:**

Run: `git commit -m "chore: archive Docker-based architecture (reference only)"`

---

### Task 23: 통합 검증

**인증 흐름:**
- [ ] admin 계정 로그인 (Vercel URL)
- [ ] 로그아웃 > /login 리다이렉트
- [ ] 비활성 사용자 로그인 차단

**데이터 조회:**
- [ ] 대시보드 홈 (일일 통계)
- [ ] 주문 목록/상세
- [ ] 거래처/품목/공급사 목록
- [ ] 수신메시지, 캘린더, 매출리포트, KPIS

**데이터 변경:**
- [ ] 거래처/품목/공급사 CRUD
- [ ] 주문 상태 변경
- [ ] 사용자 생성/역할 변경/비활성화

**AI 기능:**
- [ ] AI 설정 변경 > 저장
- [ ] 테스트 파싱 > 결과 미리보기
- [ ] 실제 메시지 INSERT > 자동 파싱 + 주문 생성

**푸시 알림:**
- [ ] 주문 생성 > FCM 푸시 (Kotlin 앱)

**Realtime:**
- [ ] 대시보드 열어놓고 > 별도 INSERT > 자동 갱신

---

## 파일 변경 요약

| 유형 | 파일 수 | 상세 |
|---|---|---|
| **신규 생성** | ~20 | supabase/migrations(3), edge functions(4+shared), supabase clients(3), queries(9), hooks(1), settings page(2) |
| **수정** | ~15 | middleware.ts, next.config.ts, layout.tsx, login-form.tsx, app-sidebar.tsx, actions.ts, types.ts, user-list.tsx, 12개 page.tsx import |
| **삭제** | ~3 | lib/auth.ts, lib/api.ts, types/next-auth.d.ts |
| **유지 (참조)** | all | api-gateway/, docker-compose.yml, Caddyfile, scripts/ |

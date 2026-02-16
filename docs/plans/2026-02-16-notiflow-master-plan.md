# NotiFlow 마스터 프로젝트 계획서

> **프로젝트명:** NotiFlow - 의료용품 주문 알림 관리 시스템
> **버전:** v4.0 (Supabase + Vercel 아키텍처)
> **작성일:** 2026-02-16
> **상태:** 마이그레이션 완료 → 고도화 단계

---

## 1. 프로젝트 개요

### 1.1 프로젝트 목적

병원/클리닉에서 카카오톡, SMS 등으로 들어오는 의료용품 주문 메시지를 자동으로 캡처하고, AI가 파싱하여 주문서를 생성하는 **엔드투엔드 주문 관리 시스템**.

### 1.2 핵심 가치

| 가치 | 설명 |
|------|------|
| **자동화** | 수동 주문 입력 → AI 기반 자동 파싱 및 주문 생성 |
| **실시간** | 메시지 수신 → 주문 생성 → 대시보드 반영까지 실시간 |
| **지능화** | On-device AI(Gemma 3N) + Cloud AI(Claude) 이중 AI 체계 |
| **접근성** | 모바일(현장) + 웹(관리) 이원화된 접근 |

### 1.3 사용자 역할

| 역할 | 설명 | 접근 범위 |
|------|------|-----------|
| `admin` | 시스템 관리자 | 모바일 앱 + 웹 대시보드 (전체 CRUD) |
| `viewer` | 조회 전용 사용자 | 웹 대시보드 (조회만) |
| `app` | 모바일 앱 전용 | 모바일 앱 (메시지 전송만) |

---

## 2. 시스템 아키텍처

### 2.1 전체 구조도

```
┌─────────────────────────────────────────────────────────────────┐
│                        NotiFlow System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐         ┌──────────────────────────────────┐  │
│  │  Mobile App  │         │         Supabase Cloud           │  │
│  │  (Android)   │         │                                  │  │
│  │              │ ──────> │  ┌─────────┐  ┌──────────────┐  │  │
│  │ - 알림 캡처   │ INSERT  │  │ Postgres│  │ Edge Functions│  │  │
│  │ - SMS 수신    │ raw_msg │  │  DB     │  │              │  │  │
│  │ - AI 채팅     │         │  │ (15 tbl)│  │ parse-message│  │  │
│  │ - 일정 관리   │ <────── │  │         │  │ send-push    │  │  │
│  │ - 양방향 동기화│ Realtime│  │  RLS    │  │ manage-users │  │  │
│  │              │         │  │  RPC    │  │ test-parse   │  │  │
│  │  Gemma 3N    │         │  └────┬────┘  └──────┬───────┘  │  │
│  │  (On-device) │         │       │              │           │  │
│  └──────────────┘         │       │    Webhook   │           │  │
│                           │       └──────────────┘           │  │
│                           │              │                   │  │
│                           │       ┌──────┴───────┐           │  │
│                           │       │  Supabase    │           │  │
│                           │       │  Auth        │           │  │
│                           │       │  (JWT+RLS)   │           │  │
│                           │       └──────┬───────┘           │  │
│                           └──────────────┼───────────────────┘  │
│                                          │                      │
│  ┌──────────────┐                        │                      │
│  │  Web Dashboard│ ──────────────────────┘                      │
│  │  (Next.js)   │  Supabase JS SDK                              │
│  │              │  + Server Actions                              │
│  │ - 주문 관리   │  + Realtime                                   │
│  │ - 병원 관리   │                                               │
│  │ - 제품 관리   │         ┌──────────────┐                      │
│  │ - 배송 추적   │         │   Vercel     │                      │
│  │ - 리포트      │ ──────> │  (Deploy)    │                      │
│  │ - AI 설정     │         │  + Edge      │                      │
│  │ - 사용자 관리  │         │  + CDN       │                      │
│  └──────────────┘         └──────────────┘                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    External Services                      │   │
│  │  Claude API (AI 파싱)  │  FCM v1 (푸시 알림)              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 핵심 데이터 흐름

```
[1] 메시지 수신 흐름
    카카오톡/SMS 알림
    → Android NotificationListenerService 캡처
    → Room DB 로컬 저장
    → Supabase raw_messages INSERT (동기화)
    → DB Webhook → parse-message Edge Function
    → Claude AI 파싱 + 제품 매칭
    → orders + order_items 자동 생성
    → DB Webhook → send-push Edge Function
    → FCM 푸시 알림 → Android 앱 수신

[2] 대시보드 실시간 반영
    orders INSERT/UPDATE
    → Supabase Realtime
    → Web Dashboard 자동 갱신
    → 관리자 확인/수정/승인

[3] 양방향 동기화
    Mobile App ←→ Supabase ←→ Web Dashboard
    (Room DB)      (PostgreSQL)    (SWR + Realtime)
```

---

## 3. 모노레포 구조

```
notiflow/
├── package.json                    # 루트 (npm workspaces)
├── .env.example                    # 환경변수 템플릿
├── docs/                           # 문서
│   └── plans/                      # 계획서
│
├── apps/
│   ├── mobile/                     # [영역 A] Android 앱
│   │   ├── app/
│   │   │   └── src/main/
│   │   │       ├── java/com/hart/notimgmt/
│   │   │       └── res/
│   │   ├── build.gradle.kts
│   │   └── gradle/
│   │
│   └── web/                        # [영역 B] Next.js 대시보드
│       ├── src/
│       │   ├── app/                # App Router 페이지
│       │   ├── components/         # UI 컴포넌트
│       │   ├── lib/                # 유틸, 쿼리, 액션
│       │   └── hooks/              # React 훅
│       ├── package.json
│       └── next.config.ts
│
└── packages/
    └── supabase/                   # [영역 C] 백엔드
        ├── migrations/             # DB 스키마
        ├── functions/              # Edge Functions
        ├── seed.sql                # 초기 데이터
        └── config.toml             # Supabase CLI 설정
```

---

## 4. 개발 영역별 상세 계획

---

### 영역 A: 모바일 앱 (Android/Kotlin)

> **경로:** `apps/mobile/`
> **현재 버전:** v3.5.0
> **패키지:** `com.hart.notimgmt`

#### A.1 현재 완성된 기능

| 모듈 | 기능 | 상태 |
|------|------|------|
| 알림 캡처 | NotificationListenerService + SMS 수신 | ✅ 완료 |
| 필터 엔진 | 앱별/키워드별 알림 필터링 | ✅ 완료 |
| AI 채팅 | Gemma 3N (MediaPipe) On-device AI | ✅ 완료 |
| 대시보드 | 메시지 통계, 카테고리별 분류 | ✅ 완료 |
| 일정 관리 | 칸반 보드, 주간 플래너 | ✅ 완료 |
| 클라우드 동기화 | Room ↔ Supabase 양방향 | ✅ 완료 |
| 인증 | Supabase Auth (이메일/비밀번호) | ✅ 완료 |
| 백업/복원 | JSON 내보내기/가져오기 (format v7) | ✅ 완료 |
| 위젯 | 홈 화면 위젯 | ✅ 완료 |
| 테마 | TWS 글래스모피즘 + 다크모드 | ✅ 완료 |

#### A.2 향후 개발 과제

| 우선순위 | 과제 | 설명 |
|----------|------|------|
| 🔴 P0 | 푸시 알림 수신 처리 | FCM 토큰 등록 + 주문 생성 알림 수신 UI |
| 🔴 P0 | 동기화 안정성 강화 | 충돌 해결 전략 (last-write-wins → conflict resolution) |
| 🟡 P1 | 주문 상태 실시간 추적 | Supabase Realtime 구독으로 주문 상태 변경 알림 |
| 🟡 P1 | 오프라인 큐 | 네트워크 끊김 시 메시지 큐잉 + 재연결 시 일괄 전송 |
| 🟢 P2 | AI 모델 업그레이드 | Gemma 3N → 최신 모델, 메시지 분석 정확도 향상 |
| 🟢 P2 | 배송 추적 연동 | 택배사 API 연동 → 배송 상태 알림 |
| 🔵 P3 | iOS 버전 | Kotlin Multiplatform 또는 별도 Swift 앱 |

#### A.3 기술 스택 요약

```
Kotlin + Jetpack Compose + Material 3
├── DI: Hilt
├── 로컬 DB: Room (SQLite)
├── 네트워크: Ktor + OkHttp
├── AI: MediaPipe (Gemma 3N)
├── 클라우드: Supabase SDK
├── 이미지: Coil
├── 내비게이션: Jetpack Navigation Compose
└── 아키텍처: MVVM (ViewModel + StateFlow + Repository)
```

---

### 영역 B: 웹 대시보드 (Next.js + Vercel)

> **경로:** `apps/web/`
> **프레임워크:** Next.js 16 (App Router)
> **배포:** Vercel

#### B.1 현재 완성된 기능

| 페이지 | 기능 | 상태 |
|--------|------|------|
| `/login` | Supabase Auth 로그인 | ✅ 완료 |
| `/` (대시보드) | 일일 통계 + 최근 주문 + 배송 현황 | ✅ 완료 |
| `/orders` | 주문 목록/상세/생성/수정/삭제 + 필터 | ✅ 완료 |
| `/messages` | 원본 메시지 목록 + 상태 관리 | ✅ 완료 |
| `/hospitals` | 병원 CRUD | ✅ 완료 |
| `/products` | 제품 CRUD + 별칭 관리 | ✅ 완료 |
| `/suppliers` | 공급업체 CRUD | ✅ 완료 |
| `/deliveries` | 배송 추적 + 상태 변경 | ✅ 완료 |
| `/calendar` | 월별 주문 캘린더 | ✅ 완료 |
| `/reports` | 매출 리포트 + 차트 | ✅ 완료 |
| `/kpis` | KPIS 정부 보고 관리 | ✅ 완료 |
| `/settings` | AI 설정 (모델, 프롬프트, 임계값) | ✅ 완료 |
| `/users` | 사용자 관리 (admin 전용) | ✅ 완료 |

#### B.2 향후 개발 과제

| 우선순위 | 과제 | 설명 |
|----------|------|------|
| 🔴 P0 | Realtime 구독 강화 | 모든 목록 페이지에 Supabase Realtime 적용 |
| 🔴 P0 | 에러 핸들링 통합 | Server Action 에러 → toast 알림 일관성 |
| 🟡 P1 | 대시보드 고도화 | 기간별 트렌드 차트, 병원별 주문 분석 |
| 🟡 P1 | 주문서 PDF 출력 | 주문 상세 → PDF 생성 + 다운로드 |
| 🟡 P1 | 메시지 수동 파싱 UI | 자동 파싱 실패 시 수동 매칭 인터페이스 |
| 🟢 P2 | 알림 센터 | 웹 브라우저 푸시 알림 (Web Push API) |
| 🟢 P2 | 다국어 지원 | 한국어/영어 i18n |
| 🟢 P2 | 반응형 강화 | 모바일 뷰 최적화 (태블릿 대시보드 활용) |
| 🔵 P3 | 다크 모드 | 모바일 앱과 일관된 테마 |
| 🔵 P3 | PWA 지원 | 오프라인 캐시 + 설치 가능 웹앱 |

#### B.3 기술 스택 요약

```
Next.js 16 (App Router) + React 19 + TypeScript 5
├── UI: Shadcn/UI + Radix UI + Tailwind CSS v4
├── 데이터: SWR 2 + Supabase JS SDK
├── 인증: @supabase/ssr (쿠키 기반)
├── 차트: Recharts 3
├── 아이콘: Lucide React
├── 날짜: date-fns 4
├── 토스트: Sonner
└── 배포: Vercel (Edge + CDN)
```

#### B.4 페이지 구조

```
src/app/
├── layout.tsx                  # 루트 레이아웃
├── page.tsx                    # 리다이렉트
├── login/page.tsx              # 로그인 (공개)
│
└── (dashboard)/                # 인증 필요 라우트 그룹
    ├── layout.tsx              # 사이드바 + 내비게이션
    ├── page.tsx                # 대시보드 홈
    ├── orders/                 # 주문 관리
    ├── messages/               # 메시지 관리
    ├── hospitals/              # 병원 관리
    ├── products/               # 제품 관리
    ├── suppliers/              # 공급업체
    ├── deliveries/             # 배송 추적
    ├── calendar/               # 주문 캘린더
    ├── reports/                # 매출 리포트
    ├── kpis/                   # KPIS 보고
    ├── settings/               # AI 설정
    └── users/                  # 사용자 관리
```

---

### 영역 C: Supabase 백엔드

> **경로:** `packages/supabase/`
> **프로젝트 ID:** `notiflow-order-system`
> **PostgreSQL:** v17

#### C.1 데이터베이스 스키마

##### 핵심 테이블 (15개)

```
┌─────────────────────── 마스터 데이터 ────────────────────────┐
│  hospitals          병원/클리닉 정보                          │
│  products           의료용품 제품 목록                         │
│  product_aliases    병원별 제품 약어 매핑                      │
│  product_box_specs  제품별 박스 수량 규격                      │
│  suppliers          공급업체 정보                              │
│  product_suppliers  제품-공급업체 M2M (가격 포함)              │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────── 거래 데이터 ────────────────────────┐
│  raw_messages       수신 메시지 원본 (카카오톡/SMS)           │
│  orders             주문서 (draft→confirmed→processing→delivered) │
│  order_items        주문 항목 (제품, 수량, 가격)              │
│  parse_history      AI/정규식 파싱 이력                       │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────── 시스템 데이터 ────────────────────────┐
│  notification_logs  FCM 푸시 알림 발송 기록                   │
│  kpis_reports       KPIS 정부 보고 기록                      │
│  sales_reports      월별 매출 리포트                          │
│  settings           시스템 설정 (AI 모델, 프롬프트 등)         │
│  user_profiles      사용자 프로필 (auth.users 연결)           │
└──────────────────────────────────────────────────────────────┘
```

##### 주요 Enum 타입

| Enum | 값 |
|------|----|
| `order_status_enum` | draft, confirmed, processing, delivered, cancelled |
| `parse_status_enum` | pending, parsed, failed, pending_manual |
| `match_status_enum` | matched, partial, unmatched |
| `hospital_type_enum` | clinic, hospital, pharmacy, other |
| `product_category_enum` | syringe, needle, catheter, bandage, other |

##### RPC 함수

| 함수 | 용도 |
|------|------|
| `get_daily_stats(target_date)` | 일일 메시지/주문 통계 |
| `get_calendar_stats(target_month)` | 월별 일자별 통계 |
| `get_sales_report(target_period)` | 월별 매출 상세 리포트 |

##### RLS (Row Level Security)

| 역할 | 권한 |
|------|------|
| `admin` | 모든 테이블 전체 CRUD |
| `viewer` | 모든 테이블 SELECT |
| `app` | raw_messages INSERT만 |

> JWT에 `user_role` 클레임을 주입하는 `custom_access_token_hook()` 구현됨

#### C.2 Edge Functions

| 함수 | 트리거 | 역할 | 외부 서비스 |
|------|--------|------|-------------|
| `parse-message` | DB Webhook (raw_messages INSERT) | AI 메시지 파싱 → 주문 생성 | Claude API |
| `send-push` | DB Webhook (orders INSERT) | 푸시 알림 발송 | FCM v1 |
| `manage-users` | HTTP (대시보드) | 사용자 CRUD | Supabase Admin |
| `test-parse` | HTTP (대시보드) | 파싱 테스트 (DB 미기록) | Claude API |

##### 파싱 파이프라인 상세

```
raw_messages INSERT
│
├── AI 활성화 여부 확인 (settings 테이블)
│   ├── 비활성화 → status: pending_manual
│   └── 활성화 ↓
│
├── Claude API 호출 (Few-shot 프롬프트)
│   ├── 병원별 별칭 컨텍스트 포함
│   ├── 모델: 설정 가능 (기본 claude-haiku-4-5-20251001)
│   └── 실패 시 → 정규식 파서 폴백
│
├── 5단계 제품 매칭
│   ① 병원별 별칭 (product_aliases WHERE hospital_id)
│   ② 글로벌 별칭 (product_aliases WHERE hospital_id IS NULL)
│   ③ 포함 검색 (products WHERE name ILIKE)
│   ④ 이름 매칭 (products WHERE name =)
│   ⑤ 매칭 실패 → match_status: unmatched
│
├── 신뢰도 임계값 확인 (기본 0.7)
│   ├── 이상 → orders + order_items 자동 생성
│   └── 미만 → status: pending_manual
│
└── parse_history 기록
```

#### C.3 향후 개발 과제

| 우선순위 | 과제 | 설명 |
|----------|------|------|
| 🔴 P0 | DB Webhook 설정 배포 | parse-message, send-push Webhook 프로덕션 설정 |
| 🔴 P0 | Edge Function 배포 자동화 | CI/CD 파이프라인 (GitHub Actions) |
| 🟡 P1 | 배송 추적 테이블 | deliveries 테이블 + 택배사 연동 |
| 🟡 P1 | 감사 로그 (Audit Log) | 주문 상태 변경 이력 추적 |
| 🟡 P1 | 데이터 보존 정책 | raw_messages 90일 아카이빙 |
| 🟢 P2 | 알림 설정 테이블 | 사용자별 알림 선호도 |
| 🟢 P2 | 대시보드용 추가 RPC | 병원별/제품별 분석 함수 |
| 🔵 P3 | 멀티테넌트 지원 | 복수 의료용품 업체 지원 |

---

### 영역 D: Vercel 배포 & 인프라

> **대상:** `apps/web/`
> **플랫폼:** Vercel

#### D.1 현재 배포 구성

| 항목 | 설정 |
|------|------|
| 프레임워크 | Next.js (자동 감지) |
| 빌드 커맨드 | `next build` |
| 출력 디렉토리 | `.next` |
| 노드 버전 | 20.x |
| 환경변수 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

#### D.2 향후 배포 과제

| 우선순위 | 과제 | 설명 |
|----------|------|------|
| 🔴 P0 | 환경변수 관리 | Vercel Dashboard에 모든 환경변수 설정 |
| 🔴 P0 | 프리뷰 배포 | PR별 자동 프리뷰 환경 |
| 🟡 P1 | 커스텀 도메인 | 프로덕션 도메인 연결 |
| 🟡 P1 | Edge Middleware 최적화 | 인증 체크 미들웨어 성능 |
| 🟢 P2 | Analytics 연동 | Vercel Analytics + Web Vitals |
| 🟢 P2 | Cron Jobs | 일일/월별 리포트 자동 생성 |
| 🔵 P3 | Edge Config | 기능 플래그, A/B 테스트 |

---

## 5. 영역 간 연결 관계

### 5.1 의존성 매트릭스

```
              Supabase    Mobile     Web       Vercel
              (영역 C)   (영역 A)   (영역 B)   (영역 D)
Supabase       ━━━        →Auth      →Auth      ─
(영역 C)                  →Realtime  →Queries
                          →DB        →RPC
                                     →Realtime

Mobile         ←INSERT     ━━━       ─          ─
(영역 A)       ←Sync
               ←Auth

Web            ←Queries    ─          ━━━       →Deploy
(영역 B)       ←Actions                         →Edge
               ←Auth                            →CDN

Vercel         ─           ─          ←Host      ━━━
(영역 D)
```

### 5.2 공유 계약 (Shared Contracts)

| 계약 | 소스 | 소비자 | 설명 |
|------|------|--------|------|
| DB 스키마 | `packages/supabase/migrations/` | Mobile, Web | 테이블 구조, Enum, RPC |
| TypeScript 타입 | `apps/web/src/lib/types.ts` | Web | DB 테이블 → TS 인터페이스 |
| Kotlin 엔티티 | `apps/mobile/.../db/entity/` | Mobile | DB 테이블 → Room 엔티티 |
| RLS 정책 | `packages/supabase/migrations/00002` | 전체 | 역할별 접근 권한 |
| API 계약 | Edge Functions HTTP 인터페이스 | Web, Mobile | request/response 스키마 |
| 인증 토큰 | Supabase Auth JWT | 전체 | `user_role` 클레임 포함 |

### 5.3 데이터 동기화 전략

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Mobile App │     │   Supabase   │     │  Web Dashboard│
│  (Room DB)  │     │  (PostgreSQL)│     │  (SWR Cache) │
├─────────────┤     ├──────────────┤     ├──────────────┤
│             │     │              │     │              │
│  로컬 저장   │────>│  INSERT      │     │              │
│             │     │              │────>│  Realtime    │
│  Realtime   │<────│  변경 감지    │     │  구독        │
│  구독        │     │              │     │              │
│             │     │              │<────│  Server      │
│  SyncManager│<───>│  양방향 동기화 │     │  Actions     │
│  (pull/push)│     │              │     │              │
└─────────────┘     └──────────────┘     └──────────────┘

동기화 규칙:
- Mobile → Supabase: SyncManager (배치 push, 충돌 시 서버 우선)
- Supabase → Mobile: Realtime 구독 + 주기적 pull
- Web → Supabase: Server Actions (즉시 반영)
- Supabase → Web: Realtime 구독 + SWR 재검증
```

---

## 6. 개발 로드맵

### Phase 1: 안정화 ✅ 완료

> 목표: 현재 구현된 기능의 프로덕션 안정성 확보

| # | 영역 | 과제 | 산출물 | 상태 |
|---|------|------|--------|------|
| 1.1 | C | DB Webhook 프로덕션 설정 | `00004_webhooks.sql` (pg_net 트리거) | ✅ |
| 1.2 | C | Edge Function 배포 | `deploy.sh` 스크립트 | ✅ |
| 1.3 | D | Vercel 환경변수 설정 | `.env.example` 문서화 | ✅ |
| 1.4 | B | 에러 핸들링 통합 | product/hospital/supplier-list toast | ✅ |
| 1.5 | A | FCM 토큰 등록 | `NotiFlowFcmService.kt` + `00005_device_tokens.sql` | ✅ |
| 1.6 | 전체 | E2E 연동 테스트 | 배포 후 수동 검증 필요 | ⬜ |

### Phase 2: 실시간 강화 ✅ 완료 (웹)

> 목표: 모든 클라이언트에서 실시간 데이터 반영

| # | 영역 | 과제 | 산출물 | 상태 |
|---|------|------|--------|------|
| 2.1 | B | Realtime 구독 전체 적용 | `realtime-listener.tsx` + 11 pages + `00006_realtime_publication.sql` | ✅ |
| 2.2 | A | 주문 상태 실시간 추적 | 모바일 SyncManager 기존 구현 | ✅ 기존 |
| 2.3 | A | 오프라인 큐 구현 | 향후 과제 | ⬜ |
| 2.4 | A | 동기화 충돌 해결 | 향후 과제 | ⬜ |

### Phase 3: 비즈니스 기능 확장 ✅ 완료

> 목표: 실무에서 필요한 핵심 비즈니스 기능 추가

| # | 영역 | 과제 | 산출물 | 상태 |
|---|------|------|--------|------|
| 3.1 | B | 주문서 PDF 출력 | `/orders/[id]` 상세 페이지 + 인쇄/PDF | ✅ |
| 3.2 | B | 메시지 수동 파싱 UI | `ManualParseForm` + server action | ✅ |
| 3.3 | B | 대시보드 분석 고도화 | 트렌드 차트 + 거래처/제품 TOP 5 | ✅ |
| 3.4 | C | 배송 추적 테이블 + API | 기존 orders 테이블 활용 | ✅ 기존 |
| 3.5 | C | 감사 로그 | `00007_audit_logs.sql` | ✅ |
| 3.6 | C | 분석용 RPC 함수 추가 | `00008_analytics_functions.sql` | ✅ |
| 3.7 | D | Vercel Cron Jobs | `/api/cron/daily-report` + `monthly-report` | ✅ |

### Phase 4: 사용자 경험 강화 ✅ 완료 (코드 구현)

> 목표: 사용성 개선 및 접근성 확장

| # | 영역 | 과제 | 산출물 | 상태 |
|---|------|------|--------|------|
| 4.1 | B | 웹 알림 | `NotificationToggle` + `GlobalNotifications` + Service Worker | ✅ |
| 4.2 | B | 반응형 UI 강화 | `MobileNav` 하단바 + 터치 타겟 + 페이지네이션 반응형 | ✅ |
| 4.3 | B | 다크 모드 | `ThemeProvider` + `ThemeToggle` | ✅ |
| 4.4 | A | AI 모델 업그레이드 | 최신 On-device AI 모델 | ⬜ (모바일 앱 배포 후) |
| 4.5 | D | Vercel Analytics | `@vercel/analytics` + `@vercel/speed-insights` | ✅ |
| 4.6 | D | 커스텀 도메인 | Vercel Dashboard 수동 설정 | ⬜ (수동 설정) |

### Phase 5: 확장성 (향후)

> 목표: 장기적 확장 기반 구축

| # | 영역 | 과제 | 산출물 | 상태 |
|---|------|------|--------|------|
| 5.1 | B | PWA 지원 | 오프라인 캐시 + 설치 가능 | ⬜ |
| 5.2 | B | 다국어 (i18n) | 한국어/영어 | ⬜ |
| 5.3 | A | 배송 추적 연동 | 택배사 API 연동 | ⬜ |
| 5.4 | C | 멀티테넌트 | 복수 업체 지원 구조 | ⬜ |
| 5.5 | C | 데이터 보존 정책 | 아카이빙 + 정리 자동화 | ⬜ |
| 5.6 | A | iOS 버전 검토 | KMP 또는 Swift 평가 | ⬜ |

---

## 7. 환경변수 관리

### 7.1 필수 환경변수

| 변수명 | 사용처 | 설명 |
|--------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Web | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web | Supabase 익명 키 (클라이언트) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | 서비스 역할 키 (서버) |
| `ANTHROPIC_API_KEY` | Edge Functions | Claude API 키 |
| `FCM_SERVICE_ACCOUNT` | Edge Functions | Firebase 서비스 계정 JSON |

### 7.2 환경별 설정

| 환경 | Web (Vercel) | Supabase | Mobile |
|------|-------------|----------|--------|
| 개발 | `.env.local` | `supabase start` (로컬) | `BuildConfig` |
| 스테이징 | Vercel Preview | Supabase (동일) | 별도 빌드 |
| 프로덕션 | Vercel Prod | Supabase Cloud | Play Store |

---

## 8. 품질 관리

### 8.1 테스트 전략

| 영역 | 테스트 유형 | 도구 |
|------|------------|------|
| Mobile | 단위 테스트 | JUnit 5 + Mockk |
| Mobile | UI 테스트 | Compose Testing |
| Web | 단위 테스트 | Vitest |
| Web | E2E 테스트 | Playwright |
| Supabase | 통합 테스트 | pgTAP / Supabase CLI |
| 전체 | E2E 연동 | 수동 시나리오 테스트 |

### 8.2 CI/CD 파이프라인

```
GitHub Push/PR
├── apps/web 변경 감지
│   ├── lint (ESLint)
│   ├── type-check (tsc)
│   ├── test (Vitest)
│   └── Vercel 프리뷰 배포
│
├── packages/supabase 변경 감지
│   ├── migration 검증
│   ├── Edge Function 린트
│   └── Supabase 배포 (수동/자동)
│
└── apps/mobile 변경 감지
    ├── lint (ktlint)
    ├── test (JUnit)
    └── APK 빌드
```

---

## 9. 보안 체크리스트

| 항목 | 설명 | 상태 |
|------|------|------|
| RLS 활성화 | 모든 테이블 RLS ON | ✅ |
| JWT 역할 주입 | custom_access_token_hook | ✅ |
| 서비스 키 분리 | anon key ≠ service role key | ✅ |
| 환경변수 보호 | .env.local gitignored | ✅ |
| HTTPS 전용 | Vercel + Supabase 기본 제공 | ✅ |
| CORS 설정 | Supabase 프로젝트 설정 | ⬜ 확인 필요 |
| Rate Limiting | Edge Function 레벨 | ⬜ 미구현 |
| 입력 검증 | Server Actions에서 수행 | ⬜ 강화 필요 |
| 감사 로그 | 주요 액션 추적 | ⬜ 미구현 |

---

## 10. 용어 사전

| 용어 | 설명 |
|------|------|
| raw_message | 카카오톡/SMS에서 캡처된 원본 메시지 |
| parse | 메시지에서 병원명, 제품명, 수량을 추출하는 과정 |
| product_alias | 병원에서 사용하는 제품 약어 (예: "EK15" → "일회용 주사기 15ml") |
| match_status | 제품 매칭 결과 (matched/partial/unmatched) |
| order_status | 주문 진행 상태 (draft→confirmed→processing→delivered) |
| KPIS | 건강보험심사평가원 보고 시스템 |
| TWS | The White Space - 모바일 앱 디자인 시스템 |
| Edge Function | Supabase에서 실행되는 Deno 기반 서버리스 함수 |
| RLS | Row Level Security - PostgreSQL 행 수준 보안 정책 |
| RPC | Remote Procedure Call - PostgreSQL 함수를 HTTP로 호출 |

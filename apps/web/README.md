# NotiFlow 웹 대시보드

의약품 발주 관리 및 메시지 모니터링을 위한 웹 대시보드.

## 기술 스택

- **Next.js 16** (App Router)
- **shadcn/ui** + Tailwind CSS
- **Supabase** (Auth, Database, Edge Functions, Realtime)
- **Vercel** 배포

## 주요 기능

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 대시보드 | `/` | 오늘의 주문/메시지 요약, KPI 카드 |
| 스케줄 | `/calendar` | 주간 카테고리별 플랜 관리 (모바일 동기화) |
| 주문 | `/orders` | 아이템별 플랫 테이블 (발주일/배송일/병원/품목/수량/매입처/KPIS) |
| 메시지 | `/messages` | 수신 메시지 목록, AI 파싱 결과 |
| 납품 | `/deliveries` | 납품 일정 관리 |
| 병원 | `/hospitals` | 거래처(병원) 관리 |
| 품목 | `/products` | 의약품 목록, 별칭 관리 |
| 공급사 | `/suppliers` | 공급사 관리 |
| 기기 | `/devices` | 모바일 기기 관리, FCM 동기화 트리거 |
| 사용자 | `/users` | 사용자 계정 관리 |
| 설정 | `/settings` | AI 파싱 설정 |
| KPI | `/kpis` | 핵심 성과 지표 |
| 리포트 | `/reports` | 일간/월간 리포트 |

## 개발 환경

### 사전 요구사항

- Node.js 22+
- npm (monorepo workspace)

### 실행

```bash
# 루트 디렉토리에서
npm run dev:web

# 또는 apps/web 디렉토리에서
npm run dev
```

### 환경 변수

`apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 빌드

```bash
npm run build
```

## 프로젝트 구조

```
src/
├── app/
│   ├── (auth)/login/      # 인증 페이지
│   ├── (dashboard)/       # 대시보드 레이아웃 하위 페이지
│   │   ├── calendar/      # 스케줄 뷰
│   │   ├── orders/        # 주문 관리
│   │   ├── messages/      # 메시지
│   │   └── ...
│   └── api/               # API 라우트 (cron jobs)
├── components/
│   ├── ui/                # shadcn/ui 기본 컴포넌트
│   ├── schedule-view.tsx  # 주간 스케줄 뷰
│   ├── order-calendar.tsx # 월간 주문 캘린더 (레거시)
│   ├── message-list.tsx   # 메시지 목록
│   └── ...
├── lib/
│   ├── supabase/          # Supabase 클라이언트 (server/client)
│   ├── queries/           # 데이터 조회 함수
│   ├── actions.ts         # Server Actions (파싱, 주문 생성)
│   ├── parser.ts          # 주문 메시지 파서 (regex + AI)
│   ├── ai-client.ts       # AI 멀티프로바이더 클라이언트
│   ├── types.ts           # TypeScript 타입 정의
│   └── schedule-utils.ts  # 스케줄 유틸리티
└── hooks/                 # React 커스텀 훅
```

## 모바일 앱 연동

스케줄 뷰(`/calendar`)는 모바일 앱과 동일한 Supabase 테이블을 공유:

- `categories` — 카테고리 (ARGB 색상 코드)
- `plans` — 플랜 항목 (완료 상태, 주문번호, 메시지 연결)
- `day_categories` — 날짜별 카테고리 할당
- `captured_messages` — 모바일 수신 메시지

FCM 기반 동기화 트리거로 웹에서 모바일 기기에 즉시 동기화 요청 가능.

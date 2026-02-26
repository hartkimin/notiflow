# NotiFlow

의료 소모품 주문 알림 자동화 및 관리 시스템

병원/의원에서 카카오톡, 문자 등으로 수신되는 주문 메시지를 자동 캡처하고, AI로 파싱하여 주문 생성부터 배송, KPIS 신고까지 전 과정을 관리하는 통합 플랫폼입니다.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Web Dashboard** | Next.js 16 · React 19 · shadcn/ui · Tailwind CSS 4 · Recharts |
| **Mobile App** | Kotlin · Jetpack Compose · Room · Hilt · Gemma 3N (on-device AI) |
| **Backend** | Supabase (PostgreSQL + RLS + Edge Functions + Realtime) |
| **AI** | Claude API (cloud parsing) · Gemma 3N (on-device analysis) |
| **Deploy** | Vercel (web) · Google Play Store (mobile) · Supabase Cloud (backend) |

## Project Structure

```
notiflow/
├── apps/
│   ├── web/                  # Next.js 대시보드 (Vercel)
│   │   ├── src/app/          # App Router (dashboard, orders, messages, ...)
│   │   ├── src/components/   # React 컴포넌트 (shadcn/ui)
│   │   ├── src/lib/          # 쿼리, 액션, 유틸리티
│   │   └── vercel.json       # Cron 스케줄 (일간/월간 리포트)
│   └── mobile/               # Android 앱 (Kotlin/Compose)
│       ├── app/src/main/     # UI, ViewModel, Repository, Service
│       └── DESIGN.md         # Glassmorphism 디자인 시스템
├── packages/
│   └── supabase/             # 백엔드 인프라
│       ├── migrations/       # PostgreSQL 스키마 (22 migrations)
│       ├── functions/        # Edge Functions (parse, push, sync)
│       └── seed.sql          # 개발용 시드 데이터
└── docs/                     # API 문서, 설계 문서
```

## Features

### Message Processing
- Android NotificationListenerService로 카카오톡/SMS 자동 캡처
- Claude AI + regex 폴백 파싱 (신뢰도 0.7 임계값)
- 품목 자동 매칭 및 별칭(alias) 학습

### Order Management
- 주문 자동 생성 (ORD-YYYYMMDD-### 형식)
- 상태 워크플로우: draft → confirmed → processing → delivered
- 공급사 배정, 단가 관리, 주문 코멘트

### 식약처 통합 검색
- **의약품**: MFDS 의약품 허가정보 API (품목명, 보험코드, 주성분)
- **의료기기(품목)**: 의료기기 품목 허가정보 API (허가번호, 등급, 사용목적)
- **의료기기(UDI)**: 표준코드별 제품정보 API (UDI-DI, 모델명, 이식형/일회용/급여 특성, 멸균방법, 저장조건)

### Dashboard & Analytics
- 실시간 메시지 인박스 (검색, 분류, 상태 관리)
- 캘린더 뷰 (일/주/월) + 주문 예측 매칭
- 일간/월간 매출 리포트, KPIS 신고 현황

### Mobile App (Android)
- 알림 리스너로 메시지 자동 수집
- Room DB + Supabase Realtime 동기화
- Gemma 3N 온디바이스 AI 분석
- Glassmorphism UI + Pretendard 타이포그래피

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase CLI (for local development)
- Android Studio (for mobile app)

### Web Dashboard

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp apps/web/.env.example apps/web/.env.local
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 설정

# 개발 서버 시작
npm run dev:web
```

### Supabase (Local)

```bash
# Supabase 로컬 스택 시작
npm run supabase:start

# DB 초기화 (마이그레이션 + 시드)
npm run supabase:reset
```

### Mobile App

Android Studio에서 `apps/mobile/` 디렉토리를 열고 빌드합니다.

## Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `apps/web/.env.local` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web/.env.local` | Supabase anon key |
| `CLAUDE_API_KEY` | Supabase secrets | AI 파싱용 Claude API 키 |
| `FCM_CREDENTIALS` | Supabase secrets | Firebase Cloud Messaging |
| Drug API Key | Dashboard 설정 페이지 | 공공데이터포털 인증키 (DB 저장) |

## API Reference

자세한 API 문서는 [`docs/API.md`](docs/API.md)를 참조하세요.

## License

Private - All rights reserved

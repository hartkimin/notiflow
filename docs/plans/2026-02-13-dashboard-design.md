# NotiFlow Dashboard Design

**Date**: 2026-02-13
**Status**: Approved

## Problem

NocoDB는 데이터 관리 도구이지 업무 도구가 아니다. IT 지식이 없는 혈액투석 의료기기 유통 담당자가 주문/배송/매출/KPIS를 관리하려면 업무 흐름 중심의 전용 웹 대시보드가 필요하다.

## Decisions

| 항목 | 결정 |
|---|---|
| 사용 기기 | PC (데스크톱) 위주 |
| 인증 | ID/비밀번호 로그인 (NextAuth Credentials) |
| 핵심 기능 | 주문+배송+매출+KPIS+거래처 전체 |
| 범위 | 전체 기능 한번에 구현 |

## Architecture

```
[Browser] → Caddy → /dashboard/* → Next.js (port 3001)
                  → /api/*       → API Gateway (port 3000)
                  → /*           → NocoDB (admin)
```

- Next.js App Router (v15)
- API Gateway 기존 엔드포인트 그대로 활용
- Docker 컨테이너로 추가
- API_KEY는 서버사이드에서만 사용 (클라이언트 미노출)

## Tech Stack

| Role | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Tables | TanStack Table |
| Dates | date-fns |
| State | React Server Components + SWR |
| Auth | NextAuth.js (Credentials Provider) |
| Icons | Lucide React |

## Auth Flow

1. User submits ID/PW → POST /api/auth (Next.js API Route)
2. Validate against DASHBOARD_USERS env var
3. Issue JWT session cookie
4. Next.js Middleware checks cookie on /dashboard/* routes
5. Server components call API Gateway with Bearer API_KEY

## Screens

### 1. Login `/login`
- ID/PW form, error message, redirect to /dashboard

### 2. Home Dashboard `/dashboard`
- 4 stat cards: today orders, parse success rate, today deliveries, pending KPIS
- Recent orders table (5 rows)
- Today's delivery schedule

### 3. Orders `/dashboard/orders`
- Date/status/hospital filters
- Order table: order_number, hospital, items_count, total_amount, status
- Row click → slide-over detail panel with order items
- Actions: confirm, mark delivered, cancel, download PDF

### 4. Deliveries `/dashboard/deliveries`
- Today/this week delivery list
- Mark delivered button
- Calendar view (monthly)

### 5. Reports `/dashboard/reports`
- Month picker → sales table + bar chart
- CSV export button

### 6. KPIS `/dashboard/kpis`
- Pending reports table
- Overdue reports table (highlighted)
- Report action: enter reference number

### 7. Hospitals `/dashboard/hospitals`
- Searchable hospital list
- Basic info view (name, type, contact, address)

## Directory Structure

```
dashboard/
├── Dockerfile
├── package.json
├── next.config.js
├── tailwind.config.js
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── orders/page.tsx
│   │   │   ├── deliveries/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   ├── kpis/page.tsx
│   │   │   └── hospitals/page.tsx
│   │   └── api/auth/[...nextauth]/route.ts
│   ├── components/
│   │   ├── ui/           (shadcn/ui)
│   │   ├── nav.tsx
│   │   ├── stat-card.tsx
│   │   ├── order-table.tsx
│   │   ├── order-detail.tsx
│   │   ├── delivery-list.tsx
│   │   ├── sales-chart.tsx
│   │   └── kpis-table.tsx
│   └── lib/
│       ├── api.ts
│       ├── auth.ts
│       └── utils.ts
└── public/
    └── logo.svg
```

## Docker Integration

New service in docker-compose.yml:
```yaml
dashboard:
  build: ./dashboard
  container_name: notiflow-dashboard
  ports: ['3001:3000']
  environment:
    API_GATEWAY_URL: http://api-gateway:3000
    API_KEY: ${API_KEY}
    NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
    DASHBOARD_USERS: ${DASHBOARD_USERS}
  depends_on: [api-gateway]
```

Caddyfile addition:
```
handle /dashboard/* {
    reverse_proxy dashboard:3000
}
```

## API Endpoints Used

| Dashboard Screen | API Endpoint |
|---|---|
| Home stats | GET /api/v1/stats/daily |
| Home recent orders | GET /api/v1/orders?limit=5 |
| Home deliveries | GET /api/v1/deliveries/today |
| Home KPIS count | GET /api/v1/reports/kpis/pending |
| Orders list | GET /api/v1/orders?status=&from=&to=&hospital_id= |
| Order detail | GET /api/v1/orders/:id |
| Order confirm | POST /api/v1/orders/:id/confirm |
| Order status | PATCH /api/v1/orders/:id |
| Order PDF | GET /api/v1/orders/:id/pdf |
| Deliveries | GET /api/v1/deliveries/today |
| Mark delivered | PATCH /api/v1/deliveries/:orderId/delivered |
| Sales report | GET /api/v1/reports/sales?period=YYYY-MM |
| Sales CSV | GET /api/v1/reports/sales/export?period=YYYY-MM |
| KPIS pending | GET /api/v1/reports/kpis/pending |
| KPIS overdue | GET /api/v1/reports/kpis/overdue |
| KPIS report | PATCH /api/v1/reports/kpis/:id/reported |
| Hospitals | via NocoDB API (list hospitals table) |

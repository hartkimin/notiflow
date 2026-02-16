# NotiFlow Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** IT 지식이 없는 의료기기 유통 담당자가 주문/배송/매출/KPIS를 관리할 수 있는 웹 대시보드 구축

**Architecture:** Next.js 15 App Router 기반 대시보드를 Docker 컨테이너로 추가. 기존 API Gateway 엔드포인트를 서버사이드에서 호출하여 데이터를 표시. NextAuth.js로 ID/PW 로그인 처리.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Recharts, NextAuth.js, Docker

**Design Doc:** `docs/plans/2026-02-13-dashboard-design.md`

---

## Pre-requisites

- Node.js 22+, npm
- Docker & Docker Compose
- 기존 NotiFlow 서비스 실행 중 (postgres, redis, nocodb, api-gateway)

---

### Task 1: API Gateway에 hospitals 엔드포인트 추가

현재 API Gateway에 거래처 목록 조회 엔드포인트가 없음. 대시보드 거래처 페이지에 필요.

**Files:**
- Create: `api-gateway/src/routes/hospitals.js`
- Modify: `api-gateway/src/index.js:96` (라우터 등록)

**Step 1: Create hospitals route**

```js
// api-gateway/src/routes/hospitals.js
const { Router } = require('express');

function createHospitalsRouter(services = {}) {
  const { nocodbClient } = services;
  const router = Router();

  // GET /api/v1/hospitals — list hospitals
  router.get('/api/v1/hospitals', async (req, res, next) => {
    try {
      const { search, type, active } = req.query;
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;

      const filters = [];
      if (type) filters.push(`(hospital_type,eq,${type})`);
      if (active !== undefined) filters.push(`(is_active,eq,${active === 'true'})`);
      if (search) filters.push(`(name,like,%${search}%)`);

      const where = filters.length > 0 ? filters.join('~and') : undefined;
      const result = await nocodbClient.list('hospitals', { where, limit, offset, sort: 'name' });

      res.json({
        hospitals: result.list || [],
        total: result.pageInfo?.totalRows || (result.list || []).length,
        limit,
        offset,
      });
    } catch (err) { next(err); }
  });

  // GET /api/v1/hospitals/:id — single hospital
  router.get('/api/v1/hospitals/:id', async (req, res, next) => {
    try {
      const hospital = await nocodbClient.get('hospitals', req.params.id);
      res.json(hospital);
    } catch (err) { next(err); }
  });

  return router;
}

module.exports = createHospitalsRouter;
```

**Step 2: Register in index.js**

Add to `api-gateway/src/index.js` after line 12:
```js
const createHospitalsRouter = require('./routes/hospitals');
```

Add after the reports router registration (after line 114):
```js
app.use(auth, rateLimit, createHospitalsRouter({
  nocodbClient,
}));
```

**Step 3: Verify**

Run: `curl -H "Authorization: Bearer wkdgns2!@#" http://localhost:3000/api/v1/hospitals?limit=3`
Expected: JSON with hospitals array

**Step 4: Commit**

```bash
git add api-gateway/src/routes/hospitals.js api-gateway/src/index.js
git commit -m "feat(api): add hospitals list/detail endpoints for dashboard"
```

---

### Task 2: Next.js 프로젝트 스캐폴딩

**Files:**
- Create: `dashboard/` directory with Next.js project

**Step 1: Initialize Next.js project**

```bash
cd /mnt/d/Project/09_NotiFlow/notiflow-order-system
npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Accept defaults. This creates the full Next.js scaffold.

**Step 2: Install dependencies**

```bash
cd dashboard
npm install next-auth@beta @auth/core
npm install recharts date-fns swr
npm install -D @types/node
```

**Step 3: Initialize shadcn/ui**

```bash
cd /mnt/d/Project/09_NotiFlow/notiflow-order-system/dashboard
npx shadcn@latest init
```

Choose: New York style, Zinc color, CSS variables = yes.

**Step 4: Add shadcn components**

```bash
npx shadcn@latest add button card input label table badge dialog select separator sheet tabs calendar dropdown-menu avatar toast sonner
```

**Step 5: Configure next.config.ts for basePath**

Replace `dashboard/next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/dashboard",
  output: "standalone",
};

export default nextConfig;
```

**Step 6: Create .env.local**

```env
# API Gateway (internal Docker network)
API_GATEWAY_URL=http://api-gateway:3000
API_KEY=wkdgns2!@#

# NextAuth
NEXTAUTH_SECRET=notiflow-dashboard-secret-change-in-production
NEXTAUTH_URL=http://localhost/dashboard

# Dashboard users (JSON: [{"id":"admin","password":"admin123","name":"관리자"}])
DASHBOARD_USERS=[{"id":"admin","password":"admin123","name":"관리자"}]
```

**Step 7: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): scaffold Next.js 15 project with shadcn/ui"
```

---

### Task 3: API 클라이언트 라이브러리

대시보드 서버 컴포넌트에서 API Gateway를 호출하는 래퍼.

**Files:**
- Create: `dashboard/src/lib/api.ts`
- Create: `dashboard/src/lib/types.ts`

**Step 1: Create types**

```ts
// dashboard/src/lib/types.ts

export interface Hospital {
  id: number;
  name: string;
  short_name: string | null;
  hospital_type: string;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  business_number: string | null;
  payment_terms: string | null;
  lead_time_days: number;
  is_active: boolean;
}

export interface Order {
  id: number;
  order_number: string;
  order_date: string;
  hospital_id: number;
  hospital_name?: string;
  status: 'draft' | 'confirmed' | 'processing' | 'delivered' | 'cancelled';
  total_items: number;
  total_amount: number | null;
  supply_amount: number | null;
  tax_amount: number | null;
  delivery_date: string | null;
  delivered_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  notes: string | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  supplier_id: number | null;
  original_text: string | null;
  quantity: number;
  unit_type: string;
  unit_price: number | null;
  line_total: number | null;
  match_status: string;
  match_confidence: number | null;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
}

export interface DailyStats {
  date: string;
  total_messages: number;
  parse_success: number;
  orders_created: number;
  parse_success_rate: number;
}

export interface Delivery extends Order {}

export interface KpisReport {
  id: number;
  order_item_id: number;
  report_status: 'pending' | 'reported' | 'confirmed';
  reported_at: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface SalesRow {
  order_number: string;
  hospital_name: string;
  business_number: string;
  address: string;
  product_name: string;
  standard_code: string;
  supplier_name: string;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  tax_amount: number;
}

export interface SalesReport {
  period: string;
  rows: SalesRow[];
  summary: {
    total_orders: number;
    total_items: number;
    total_supply: number;
    total_tax: number;
    total_amount: number;
  };
}
```

**Step 2: Create API client**

```ts
// dashboard/src/lib/api.ts

import type {
  Hospital, Order, OrderDetail, DailyStats,
  Delivery, KpisReport, SalesReport,
} from './types';

const API_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json();
}

// --- Stats ---
export async function getDailyStats(date?: string): Promise<DailyStats> {
  const params = date ? `?date=${date}` : '';
  return apiFetch(`/api/v1/stats/daily${params}`);
}

// --- Orders ---
export async function getOrders(params: {
  status?: string; hospital_id?: number; from?: string; to?: string; limit?: number; offset?: number;
} = {}): Promise<{ orders: Order[]; total: number }> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.hospital_id) query.set('hospital_id', String(params.hospital_id));
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  query.set('limit', String(params.limit || 25));
  query.set('offset', String(params.offset || 0));
  return apiFetch(`/api/v1/orders?${query}`);
}

export async function getOrder(id: number): Promise<OrderDetail> {
  return apiFetch(`/api/v1/orders/${id}`);
}

export async function confirmOrder(id: number): Promise<{ success: boolean }> {
  return apiFetch(`/api/v1/orders/${id}/confirm`, { method: 'POST' });
}

export async function updateOrderStatus(id: number, status: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/v1/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// --- Deliveries ---
export async function getTodayDeliveries(): Promise<{ count: number; deliveries: Delivery[] }> {
  return apiFetch('/api/v1/deliveries/today');
}

export async function markDelivered(orderId: number): Promise<{ success: boolean }> {
  return apiFetch(`/api/v1/deliveries/${orderId}/delivered`, { method: 'PATCH' });
}

// --- Reports ---
export async function getSalesReport(period: string): Promise<SalesReport> {
  return apiFetch(`/api/v1/reports/sales?period=${period}`);
}

export async function getPendingKpis(): Promise<{ count: number; reports: KpisReport[] }> {
  return apiFetch('/api/v1/reports/kpis/pending');
}

export async function getOverdueKpis(days = 7): Promise<{ count: number; reports: KpisReport[] }> {
  return apiFetch(`/api/v1/reports/kpis/overdue?days=${days}`);
}

export async function markKpisReported(id: number, data: { reference_number?: string; notes?: string }): Promise<{ success: boolean }> {
  return apiFetch(`/api/v1/reports/kpis/${id}/reported`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// --- Hospitals ---
export async function getHospitals(params: {
  search?: string; type?: string; limit?: number; offset?: number;
} = {}): Promise<{ hospitals: Hospital[]; total: number }> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.type) query.set('type', params.type);
  query.set('limit', String(params.limit || 50));
  query.set('offset', String(params.offset || 0));
  return apiFetch(`/api/v1/hospitals?${query}`);
}

export async function getHospital(id: number): Promise<Hospital> {
  return apiFetch(`/api/v1/hospitals/${id}`);
}
```

**Step 3: Commit**

```bash
git add dashboard/src/lib/
git commit -m "feat(dashboard): add API client library and TypeScript types"
```

---

### Task 4: NextAuth.js 인증 설정

**Files:**
- Create: `dashboard/src/lib/auth.ts`
- Create: `dashboard/src/app/api/auth/[...nextauth]/route.ts`
- Create: `dashboard/src/middleware.ts`

**Step 1: Auth config**

```ts
// dashboard/src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

interface DashboardUser {
  id: string;
  password: string;
  name: string;
}

function getUsers(): DashboardUser[] {
  try {
    return JSON.parse(process.env.DASHBOARD_USERS || '[]');
  } catch {
    return [];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  basePath: "/dashboard/api/auth",
  providers: [
    Credentials({
      credentials: {
        username: { label: "ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const users = getUsers();
        const user = users.find(
          (u) => u.id === credentials?.username && u.password === credentials?.password
        );
        if (!user) return null;
        return { id: user.id, name: user.name };
      },
    }),
  ],
  pages: {
    signIn: "/dashboard/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
});
```

**Step 2: API route handler**

```ts
// dashboard/src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

**Step 3: Middleware for route protection**

```ts
// dashboard/src/middleware.ts
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/dashboard/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

**Step 4: Commit**

```bash
git add dashboard/src/lib/auth.ts dashboard/src/app/api/auth/ dashboard/src/middleware.ts
git commit -m "feat(dashboard): add NextAuth.js credentials authentication"
```

---

### Task 5: 루트 레이아웃 + 로그인 페이지

**Files:**
- Modify: `dashboard/src/app/layout.tsx`
- Create: `dashboard/src/app/login/page.tsx`
- Create: `dashboard/src/components/login-form.tsx`

**Step 1: Root layout**

```tsx
// dashboard/src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NotiFlow - 주문관리 대시보드",
  description: "혈액투석 의료기기 발주관리 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

**Step 2: Login form (client component)**

```tsx
// dashboard/src/components/login-form.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">NotiFlow</CardTitle>
        <p className="text-sm text-muted-foreground">주문관리 대시보드</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">아이디</Label>
            <Input id="username" name="username" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Login page**

```tsx
// dashboard/src/app/login/page.tsx
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <LoginForm />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add dashboard/src/app/layout.tsx dashboard/src/app/login/ dashboard/src/components/login-form.tsx
git commit -m "feat(dashboard): add login page with NextAuth credentials"
```

---

### Task 6: 대시보드 레이아웃 + 네비게이션

**Files:**
- Create: `dashboard/src/app/dashboard/layout.tsx`
- Create: `dashboard/src/components/nav.tsx`
- Create: `dashboard/src/components/user-menu.tsx`

**Step 1: Navigation component**

```tsx
// dashboard/src/components/nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ClipboardList, Truck,
  BarChart3, Shield, Building2,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "홈", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "주문관리", icon: ClipboardList },
  { href: "/dashboard/deliveries", label: "배송현황", icon: Truck },
  { href: "/dashboard/reports", label: "매출리포트", icon: BarChart3 },
  { href: "/dashboard/kpis", label: "KPIS신고", icon: Shield },
  { href: "/dashboard/hospitals", label: "거래처", icon: Building2 },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

**Step 2: User menu**

```tsx
// dashboard/src/components/user-menu.tsx
"use client";

import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function UserMenu() {
  const { data: session } = useSession();

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {session?.user?.name || "사용자"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/dashboard/login" })}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

**Step 3: Dashboard layout with SessionProvider**

```tsx
// dashboard/src/app/dashboard/layout.tsx
import { SessionProvider } from "next-auth/react";
import { Nav } from "@/components/nav";
import { UserMenu } from "@/components/user-menu";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/dashboard/api/auth">
      <div className="min-h-screen bg-muted/40">
        <header className="sticky top-0 z-50 border-b bg-background">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <div className="flex items-center gap-6">
              <span className="text-lg font-bold">NotiFlow</span>
              <Nav />
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
```

**Step 4: Commit**

```bash
git add dashboard/src/app/dashboard/layout.tsx dashboard/src/components/nav.tsx dashboard/src/components/user-menu.tsx
git commit -m "feat(dashboard): add navigation layout with user menu"
```

---

### Task 7: 홈 대시보드 페이지

**Files:**
- Create: `dashboard/src/app/dashboard/page.tsx`
- Create: `dashboard/src/components/stat-card.tsx`

**Step 1: Stat card component**

```tsx
// dashboard/src/components/stat-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
}

export function StatCard({ title, value, description, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Home dashboard page (server component)**

```tsx
// dashboard/src/app/dashboard/page.tsx
import { ClipboardList, CheckCircle, Truck, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { getDailyStats, getOrders, getTodayDeliveries, getPendingKpis } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  draft: "임시",
  confirmed: "확인됨",
  processing: "처리중",
  delivered: "배송완료",
  cancelled: "취소",
};

export default async function DashboardHome() {
  const [stats, ordersRes, deliveriesRes, kpisRes] = await Promise.all([
    getDailyStats(),
    getOrders({ limit: 5 }),
    getTodayDeliveries(),
    getPendingKpis(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="오늘 주문"
          value={`${stats.orders_created}건`}
          description={`메시지 ${stats.total_messages}건 수신`}
          icon={ClipboardList}
        />
        <StatCard
          title="파싱 성공률"
          value={`${stats.parse_success_rate}%`}
          description={`${stats.parse_success}/${stats.total_messages}건 성공`}
          icon={CheckCircle}
        />
        <StatCard
          title="오늘 배송"
          value={`${deliveriesRes.count}건`}
          description="배송 예정"
          icon={Truck}
        />
        <StatCard
          title="KPIS 미신고"
          value={`${kpisRes.count}건`}
          description="신고 대기중"
          icon={Shield}
        />
      </div>

      {/* Recent orders + Today deliveries */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 주문</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersRes.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">주문이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {ordersRes.orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.order_date} | {order.total_items}품목
                      </p>
                    </div>
                    <Badge variant={order.status === "draft" ? "secondary" : "default"}>
                      {STATUS_LABELS[order.status] || order.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">오늘 배송 예정</CardTitle>
          </CardHeader>
          <CardContent>
            {deliveriesRes.deliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">오늘 배송 예정이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {deliveriesRes.deliveries.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{d.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.total_items}품목
                      </p>
                    </div>
                    <Badge variant="outline">배송예정</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add dashboard/src/app/dashboard/page.tsx dashboard/src/components/stat-card.tsx
git commit -m "feat(dashboard): add home page with stats and recent orders"
```

---

### Task 8: 주문관리 페이지

**Files:**
- Create: `dashboard/src/app/dashboard/orders/page.tsx`
- Create: `dashboard/src/components/order-table.tsx`
- Create: `dashboard/src/components/order-detail.tsx`
- Create: `dashboard/src/components/order-filters.tsx`
- Create: `dashboard/src/app/dashboard/orders/actions.ts`

**Step 1: Server actions for order mutations**

```ts
// dashboard/src/app/dashboard/orders/actions.ts
"use server";

import { confirmOrder, updateOrderStatus } from "@/lib/api";
import { revalidatePath } from "next/cache";

export async function confirmOrderAction(orderId: number) {
  await confirmOrder(orderId);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
}

export async function updateOrderStatusAction(orderId: number, status: string) {
  await updateOrderStatus(orderId, status);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
}
```

**Step 2: Order filters (client component)**

```tsx
// dashboard/src/components/order-filters.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function OrderFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const from = fd.get("from") as string;
    const to = fd.get("to") as string;
    const status = fd.get("status") as string;
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status && status !== "all") params.set("status", status);
    router.push(`/dashboard/orders?${params}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="text-xs text-muted-foreground">시작일</label>
        <Input type="date" name="from" defaultValue={searchParams.get("from") || ""} className="w-40" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">종료일</label>
        <Input type="date" name="to" defaultValue={searchParams.get("to") || ""} className="w-40" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">상태</label>
        <Select name="status" defaultValue={searchParams.get("status") || "all"}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="draft">임시</SelectItem>
            <SelectItem value="confirmed">확인됨</SelectItem>
            <SelectItem value="processing">처리중</SelectItem>
            <SelectItem value="delivered">배송완료</SelectItem>
            <SelectItem value="cancelled">취소</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" size="sm">검색</Button>
    </form>
  );
}
```

**Step 3: Order table (client component with actions)**

```tsx
// dashboard/src/components/order-table.tsx
"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OrderDetail } from "@/components/order-detail";
import type { Order } from "@/lib/types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  confirmed: "default",
  processing: "default",
  delivered: "outline",
  cancelled: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "임시",
  confirmed: "확인됨",
  processing: "처리중",
  delivered: "배송완료",
  cancelled: "취소",
};

function formatAmount(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

export function OrderTable({ orders }: { orders: Order[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>주문번호</TableHead>
            <TableHead>주문일</TableHead>
            <TableHead>품목수</TableHead>
            <TableHead className="text-right">금액</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>배송일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                주문이 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow
                key={order.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedId(order.id)}
              >
                <TableCell className="font-medium">{order.order_number}</TableCell>
                <TableCell>{order.order_date}</TableCell>
                <TableCell>{order.total_items}</TableCell>
                <TableCell className="text-right">{formatAmount(order.total_amount)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[order.status] || "secondary"}>
                    {STATUS_LABEL[order.status] || order.status}
                  </Badge>
                </TableCell>
                <TableCell>{order.delivery_date || "-"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Sheet open={selectedId !== null} onOpenChange={() => setSelectedId(null)}>
        <SheetContent className="w-[480px] sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>주문 상세</SheetTitle>
          </SheetHeader>
          {selectedId && <OrderDetail orderId={selectedId} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
```

**Step 4: Order detail panel (client component with SWR)**

```tsx
// dashboard/src/components/order-detail.tsx
"use client";

import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { confirmOrderAction, updateOrderStatusAction } from "@/app/dashboard/orders/actions";
import { toast } from "sonner";
import type { OrderDetail as OrderDetailType } from "@/lib/types";

async function fetchOrderDetail(url: string): Promise<OrderDetailType> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export function OrderDetail({ orderId }: { orderId: number }) {
  const { data: order, error, isLoading } = useSWR(
    `/dashboard/api/orders/${orderId}`,
    fetchOrderDetail
  );

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">로딩 중...</p>;
  if (error || !order) return <p className="p-4 text-sm text-destructive">주문 정보를 불러올 수 없습니다.</p>;

  async function handleConfirm() {
    try {
      await confirmOrderAction(orderId);
      toast.success("주문이 확인되었습니다.");
    } catch {
      toast.error("주문 확인에 실패했습니다.");
    }
  }

  async function handleCancel() {
    try {
      await updateOrderStatusAction(orderId, "cancelled");
      toast.success("주문이 취소되었습니다.");
    } catch {
      toast.error("주문 취소에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">주문번호</span>
          <p className="font-medium">{order.order_number}</p>
        </div>
        <div>
          <span className="text-muted-foreground">주문일</span>
          <p>{order.order_date}</p>
        </div>
        <div>
          <span className="text-muted-foreground">상태</span>
          <p><Badge>{order.status}</Badge></p>
        </div>
        <div>
          <span className="text-muted-foreground">배송예정</span>
          <p>{order.delivery_date || "-"}</p>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="mb-2 text-sm font-medium">주문 품목 ({order.items.length}건)</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>원본텍스트</TableHead>
              <TableHead>수량</TableHead>
              <TableHead className="text-right">단가</TableHead>
              <TableHead className="text-right">합계</TableHead>
              <TableHead>매칭</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-xs">{item.original_text || "-"}</TableCell>
                <TableCell>{item.quantity} {item.unit_type}</TableCell>
                <TableCell className="text-right">
                  {item.unit_price?.toLocaleString("ko-KR") || "-"}
                </TableCell>
                <TableCell className="text-right">
                  {item.line_total?.toLocaleString("ko-KR") || "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={item.match_status === "matched" ? "default" : "destructive"} className="text-xs">
                    {item.match_status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Separator />

      <div className="flex gap-2">
        {order.status === "draft" && (
          <Button size="sm" onClick={handleConfirm}>주문 확인</Button>
        )}
        {order.status === "draft" && (
          <Button size="sm" variant="destructive" onClick={handleCancel}>취소</Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <a href={`/api/v1/orders/${orderId}/pdf`} target="_blank" rel="noreferrer">PDF</a>
        </Button>
      </div>
    </div>
  );
}
```

**Step 5: Orders API route (proxy for client-side SWR)**

```ts
// dashboard/src/app/api/orders/[id]/route.ts
import { getOrder } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await getOrder(Number(id));
  return NextResponse.json(order);
}
```

**Step 6: Orders page (server component)**

```tsx
// dashboard/src/app/dashboard/orders/page.tsx
import { getOrders } from "@/lib/api";
import { OrderTable } from "@/components/order-table";
import { OrderFilters } from "@/components/order-filters";

interface Props {
  searchParams: Promise<{ status?: string; from?: string; to?: string; page?: string }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const result = await getOrders({
    status: params.status,
    from: params.from,
    to: params.to,
    limit,
    offset,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">주문관리</h1>
      <OrderFilters />
      <OrderTable orders={result.orders} />
      <p className="text-sm text-muted-foreground">
        전체 {result.total}건 | 페이지 {page}/{Math.max(1, Math.ceil(result.total / limit))}
      </p>
    </div>
  );
}
```

**Step 7: Commit**

```bash
git add dashboard/src/app/dashboard/orders/ dashboard/src/components/order-*.tsx dashboard/src/app/api/orders/
git commit -m "feat(dashboard): add orders page with filters, table, and detail panel"
```

---

### Task 9: 배송현황 페이지

**Files:**
- Create: `dashboard/src/app/dashboard/deliveries/page.tsx`
- Create: `dashboard/src/app/dashboard/deliveries/actions.ts`
- Create: `dashboard/src/components/delivery-list.tsx`

**Step 1: Server actions**

```ts
// dashboard/src/app/dashboard/deliveries/actions.ts
"use server";

import { markDelivered } from "@/lib/api";
import { revalidatePath } from "next/cache";

export async function markDeliveredAction(orderId: number) {
  await markDelivered(orderId);
  revalidatePath("/dashboard/deliveries");
  revalidatePath("/dashboard");
}
```

**Step 2: Delivery list component**

```tsx
// dashboard/src/components/delivery-list.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { markDeliveredAction } from "@/app/dashboard/deliveries/actions";
import { toast } from "sonner";
import type { Delivery } from "@/lib/types";

export function DeliveryList({ deliveries }: { deliveries: Delivery[] }) {
  async function handleDeliver(orderId: number) {
    try {
      await markDeliveredAction(orderId);
      toast.success("배송완료 처리되었습니다.");
    } catch {
      toast.error("처리에 실패했습니다.");
    }
  }

  if (deliveries.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">오늘 배송 예정이 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      {deliveries.map((d) => (
        <Card key={d.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{d.order_number}</p>
              <p className="text-sm text-muted-foreground">
                {d.total_items}품목 | 배송일: {d.delivery_date}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{d.status}</Badge>
              <Button size="sm" onClick={() => handleDeliver(d.id)}>
                배송완료
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 3: Deliveries page**

```tsx
// dashboard/src/app/dashboard/deliveries/page.tsx
import { getTodayDeliveries } from "@/lib/api";
import { DeliveryList } from "@/components/delivery-list";
import { Truck } from "lucide-react";

export default async function DeliveriesPage() {
  const result = await getTodayDeliveries();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Truck className="h-6 w-6" />
        <h1 className="text-2xl font-bold">배송현황</h1>
        <Badge variant="secondary" className="ml-2">{result.count}건</Badge>
      </div>
      <DeliveryList deliveries={result.deliveries} />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add dashboard/src/app/dashboard/deliveries/ dashboard/src/components/delivery-list.tsx
git commit -m "feat(dashboard): add deliveries page with mark-delivered action"
```

---

### Task 10: 매출리포트 페이지

**Files:**
- Create: `dashboard/src/app/dashboard/reports/page.tsx`
- Create: `dashboard/src/components/sales-chart.tsx`
- Create: `dashboard/src/components/report-filters.tsx`

**Step 1: Report filters**

```tsx
// dashboard/src/components/report-filters.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ReportFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const period = fd.get("period") as string;
    router.push(`/dashboard/reports?period=${period}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div>
        <label className="text-xs text-muted-foreground">기간 (YYYY-MM)</label>
        <Input
          type="month"
          name="period"
          defaultValue={searchParams.get("period") || defaultPeriod}
          className="w-44"
        />
      </div>
      <Button type="submit" size="sm">조회</Button>
      <Button type="button" size="sm" variant="outline" asChild>
        <a href={`/api/v1/reports/sales/export?period=${searchParams.get("period") || defaultPeriod}`} download>
          CSV 내보내기
        </a>
      </Button>
    </form>
  );
}
```

**Step 2: Sales chart**

```tsx
// dashboard/src/components/sales-chart.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SalesRow } from "@/lib/types";

export function SalesChart({ rows }: { rows: SalesRow[] }) {
  // Aggregate by hospital
  const byHospital: Record<string, number> = {};
  for (const row of rows) {
    const key = row.hospital_name || "기타";
    byHospital[key] = (byHospital[key] || 0) + row.supply_amount;
  }

  const data = Object.entries(byHospital)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
        <Tooltip formatter={(value: number) => `${value.toLocaleString("ko-KR")}원`} />
        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**Step 3: Reports page**

```tsx
// dashboard/src/app/dashboard/reports/page.tsx
import { getSalesReport } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportFilters } from "@/components/report-filters";
import { SalesChart } from "@/components/sales-chart";

interface Props {
  searchParams: Promise<{ period?: string }>;
}

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  const now = new Date();
  const period = params.period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let report;
  try {
    report = await getSalesReport(period);
  } catch {
    report = null;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">매출 리포트</h1>
      <ReportFilters />

      {report ? (
        <>
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">주문 수</p>
                <p className="text-2xl font-bold">{report.summary.total_orders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">품목 수</p>
                <p className="text-2xl font-bold">{report.summary.total_items}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">공급가액</p>
                <p className="text-2xl font-bold">{report.summary.total_supply.toLocaleString("ko-KR")}원</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">합계</p>
                <p className="text-2xl font-bold">{report.summary.total_amount.toLocaleString("ko-KR")}원</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">거래처별 매출</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesChart rows={report.rows} />
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>주문번호</TableHead>
                    <TableHead>매출처</TableHead>
                    <TableHead>품목</TableHead>
                    <TableHead>수량</TableHead>
                    <TableHead className="text-right">공급가액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.order_number}</TableCell>
                      <TableCell>{row.hospital_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.product_name}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell className="text-right">{row.supply_amount.toLocaleString("ko-KR")}원</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">해당 기간의 매출 데이터가 없습니다.</p>
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add dashboard/src/app/dashboard/reports/ dashboard/src/components/sales-chart.tsx dashboard/src/components/report-filters.tsx
git commit -m "feat(dashboard): add sales report page with chart and CSV export"
```

---

### Task 11: KPIS 신고 페이지

**Files:**
- Create: `dashboard/src/app/dashboard/kpis/page.tsx`
- Create: `dashboard/src/app/dashboard/kpis/actions.ts`
- Create: `dashboard/src/components/kpis-table.tsx`

**Step 1: Server actions**

```ts
// dashboard/src/app/dashboard/kpis/actions.ts
"use server";

import { markKpisReported } from "@/lib/api";
import { revalidatePath } from "next/cache";

export async function markReportedAction(id: number, referenceNumber: string) {
  await markKpisReported(id, { reference_number: referenceNumber });
  revalidatePath("/dashboard/kpis");
  revalidatePath("/dashboard");
}
```

**Step 2: KPIS table**

```tsx
// dashboard/src/components/kpis-table.tsx
"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { markReportedAction } from "@/app/dashboard/kpis/actions";
import { toast } from "sonner";
import type { KpisReport } from "@/lib/types";

export function KpisTable({ reports, title }: { reports: KpisReport[]; title: string }) {
  const [dialogId, setDialogId] = useState<number | null>(null);
  const [refNum, setRefNum] = useState("");

  async function handleSubmit() {
    if (!dialogId) return;
    try {
      await markReportedAction(dialogId, refNum);
      toast.success("신고 처리되었습니다.");
      setDialogId(null);
      setRefNum("");
    } catch {
      toast.error("신고 처리에 실패했습니다.");
    }
  }

  return (
    <>
      <h3 className="text-base font-medium mb-2">{title} ({reports.length}건)</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>주문품목 ID</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>생성일</TableHead>
            <TableHead>참조번호</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">항목이 없습니다.</TableCell>
            </TableRow>
          ) : (
            reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.order_item_id}</TableCell>
                <TableCell>
                  <Badge variant={r.report_status === "pending" ? "secondary" : "default"}>
                    {r.report_status === "pending" ? "대기" : "완료"}
                  </Badge>
                </TableCell>
                <TableCell>{r.created_at?.slice(0, 10)}</TableCell>
                <TableCell>{r.reference_number || "-"}</TableCell>
                <TableCell>
                  {r.report_status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => setDialogId(r.id)}>
                      신고처리
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogId !== null} onOpenChange={() => setDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>KPIS 신고 처리</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm">참조번호</label>
            <Input
              value={refNum}
              onChange={(e) => setRefNum(e.target.value)}
              placeholder="KPIS 신고 참조번호 입력"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogId(null)}>취소</Button>
            <Button onClick={handleSubmit}>신고완료</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Step 3: KPIS page**

```tsx
// dashboard/src/app/dashboard/kpis/page.tsx
import { getPendingKpis, getOverdueKpis } from "@/lib/api";
import { KpisTable } from "@/components/kpis-table";
import { Card, CardContent } from "@/components/ui/card";

export default async function KpisPage() {
  const [pending, overdue] = await Promise.all([
    getPendingKpis(),
    getOverdueKpis(7),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">KPIS 유통추적 신고</h1>

      {overdue.count > 0 && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <KpisTable reports={overdue.reports} title="연체 항목 (7일 초과)" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <KpisTable reports={pending.reports} title="미신고 항목" />
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add dashboard/src/app/dashboard/kpis/ dashboard/src/components/kpis-table.tsx
git commit -m "feat(dashboard): add KPIS reporting page with reference number dialog"
```

---

### Task 12: 거래처 페이지

**Files:**
- Create: `dashboard/src/app/dashboard/hospitals/page.tsx`
- Create: `dashboard/src/components/hospital-list.tsx`

**Step 1: Hospital list component**

```tsx
// dashboard/src/components/hospital-list.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Hospital } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  hospital: "병원",
  clinic: "의원",
  pharmacy: "약국",
  distributor: "유통사",
  research: "연구소",
  other: "기타",
};

export function HospitalSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const search = fd.get("search") as string;
    router.push(search ? `/dashboard/hospitals?search=${encodeURIComponent(search)}` : "/dashboard/hospitals");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        name="search"
        placeholder="거래처 검색..."
        defaultValue={searchParams.get("search") || ""}
        className="max-w-sm"
      />
      <Button type="submit" size="sm">검색</Button>
    </form>
  );
}

export function HospitalCards({ hospitals }: { hospitals: Hospital[] }) {
  if (hospitals.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">거래처가 없습니다.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {hospitals.map((h) => (
        <Card key={h.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{h.name}</h3>
              <Badge variant="outline">{TYPE_LABEL[h.hospital_type] || h.hospital_type}</Badge>
            </div>
            {h.phone && <p className="text-sm text-muted-foreground">{h.phone}</p>}
            {h.address && <p className="text-xs text-muted-foreground">{h.address}</p>}
            {h.contact_person && (
              <p className="text-xs text-muted-foreground">담당: {h.contact_person}</p>
            )}
            {h.payment_terms && (
              <p className="text-xs text-muted-foreground">결제: {h.payment_terms}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 2: Hospitals page**

```tsx
// dashboard/src/app/dashboard/hospitals/page.tsx
import { getHospitals } from "@/lib/api";
import { HospitalSearch, HospitalCards } from "@/components/hospital-list";

interface Props {
  searchParams: Promise<{ search?: string }>;
}

export default async function HospitalsPage({ searchParams }: Props) {
  const params = await searchParams;
  const result = await getHospitals({
    search: params.search,
    limit: 50,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">거래처 관리</h1>
      <HospitalSearch />
      <HospitalCards hospitals={result.hospitals} />
      <p className="text-sm text-muted-foreground">전체 {result.total}건</p>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add dashboard/src/app/dashboard/hospitals/ dashboard/src/components/hospital-list.tsx
git commit -m "feat(dashboard): add hospitals page with search and card view"
```

---

### Task 13: Docker 통합

**Files:**
- Create: `dashboard/Dockerfile`
- Create: `dashboard/.dockerignore`
- Modify: `docker-compose.yml` (dashboard 서비스 추가)
- Modify: `Caddyfile` (/dashboard 라우트 추가)
- Modify: `.env.example` (if exists, add new vars)

**Step 1: Create Dockerfile**

```dockerfile
# dashboard/Dockerfile
FROM node:22-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

**Step 2: Create .dockerignore**

```
# dashboard/.dockerignore
node_modules
.next
.env.local
```

**Step 3: Add dashboard service to docker-compose.yml**

Add before `caddy:` service and after `api-gateway:` service:

```yaml
  dashboard:
    build:
      context: ./dashboard
      dockerfile: Dockerfile
    container_name: notiflow-dashboard
    restart: unless-stopped
    ports:
      - '3001:3000'
    environment:
      API_GATEWAY_URL: http://api-gateway:3000
      API_KEY: ${API_KEY}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:-notiflow-dashboard-secret}
      NEXTAUTH_URL: ${DASHBOARD_URL:-http://localhost/dashboard}
      DASHBOARD_USERS: ${DASHBOARD_USERS:-[{"id":"admin","password":"admin123","name":"관리자"}]}
    depends_on:
      - api-gateway
```

Add `dashboard` to caddy's depends_on:

```yaml
  caddy:
    depends_on:
      - api-gateway
      - nocodb
      - dashboard
```

**Step 4: Update Caddyfile**

Add `/dashboard*` route BEFORE the NocoDB catch-all handler:

```
{$DOMAIN:localhost} {
	handle /api/* {
		reverse_proxy api-gateway:3000
	}

	handle /dashboard/* {
		reverse_proxy dashboard:3000
	}

	handle /nocodb/* {
		uri strip_prefix /nocodb
		reverse_proxy nocodb:8080
	}

	handle {
		reverse_proxy nocodb:8080
	}
}
```

**Step 5: Add env vars to .env.example (if it exists) or note them**

New environment variables needed in root `.env`:
```
NEXTAUTH_SECRET=change-me-in-production
DASHBOARD_URL=http://localhost/dashboard
DASHBOARD_USERS=[{"id":"admin","password":"admin123","name":"관리자"}]
```

**Step 6: Commit**

```bash
git add dashboard/Dockerfile dashboard/.dockerignore docker-compose.yml Caddyfile
git commit -m "feat(docker): add dashboard container and Caddy routing"
```

---

### Task 14: 통합 테스트 및 검증

**Step 1: Build and start all services**

```bash
cd /mnt/d/Project/09_NotiFlow/notiflow-order-system
docker compose build dashboard
docker compose up -d
```

**Step 2: Verify dashboard is accessible**

```bash
curl -s http://localhost:3001/dashboard/login | head -20
```
Expected: HTML containing "NotiFlow" login page

**Step 3: Verify Caddy routing**

```bash
curl -s http://localhost/dashboard/login | head -20
```
Expected: Same HTML via Caddy proxy

**Step 4: Verify API proxy works from dashboard**

```bash
curl -s -H "Authorization: Bearer wkdgns2!@#" http://localhost:3000/api/v1/hospitals?limit=2
```
Expected: JSON with hospitals

**Step 5: Manual browser test checklist**

- [ ] Open http://localhost/dashboard/login → Login form visible
- [ ] Login with admin/admin123 → Redirected to /dashboard
- [ ] Home shows 4 stat cards
- [ ] Navigate to 주문관리 → Order list with filters
- [ ] Click order row → Side panel with details
- [ ] Navigate to 배송현황 → Today's deliveries
- [ ] Navigate to 매출리포트 → Month picker, table, chart
- [ ] Navigate to KPIS신고 → Pending/overdue tables
- [ ] Navigate to 거래처 → Search and card view
- [ ] Logout → Redirected to login

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(dashboard): complete NotiFlow web dashboard v1.0"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | API: hospitals endpoint | 2 files |
| 2 | Next.js scaffold + deps | project init |
| 3 | API client + types | 2 files |
| 4 | NextAuth authentication | 3 files |
| 5 | Root layout + login | 3 files |
| 6 | Dashboard layout + nav | 3 files |
| 7 | Home dashboard | 2 files |
| 8 | Orders page | 6 files |
| 9 | Deliveries page | 3 files |
| 10 | Reports page | 3 files |
| 11 | KPIS page | 3 files |
| 12 | Hospitals page | 2 files |
| 13 | Docker integration | 4 files |
| 14 | Integration test | verification |

**Total: ~35 files, 14 tasks**

# 모바일 웹 최적화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NotiFlow 웹 대시보드를 모바일에서 네이티브 앱처럼 사용할 수 있도록 주문 관리 중심 모바일 UX를 구현한다.

**Architecture:** 기존 반응형 분기(md 브레이크포인트)를 활용하여 모바일/데스크톱 UI를 한 코드베이스에서 분기한다. 모바일에서는 카드형 주문 목록, 하단 4탭 네비게이션, 고정 액션 바, 풀투리프레시, 스와이프 제스처를 제공하고 데스크톱은 현재 상태를 유지한다.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-27-mobile-web-optimization-design.md`

---

## File Structure

| 파일 | 유형 | 역할 |
|------|------|------|
| `apps/web/src/app/layout.tsx` | 수정 | Viewport export 추가 |
| `apps/web/src/app/globals.css` | 수정 | Safe area 유틸리티, 풀투리프레시 애니메이션 |
| `apps/web/src/components/mobile-nav.tsx` | 수정 | 3탭→4탭 + 더보기 Sheet + safe area |
| `apps/web/src/components/nav.tsx` | 수정 | 모바일 햄버거 메뉴 제거 |
| `apps/web/src/components/order-card-list.tsx` | 신규 | 모바일 주문 카드 리스트 + 스와이프 |
| `apps/web/src/components/order-table.tsx` | 수정 | 모바일 카드형 분기 추가 |
| `apps/web/src/components/order-detail-client.tsx` | 수정 | 모바일 하단 고정 액션 바 |
| `apps/web/src/hooks/use-pull-to-refresh.ts` | 신규 | 풀투리프레시 커스텀 훅 |
| `apps/web/src/components/pwa-install-banner.tsx` | 신규 | PWA 설치 유도 배너 |
| `apps/web/public/manifest.json` | 수정 | 아이콘 사이즈 추가 |
| `apps/web/src/app/(dashboard)/layout.tsx` | 수정 | PWA 배너 + safe area 패딩 |

---

## Task 1: Viewport 메타 태그 + Safe Area CSS

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: layout.tsx에 Viewport export 추가**

`apps/web/src/app/layout.tsx` 상단에 Viewport import와 export를 추가한다.

```typescript
// 기존 import 수정
import type { Metadata, Viewport } from "next";

// metadata export 바로 아래에 추가
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};
```

- [ ] **Step 2: globals.css에 safe area 유틸리티 추가**

`apps/web/src/app/globals.css`의 `@media (pointer: coarse)` 블록(line 164) 바로 앞에 추가:

```css
/* Safe area insets for notched devices */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.mb-safe {
  margin-bottom: env(safe-area-inset-bottom, 0px);
}
```

- [ ] **Step 3: 빌드 확인**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/globals.css
git commit -m "feat: viewport 메타 태그 + safe area CSS 유틸리티 추가"
```

---

## Task 2: 하단 네비게이션 4탭 재구성

**Files:**
- Modify: `apps/web/src/components/mobile-nav.tsx`
- Modify: `apps/web/src/components/nav.tsx`

- [ ] **Step 1: mobile-nav.tsx를 4탭으로 재구성**

`apps/web/src/components/mobile-nav.tsx` 전체를 다음으로 교체:

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  MessageSquare,
  LayoutGrid,
  MoreHorizontal,
  Settings,
  Building2,
  Truck,
  Package,
  HelpCircle,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/orders", label: "주문", icon: ClipboardList },
  { href: "/messages", label: "메시지", icon: MessageSquare },
  { href: "/dashboard", label: "대시보드", icon: LayoutGrid },
];

const moreMenuItems = [
  { href: "/settings", label: "설정", icon: Settings },
  { href: "/hospitals", label: "병원", icon: Building2 },
  { href: "/suppliers", label: "공급업체", icon: Truck },
  { href: "/products", label: "제품", icon: Package },
  { href: "/users", label: "사용자", icon: Users },
  { href: "/help", label: "도움말", icon: HelpCircle },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav
      data-mobile-nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden pb-safe"
    >
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive =
            item.href === pathname || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-full h-full text-muted-foreground transition-colors",
                "active:bg-accent/50",
                isActive && "text-primary",
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className={cn("text-[10px]", isActive && "font-semibold")}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* 더보기 탭 */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-full h-full text-muted-foreground transition-colors",
                "active:bg-accent/50",
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px]">더보기</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-safe">
            <SheetHeader>
              <SheetTitle>메뉴</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-4 py-4">
              {moreMenuItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => {
                    setMoreOpen(false);
                    router.push(item.href);
                  }}
                  className="flex flex-col items-center gap-2 rounded-lg p-3 text-muted-foreground transition-colors hover:bg-accent active:bg-accent/50"
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-xs">{item.label}</span>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: nav.tsx에서 모바일 햄버거 메뉴 제거 + 터치 타겟 확대**

`apps/web/src/components/nav.tsx`에서:

1. import에서 `Sheet, SheetContent, SheetTrigger` 제거, `Menu` 아이콘 제거, `navGroups, Package2` 제거:

변경 전 (line 6-9):
```typescript
import { Menu, Settings, HelpCircle, LogOut, User } from "lucide-react";
import { navGroups, Package2 } from "@/lib/nav-items";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
```

변경 후:
```typescript
import { Settings, HelpCircle, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
```

2. header JSX 내부에서 `{/* Mobile Toggle */}` 블록 전체 (line 45-89, `<Sheet>...</Sheet>`) 삭제.

3. 터치 타겟 확대 — Settings 버튼 (line 102)과 프로필 버튼 (line 110)의 크기를 확대:

Settings 버튼 변경 전:
```tsx
<Button variant="ghost" size="icon" className="h-8 w-8" asChild>
```
변경 후:
```tsx
<Button variant="ghost" size="icon" className="h-9 w-9" asChild>
```

프로필 버튼 변경 전:
```tsx
<button className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-200 transition-colors">
```
변경 후:
```tsx
<button className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-200 transition-colors">
```

(`pointer: coarse` 미디어쿼리가 globals.css에서 `data-slot="button"` 요소를 44px로 확대하므로, 기본 크기를 36px(h-9)로 올려 데스크톱에서도 적절한 크기를 확보)

- [ ] **Step 3: 빌드 확인**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/mobile-nav.tsx apps/web/src/components/nav.tsx
git commit -m "feat: 모바일 하단 네비게이션 4탭 재구성 (주문/메시지/대시보드/더보기)"
```

---

## Task 3: 모바일 주문 카드 리스트 컴포넌트

**Files:**
- Create: `apps/web/src/components/order-card-list.tsx`

- [ ] **Step 1: order-card-list.tsx 생성**

`apps/web/src/components/order-card-list.tsx`를 생성한다. 이 컴포넌트는 `order-table.tsx`와 동일한 데이터를 받아 모바일에서 카드형으로 표시한다.

```typescript
"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_VARIANT } from "@/lib/order-status";
import { updateOrderStatusAction } from "@/app/(dashboard)/orders/actions";
import { toast } from "sonner";

interface OrderGroup {
  order_id: number;
  order_number: string;
  order_date: string;
  hospital_name: string;
  status: string;
  total_amount: number | null;
  total_items: number;
}

interface OrderCardListProps {
  groups: OrderGroup[];
}

const STATUS_FILTERS = [
  { key: "all", label: "전체" },
  { key: "confirmed", label: "미완료" },
  { key: "delivered", label: "완료" },
];

export function OrderCardList({ groups }: OrderCardListProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered = activeFilter === "all"
    ? groups
    : groups.filter((g) => g.status === activeFilter);

  const counts: Record<string, number> = {
    all: groups.length,
    confirmed: groups.filter((g) => g.status === "confirmed").length,
    delivered: groups.filter((g) => g.status === "delivered").length,
  };

  return (
    <div className="space-y-3">
      {/* 상태 필터 pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              activeFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {f.label} {counts[f.key] ?? 0}
          </button>
        ))}
      </div>

      {/* 카드 리스트 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <svg className="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">주문이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((group) => (
            <SwipeableOrderCard
              key={group.order_id}
              group={group}
              onTap={() => router.push(`/orders/${group.order_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Swipeable Card ─── */

interface SwipeableCardProps {
  group: OrderGroup;
  onTap: () => void;
}

function SwipeableOrderCard({ group, onTap }: SwipeableCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const canSwipe = group.status === "confirmed";
  const threshold = 100; // px

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!canSwipe) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    setSwiping(true);
  }, [canSwipe]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // 방향 결정 (첫 10px 이동에서)
    if (isHorizontal.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHorizontal.current) return;

    // 왼쪽 스와이프만 허용
    if (dx < 0) {
      setOffsetX(Math.max(dx, -150));
    }
  }, [swiping]);

  const handleTouchEnd = useCallback(async () => {
    if (!swiping) return;
    setSwiping(false);
    isHorizontal.current = null;

    if (Math.abs(offsetX) >= threshold) {
      // 상태 변경 실행
      try {
        await updateOrderStatusAction(group.order_id, "delivered");
        toast.success("완료 처리됨");
      } catch {
        toast.error("상태 변경 실패");
      }
    }
    setOffsetX(0);
  }, [swiping, offsetX, group.order_id]);

  const formatAmount = (amount: number | null) => {
    if (amount == null) return "—";
    return `₩${amount.toLocaleString()}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "오늘";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "어제";
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* 스와이프 시 뒤에 보이는 액션 영역 */}
      {canSwipe && offsetX < 0 && (
        <div className="absolute inset-y-0 right-0 flex items-center justify-center bg-green-600 text-white text-xs font-medium px-4"
          style={{ width: Math.abs(offsetX) }}
        >
          {Math.abs(offsetX) >= threshold ? "놓으면 완료" : "완료 처리"}
        </div>
      )}

      {/* 카드 본체 */}
      <div
        ref={cardRef}
        className={cn(
          "relative rounded-lg border bg-card p-3.5 active:bg-accent/30 transition-colors",
          swiping ? "" : "transition-transform duration-200",
        )}
        style={{
          transform: `translateX(${offsetX}px)`,
          willChange: swiping ? "transform" : "auto",
        }}
        onClick={() => { if (!swiping && offsetX === 0) onTap(); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Row 1: 주문번호 + 상태 */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold">{group.order_number}</span>
          <Badge variant={ORDER_STATUS_VARIANT[group.status] ?? "secondary"} className="text-[10px]">
            {ORDER_STATUS_LABELS[group.status] || group.status}
          </Badge>
        </div>

        {/* Row 2: 병원명 */}
        <p className="text-xs text-muted-foreground mb-1.5 truncate">
          {group.hospital_name}
        </p>

        {/* Row 3: 금액 + 품목수/날짜 */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {formatAmount(group.total_amount)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {group.total_items}개 품목 · {formatDate(group.order_date)}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: 빌드 성공 (아직 사용되지 않지만 컴파일 오류 없어야 함)

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/order-card-list.tsx
git commit -m "feat: 모바일 주문 카드 리스트 컴포넌트 (스와이프 상태 변경 포함)"
```

---

## Task 4: 주문 테이블에 모바일 카드 분기 통합

**Files:**
- Modify: `apps/web/src/components/order-table.tsx`

- [ ] **Step 1: order-table.tsx에 모바일 분기 추가**

`apps/web/src/components/order-table.tsx`에서:

1. 상단에 import 추가:
```typescript
import { OrderCardList } from "./order-card-list";
```

2. 컴포넌트의 `return` 문을 감싸서 모바일/데스크톱 분기:

기존 return 구조:
```tsx
return (
  <>
    <div className="rounded-md border overflow-x-auto">
      <Table ...>
        ...
      </Table>
    </div>
    <BulkActionBar ... />
  </>
);
```

변경 후 — 기존 `return` (line 157)의 `<>` 바로 안에 모바일 카드 블록을 추가하고, 기존 테이블 블록을 `hidden md:block`으로 감싼다:

```tsx
return (
  <>
    {/* 모바일: 카드형 */}
    <div className="md:hidden">
      <OrderCardList
        groups={groups.map((g) => {
          const ot = calcOrderTotals(
            g.items.map((i) => ({ purchasePrice: i.purchase_price ?? 0, sellingPrice: i.unit_price ?? 0, qty: i.quantity })),
          );
          return {
            order_id: g.order_id,
            order_number: g.order_number,
            order_date: g.order_date,
            hospital_name: g.hospital_name,
            status: g.status,
            total_amount: ot.sellingTotal,
            total_items: g.items.length,
          };
        })}
      />
    </div>

    {/* 데스크톱: 기존 테이블 */}
    <div className="hidden md:block">
      {/* 기존 line 159-230의 <div className="rounded-md border overflow-x-auto">...</div> 전체를 여기로 이동 */}
      <div className="rounded-md border overflow-x-auto">
        <Table style={{ tableLayout: "fixed" }}>
          {/* ... 기존 TableHeader + TableBody 그대로 유지 ... */}
        </Table>
      </div>
      <BulkActionBar count={rowSelection.count} onClear={rowSelection.clear} onDelete={() => deleteOrdersAction(Array.from(rowSelection.selected))} label="주문" />
    </div>
  </>
);
```

핵심: `groups`의 `items` 배열에서 `calcOrderTotals()`를 호출하여 `sellingTotal`을 매출 총액으로, `g.items.length`를 품목 수로 매핑한다. `calcOrderTotals`는 이미 import되어 있다 (line 38).

- [ ] **Step 2: 빌드 확인**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/order-table.tsx
git commit -m "feat: 주문 테이블에 모바일 카드형 분기 통합 (md 브레이크포인트)"
```

---

## Task 5: 주문 상세 하단 고정 액션 바

**Files:**
- Modify: `apps/web/src/components/order-detail-client.tsx`

- [ ] **Step 1: 고정 액션 바 추가**

`apps/web/src/components/order-detail-client.tsx`의 컴포넌트 return 최하단에 모바일 고정 액션 바를 추가한다.

기존 return의 닫는 `</div>` 바로 위에 추가:

```tsx
{/* 모바일 고정 액션 바 */}
<div className="fixed bottom-14 left-0 right-0 z-40 border-t bg-background p-3 pb-safe md:hidden">
  <div className="flex gap-2">
    <Button
      variant="outline"
      className="flex-1"
      onClick={() => {
        // 수정 모드 — 기존 편집 기능 활용
        // order-detail-client에 이미 inline edit 기능이 있으므로
        // 스크롤 맨 위로 이동
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      수정
    </Button>
    {order.status === "confirmed" && (
      <Button
        className="flex-[2]"
        disabled={isPending}
        onClick={() => handleStatusChange("delivered")}
      >
        완료 처리
      </Button>
    )}
    {order.status === "delivered" && (
      <Button
        className="flex-[2]"
        variant="outline"
        disabled={isPending}
        onClick={() => handleStatusChange("confirmed")}
      >
        미완료로 변경
      </Button>
    )}
  </div>
</div>
```

주의:
- `bottom-14`: MobileNav(h-14) 위에 위치
- `pb-safe`: safe area 대응
- `z-40`: MobileNav(z-50)보다 아래
- `handleStatusChange`와 `isPending`은 이미 컴포넌트에 존재

- [ ] **Step 2: 기존 상태 버튼 모바일에서 숨기기**

기존 상태 토글 버튼(미완료/완료 toggle, line ~535)을 `hidden md:flex`로 감싸서 모바일에서 숨긴다:

기존:
```tsx
<button
  className="relative flex h-7 w-[110px] rounded-full border ..."
```

변경:
```tsx
<button
  className="relative hidden md:flex h-7 w-[110px] rounded-full border ..."
```

- [ ] **Step 3: 주문 상세 페이지 하단 패딩 추가**

`order-detail-client.tsx`의 최상위 `<div className="space-y-4">`를 수정하여 모바일에서 고정 바 영역 확보:

```tsx
<div className="space-y-4 pb-20 md:pb-0">
```

- [ ] **Step 4: 빌드 확인**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/components/order-detail-client.tsx
git commit -m "feat: 주문 상세 모바일 하단 고정 액션 바 추가"
```

---

## Task 6: 풀투리프레시 훅

**Files:**
- Create: `apps/web/src/hooks/use-pull-to-refresh.ts`
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: 풀투리프레시 CSS 애니메이션 추가**

`apps/web/src/app/globals.css`의 `/* Safe area insets */` 블록 아래에 추가:

```css
/* Pull-to-refresh */
.ptr-spinner {
  display: flex;
  justify-content: center;
  padding: 8px 0;
  transition: opacity 0.2s;
}
.ptr-spinner svg {
  width: 24px;
  height: 24px;
  animation: ptr-spin 0.8s linear infinite;
  color: var(--color-primary);
}
@keyframes ptr-spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: use-pull-to-refresh.ts 생성**

```typescript
"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UsePullToRefreshOptions {
  /** 새로고침 트리거 임계값 (px). 기본 80 */
  threshold?: number;
  /** 스크롤 컨테이너 선택자. 기본 "main" */
  scrollContainer?: string;
}

export function usePullToRefresh(options: UsePullToRefreshOptions = {}) {
  const { threshold = 80, scrollContainer = "main" } = options;
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (refreshing) return;
    const container = document.querySelector(scrollContainer);
    if (!container || container.scrollTop > 0) return;

    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [refreshing, scrollContainer]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      e.preventDefault();
      setPullDistance(Math.min(dy * 0.5, threshold * 1.5));
    }
  }, [threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= threshold) {
      setRefreshing(true);
      setError(false);
      try {
        router.refresh();
        await new Promise((r) => setTimeout(r, 600));
      } catch {
        setError(true);
        setTimeout(() => setError(false), 1000);
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, threshold, router]);

  useEffect(() => {
    // 터치 디바이스가 아니면 등록하지 않음
    if (!("ontouchstart" in window)) return;

    const container = document.querySelector(scrollContainer);
    if (!container) return;

    container.addEventListener("touchstart", onTouchStart as EventListener, { passive: true });
    container.addEventListener("touchmove", onTouchMove as EventListener, { passive: false });
    container.addEventListener("touchend", onTouchEnd as EventListener, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart as EventListener);
      container.removeEventListener("touchmove", onTouchMove as EventListener);
      container.removeEventListener("touchend", onTouchEnd as EventListener);
    };
  }, [scrollContainer, onTouchStart, onTouchMove, onTouchEnd]);

  return { pullDistance, refreshing, error };
}
```

- [ ] **Step 3: 주문 페이지에 풀투리프레시 적용을 위한 클라이언트 래퍼 생성**

주문 목록 페이지(`orders/page.tsx`)는 Server Component이므로, 풀투리프레시를 적용할 클라이언트 래퍼가 필요하다. `order-table.tsx`에서 이미 클라이언트 컴포넌트이므로, `order-card-list.tsx`에 통합한다.

`apps/web/src/components/order-card-list.tsx`의 `OrderCardList` 컴포넌트 상단에 풀투리프레시를 추가:

import 추가:
```typescript
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
```

`OrderCardList` 함수 내부 상단에 추가:
```typescript
const { pullDistance, refreshing, error } = usePullToRefresh();
```

return의 최상단에 풀투리프레시 인디케이터 추가:
```tsx
<div className="space-y-3">
  {/* 풀투리프레시 인디케이터 */}
  {(pullDistance > 0 || refreshing || error) && (
    <div
      className="ptr-spinner"
      style={{ opacity: refreshing || error ? 1 : Math.min(pullDistance / 80, 1) }}
    >
      {error ? (
        <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ) : (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )}
    </div>
  )}

  {/* 상태 필터 pills */}
  ...
```

- [ ] **Step 4: 빌드 확인**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/hooks/use-pull-to-refresh.ts apps/web/src/components/order-card-list.tsx apps/web/src/app/globals.css
git commit -m "feat: 풀투리프레시 훅 + 주문 카드 리스트 통합"
```

> **참고:** 메시지 페이지의 풀투리프레시는 메시지 목록 컴포넌트의 구조를 확인 후 별도 태스크로 진행. `usePullToRefresh` 훅은 재사용 가능하도록 설계되었으므로, 메시지 페이지의 클라이언트 컴포넌트에서 동일하게 import하여 사용하면 된다.

---

## Task 7: PWA 설치 유도 배너

**Files:**
- Create: `apps/web/src/components/pwa-install-banner.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`
- Modify: `apps/web/public/manifest.json`

- [ ] **Step 1: pwa-install-banner.tsx 생성**

```typescript
"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-banner-dismissed";
const DISMISS_DAYS = 7;

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // standalone 모드면 표시 안 함
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // 최근에 닫았으면 표시 안 함
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="mx-4 mb-3 rounded-xl bg-gradient-to-r from-primary to-emerald-600 p-3.5 text-white shadow-lg md:hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">NotiFlow 앱 설치</p>
          <p className="text-[11px] opacity-85">홈 화면에 추가하고 앱처럼 사용하세요</p>
        </div>
        <button onClick={handleDismiss} className="shrink-0 p-1 opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={handleInstall}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-primary"
        >
          설치
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: dashboard layout에 PWA 배너 추가**

`apps/web/src/app/(dashboard)/layout.tsx`에서:

import 추가:
```typescript
import { PwaInstallBanner } from "@/components/pwa-install-banner";
```

`<main>` 태그 바로 안에 배너 추가:
```tsx
<main className="flex-1 overflow-y-auto p-4 pb-16 md:pb-4 lg:p-6 lg:pb-4">
  <PwaInstallBanner />
  <div className="w-full space-y-4">
    {children}
  </div>
</main>
```

- [ ] **Step 3: manifest.json 아이콘 추가**

`apps/web/public/manifest.json`을 수정:

```json
{
  "name": "NotiFlow - 주문관리 대시보드",
  "short_name": "NotiFlow",
  "description": "혈액투석 의료기기 발주관리 시스템",
  "start_url": "/orders",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e293b",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

참고: PNG 아이콘 파일은 기존 SVG에서 생성해야 한다. 이 태스크에서는 manifest만 업데이트하고, 아이콘 파일 생성은 별도로 진행.

- [ ] **Step 4: 빌드 확인**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/components/pwa-install-banner.tsx apps/web/src/app/\(dashboard\)/layout.tsx apps/web/public/manifest.json
git commit -m "feat: PWA 설치 유도 배너 + manifest 아이콘 사이즈 추가"
```

---

## Task 8: PWA 아이콘 PNG 생성

**Files:**
- Create: `apps/web/public/icons/icon-192.png`
- Create: `apps/web/public/icons/icon-512.png`

- [ ] **Step 1: SVG에서 PNG 아이콘 생성**

`sharp` 또는 시스템 도구로 SVG를 PNG로 변환. macOS에서는 `sips` 또는 `rsvg-convert` 사용 가능:

```bash
# rsvg-convert가 있으면:
rsvg-convert -w 192 -h 192 apps/web/public/icons/icon.svg > apps/web/public/icons/icon-192.png
rsvg-convert -w 512 -h 512 apps/web/public/icons/icon.svg > apps/web/public/icons/icon-512.png

# 없으면 npx sharp-cli 사용:
npx sharp-cli -i apps/web/public/icons/icon.svg -o apps/web/public/icons/icon-192.png resize 192 192
npx sharp-cli -i apps/web/public/icons/icon.svg -o apps/web/public/icons/icon-512.png resize 512 512
```

먼저 SVG 파일 내용을 확인하고, 변환 가능한 도구가 설치되어 있는지 확인한다.

- [ ] **Step 2: 커밋**

```bash
git add apps/web/public/icons/icon-192.png apps/web/public/icons/icon-512.png
git commit -m "feat: PWA 아이콘 192x192, 512x512 PNG 추가"
```

---

## Task 9: dashboard layout safe area 패딩 조정

**Files:**
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: main 영역 하단 패딩 조정**

현재 `pb-16`은 MobileNav(h-14=56px)을 위한 것이다. 고정 액션 바가 주문 상세에서만 나타나므로 layout 자체는 현재 `pb-16`을 유지한다. 다만 safe area가 필요한 경우를 대비:

`apps/web/src/app/(dashboard)/layout.tsx`에서 MobileNav가 이미 `pb-safe`를 포함하고 있으므로, main 영역은 현재 `pb-16`만으로 충분하다.

이 태스크에서 별도 변경은 불필요할 수 있으나, 전체 동작 확인을 위해 dev 서버에서 모바일 시뮬레이션 테스트:

Run: `cd apps/web && npm run dev`

Chrome DevTools → Device toolbar → iPhone 14 Pro 등으로 확인:
1. 하단 4탭 네비게이션 표시 확인
2. 주문 목록 카드형 표시 확인
3. 주문 상세 하단 액션 바 확인
4. 더보기 Sheet 동작 확인

- [ ] **Step 2: 커밋 (변경사항이 있을 경우)**

```bash
git add -A && git diff --staged --quiet || git commit -m "fix: 모바일 레이아웃 safe area 패딩 조정"
```

---

## Task 10: 최종 빌드 + 통합 확인

**Files:** 없음 (검증만)

- [ ] **Step 1: 프로덕션 빌드**

Run: `cd apps/web && npx next build 2>&1 | tail -30`
Expected: 빌드 성공, 에러 없음

- [ ] **Step 2: 린트**

Run: `cd apps/web && npm run lint 2>&1 | tail -20`
Expected: 에러 없음

- [ ] **Step 3: 버전 업데이트**

도커 재빌드 시 항상 사이드바 버전 업데이트 규칙에 따라:
- `apps/web/src/lib/version.ts`의 버전 번호 업데이트
- `apps/web/package.json`의 version 업데이트

- [ ] **Step 4: 최종 커밋**

```bash
git add apps/web/src/lib/version.ts apps/web/package.json
git commit -m "chore: 모바일 웹 최적화 완료 — 버전업"
```

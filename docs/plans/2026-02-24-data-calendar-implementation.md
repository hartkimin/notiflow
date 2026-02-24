# Data Calendar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the existing schedule-based calendar with data-driven calendar tabs inside the Messages and Orders pages, showing items by date with day/week/month views and a detail side panel.

**Architecture:** A shared generic `DataCalendar<T>` component provides the calendar layout (header, month grid, week grid, day list). Each page passes its own data, cell renderers, and detail panel content. The old `/calendar` route and all related mobile-category/plan code is removed.

**Tech Stack:** Next.js 16, React 19, TypeScript, shadcn/ui (Sheet, Tabs, Badge), Tailwind CSS, Supabase queries.

---

### Task 1: Remove old calendar from sidebar navigation

**Files:**
- Modify: `apps/web/src/lib/nav-items.ts:40`

**Step 1: Remove the calendar nav item**

In `apps/web/src/lib/nav-items.ts`, delete line 40:
```typescript
      { href: "/calendar", label: "캘린더", icon: CalendarDays },
```

Also remove the unused `CalendarDays` import from lucide-react (line 9).

**Step 2: Verify the build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: Build succeeds (the /calendar route still exists but is unreachable from nav)

**Step 3: Commit**

```bash
git add apps/web/src/lib/nav-items.ts
git commit -m "chore: remove calendar from sidebar navigation"
```

---

### Task 2: Delete old calendar route and components

**Files:**
- Delete: `apps/web/src/app/(dashboard)/calendar/` (entire directory)
- Delete: `apps/web/src/components/schedule-view.tsx`
- Delete: `apps/web/src/components/calendar/view-switcher.tsx`
- Delete: `apps/web/src/components/calendar/week-view.tsx`
- Delete: `apps/web/src/components/calendar/day-view.tsx`
- Delete: `apps/web/src/components/calendar/month-view.tsx`
- Delete: `apps/web/src/components/calendar/side-panel.tsx`
- Delete: `apps/web/src/components/calendar/category-manager.tsx`
- Delete: `apps/web/src/components/calendar/filter-rule-editor.tsx`
- Delete: `apps/web/src/lib/queries/schedule.ts`

**Step 1: Delete all calendar files**

```bash
rm -rf apps/web/src/app/\(dashboard\)/calendar/
rm apps/web/src/components/schedule-view.tsx
rm apps/web/src/components/calendar/view-switcher.tsx
rm apps/web/src/components/calendar/week-view.tsx
rm apps/web/src/components/calendar/day-view.tsx
rm apps/web/src/components/calendar/month-view.tsx
rm apps/web/src/components/calendar/side-panel.tsx
rm apps/web/src/components/calendar/category-manager.tsx
rm apps/web/src/components/calendar/filter-rule-editor.tsx
rm apps/web/src/lib/queries/schedule.ts
```

**Step 2: Remove calendar-only server actions from `apps/web/src/lib/actions.ts`**

Delete these functions (they all reference plans, day_categories, categories, filter_rules tables for the old calendar):
- `createPlan` (line ~544)
- `updatePlan` (line ~572)
- `togglePlanCompletion` (line ~583)
- `deletePlan` (line ~594)
- `linkPlanToMessage` (line ~605)
- `updatePlanOrderNumber` (line ~616)
- `addCategoryToDay` (line ~629)
- `removeCategoryFromDay` (line ~648)
- `addAllCategoriesToWeek` (line ~661)
- `copyPreviousWeekPlans` (line ~713)
- `copyCurrentWeekToNext` (line ~771)
- `createCategory` (line ~778)
- `updateCategory` (line ~804)
- `deleteCategory` (line ~820)
- `reorderCategories` (line ~831)
- `createFilterRule` (line ~849)
- `updateFilterRule` (line ~887)
- `deleteFilterRule` (line ~901)

Also remove the `generateId` and `toSignedInt32` imports from `schedule-utils` if they are no longer used by remaining actions.

**Step 3: Remove calendar-only types from `apps/web/src/lib/types.ts`**

Delete these interfaces:
- `Plan` (line ~244-253)
- `DayCategory` (line ~255-259)
- `FilterRule` (line ~325-337)

Keep `MobileCategory` and `CapturedMessage` — check if anything still imports them. If not, delete them too.

**Step 4: Clean up schedule-utils**

In `apps/web/src/lib/schedule-utils.ts`, keep these utility functions (they're reusable for the new calendar):
- `getWeekMonday`, `startOfDayMs`, `getWeekDates`
- `formatEpochDate`, `formatEpochTime`
- `parseWeekParam`, `formatWeekLabel`, `formatMonthLabel`, `formatDayLabel`
- `toLocalDateStr`
- `getMonthStart`, `getMonthEnd`, `getMonthGridDates`
- `CalendarView` type, `CalendarParams` interface, `parseCalendarParams`

Remove only functions that are no longer imported anywhere:
- `generateId` (if only used by deleted actions)
- `toSignedInt32` (if only used by deleted actions)
- `argbToHex` (if only used by deleted calendar components)

**Step 5: Verify the build**

Run: `cd apps/web && npx next build 2>&1 | tail -10`
Expected: Build succeeds with no errors. Fix any remaining import references.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove old calendar page, components, queries, and actions"
```

---

### Task 3: Create query functions for calendar data

**Files:**
- Modify: `apps/web/src/lib/queries/messages.ts`
- Modify: `apps/web/src/lib/queries/orders.ts`

**Step 1: Add `getMessagesForCalendar` to messages.ts**

This is a date-range query without pagination (we need all items for the date range to render on the calendar).

```typescript
/**
 * Get all messages in a date range (no pagination) for calendar view.
 */
export async function getMessagesForCalendar(params: {
  from: string;  // ISO date string "YYYY-MM-DD"
  to: string;    // ISO date string "YYYY-MM-DD"
}): Promise<RawMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("raw_messages")
    .select("*")
    .gte("received_at", params.from)
    .lt("received_at", params.to)
    .order("received_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as RawMessage[];
}
```

**Step 2: Add `getOrdersForCalendar` to orders.ts**

```typescript
/**
 * Get all orders in a date range (no pagination) for calendar view.
 * Returns Order[] (not OrderItemFlat[]) since we group by order on the calendar.
 */
export async function getOrdersForCalendar(params: {
  from: string;  // ISO date string "YYYY-MM-DD"
  to: string;    // ISO date string "YYYY-MM-DD"
}): Promise<Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, hospitals(name)")
    .gte("order_date", params.from)
    .lt("order_date", params.to)
    .order("order_date", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    hospital_name: (row.hospitals as { name: string } | null)?.name,
    hospitals: undefined,
  })) as Order[];
}
```

**Step 3: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add apps/web/src/lib/queries/messages.ts apps/web/src/lib/queries/orders.ts
git commit -m "feat: add calendar date-range query functions for messages and orders"
```

---

### Task 4: Create CalendarHeader component

**Files:**
- Create: `apps/web/src/components/data-calendar/calendar-header.tsx`

This component provides:
- Prev/Next navigation buttons
- "오늘" (Today) button
- Current period label (formatted for day/week/month)
- View switcher (일/주/월 tabs)

**Step 1: Create the component**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatWeekLabel, formatMonthLabel, formatDayLabel,
  getWeekMonday, toLocalDateStr,
} from "@/lib/schedule-utils";
import type { CalendarView } from "@/lib/schedule-utils";

interface CalendarHeaderProps {
  view: CalendarView;
  referenceDate: Date;
  basePath: string;     // e.g. "/messages" or "/orders"
  tabParam: string;     // e.g. "calendar"
}

export function CalendarHeader({ view, referenceDate, basePath, tabParam }: CalendarHeaderProps) {
  const router = useRouter();

  function buildUrl(v: CalendarView, date: Date) {
    const params = new URLSearchParams();
    params.set("tab", tabParam);
    params.set("view", v);
    if (v === "day") {
      params.set("date", toLocalDateStr(date));
    } else if (v === "week") {
      params.set("week", toLocalDateStr(getWeekMonday(date)));
    } else {
      params.set("month", `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }
    return `${basePath}?${params.toString()}`;
  }

  function navigate(direction: -1 | 1) {
    const d = new Date(referenceDate);
    if (view === "day") d.setDate(d.getDate() + direction);
    else if (view === "week") d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    router.push(buildUrl(view, d));
  }

  function goToday() {
    router.push(buildUrl(view, new Date()));
  }

  function switchView(v: CalendarView) {
    router.push(buildUrl(v, referenceDate));
  }

  const label =
    view === "day" ? formatDayLabel(referenceDate) :
    view === "week" ? formatWeekLabel(referenceDate) :
    formatMonthLabel(referenceDate);

  return (
    <div className="flex items-center gap-2 py-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" className="h-8" onClick={goToday}>
        오늘
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      <span className="text-sm font-semibold ml-2">{label}</span>

      <div className="ml-auto flex items-center gap-1 rounded-lg border p-0.5">
        {(["day", "week", "month"] as CalendarView[]).map((v) => (
          <button
            key={v}
            onClick={() => switchView(v)}
            className={[
              "px-3 py-1 text-xs rounded-md transition-colors",
              view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            ].join(" ")}
          >
            {v === "day" ? "일" : v === "week" ? "주" : "월"}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add apps/web/src/components/data-calendar/calendar-header.tsx
git commit -m "feat: create CalendarHeader component with view switching and navigation"
```

---

### Task 5: Create MonthGrid component

**Files:**
- Create: `apps/web/src/components/data-calendar/month-grid.tsx`

Generic month grid that groups items by date and renders custom cells.

**Step 1: Create the component**

```typescript
"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { getMonthGridDates, startOfDayMs, toLocalDateStr } from "@/lib/schedule-utils";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

interface MonthGridProps<T> {
  items: T[];
  dateAccessor: (item: T) => Date;
  idAccessor: (item: T) => string | number;
  renderItem: (item: T) => React.ReactNode;
  referenceDate: Date;
  onItemClick: (item: T) => void;
  onDateClick: (date: Date) => void;
}

export function MonthGrid<T>({
  items, dateAccessor, idAccessor, renderItem,
  referenceDate, onItemClick, onDateClick,
}: MonthGridProps<T>) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const gridDates = useMemo(() => getMonthGridDates(year, month), [year, month]);

  const itemsByDay = useMemo(() => {
    const map = new Map<number, T[]>();
    for (const item of items) {
      const dayMs = startOfDayMs(dateAccessor(item));
      const arr = map.get(dayMs);
      if (arr) arr.push(item);
      else map.set(dayMs, [item]);
    }
    return map;
  }, [items, dateAccessor]);

  const todayMs = startOfDayMs(new Date());
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const firstDayDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const rowCount = Math.ceil((firstDayDow + lastDayOfMonth) / 7);
  const cellCount = rowCount * 7;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={[
              "text-center text-xs font-medium py-1",
              i === 6 && "text-red-500",
              i === 5 && "text-blue-500",
            ].filter(Boolean).join(" ")}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-7 gap-1 flex-1"
        style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
      >
        {gridDates.slice(0, cellCount).map((date) => {
          const dayMs = startOfDayMs(date);
          const isCurrentMonth = date.getMonth() === month;
          const isToday = dayMs === todayMs;
          const dayItems = itemsByDay.get(dayMs) ?? [];
          const dow = date.getDay();

          return (
            <div
              key={dayMs}
              className={[
                "rounded-lg border p-1.5 text-left flex flex-col min-h-0 overflow-hidden",
                !isCurrentMonth && "opacity-40",
                isToday && "ring-2 ring-primary/50",
              ].filter(Boolean).join(" ")}
            >
              <button
                onClick={() => onDateClick(date)}
                className={[
                  "text-sm font-medium hover:text-primary transition-colors text-left",
                  isToday && "text-primary",
                  dow === 0 && isCurrentMonth && "text-red-500",
                  dow === 6 && isCurrentMonth && "text-blue-500",
                ].filter(Boolean).join(" ")}
              >
                {date.getDate()}
              </button>

              {/* Items */}
              <div className="mt-0.5 flex-1 min-h-0 overflow-hidden space-y-px">
                {dayItems.slice(0, 4).map((item) => (
                  <button
                    key={idAccessor(item)}
                    onClick={() => onItemClick(item)}
                    className="w-full text-left text-[9px] text-muted-foreground truncate leading-tight hover:text-foreground transition-colors"
                  >
                    {renderItem(item)}
                  </button>
                ))}
                {dayItems.length > 4 && (
                  <span className="text-[9px] text-muted-foreground">+{dayItems.length - 4}건</span>
                )}
              </div>

              {/* Count badge */}
              {dayItems.length > 0 && (
                <div className="mt-auto pt-0.5">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                    {dayItems.length}
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Verify build, Step 3: Commit**

```bash
git add apps/web/src/components/data-calendar/month-grid.tsx
git commit -m "feat: create generic MonthGrid calendar component"
```

---

### Task 6: Create WeekGrid component

**Files:**
- Create: `apps/web/src/components/data-calendar/week-grid.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { getWeekDates, startOfDayMs } from "@/lib/schedule-utils";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

interface WeekGridProps<T> {
  items: T[];
  dateAccessor: (item: T) => Date;
  idAccessor: (item: T) => string | number;
  renderItem: (item: T) => React.ReactNode;
  referenceDate: Date; // Monday
  onItemClick: (item: T) => void;
}

export function WeekGrid<T>({
  items, dateAccessor, idAccessor, renderItem,
  referenceDate, onItemClick,
}: WeekGridProps<T>) {
  const weekDates = useMemo(() => getWeekDates(referenceDate), [referenceDate]);

  const itemsByDay = useMemo(() => {
    const map = new Map<number, T[]>();
    for (const item of items) {
      const dayMs = startOfDayMs(dateAccessor(item));
      const arr = map.get(dayMs);
      if (arr) arr.push(item);
      else map.set(dayMs, [item]);
    }
    return map;
  }, [items, dateAccessor]);

  const todayMs = startOfDayMs(new Date());

  return (
    <div className="grid grid-cols-7 gap-2 flex-1 min-h-0">
      {weekDates.map((date, i) => {
        const dayMs = startOfDayMs(date);
        const isToday = dayMs === todayMs;
        const dayItems = itemsByDay.get(dayMs) ?? [];

        return (
          <div
            key={dayMs}
            className={[
              "flex flex-col rounded-lg border min-h-0",
              isToday && "ring-2 ring-primary/50",
            ].filter(Boolean).join(" ")}
          >
            {/* Day header */}
            <div className={[
              "px-2 py-1.5 border-b text-center",
              isToday && "bg-primary/5",
            ].filter(Boolean).join(" ")}>
              <span className={[
                "text-xs font-medium",
                i === 6 && "text-red-500",
                i === 5 && "text-blue-500",
              ].filter(Boolean).join(" ")}>
                {DAY_LABELS[i]}
              </span>
              <span className={[
                "ml-1 text-sm font-semibold",
                isToday && "text-primary",
              ].filter(Boolean).join(" ")}>
                {date.getDate()}
              </span>
              {dayItems.length > 0 && (
                <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 h-3.5">
                  {dayItems.length}
                </Badge>
              )}
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {dayItems.map((item) => (
                <button
                  key={idAccessor(item)}
                  onClick={() => onItemClick(item)}
                  className="w-full text-left rounded border p-1.5 hover:bg-muted/50 transition-colors"
                >
                  {renderItem(item)}
                </button>
              ))}
              {dayItems.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-4">-</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Verify build, Step 3: Commit**

```bash
git add apps/web/src/components/data-calendar/week-grid.tsx
git commit -m "feat: create generic WeekGrid calendar component"
```

---

### Task 7: Create DayList component

**Files:**
- Create: `apps/web/src/components/data-calendar/day-list.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useMemo } from "react";
import { startOfDayMs } from "@/lib/schedule-utils";

interface DayListProps<T> {
  items: T[];
  dateAccessor: (item: T) => Date;
  idAccessor: (item: T) => string | number;
  renderItem: (item: T) => React.ReactNode;
  referenceDate: Date;
  onItemClick: (item: T) => void;
}

export function DayList<T>({
  items, dateAccessor, idAccessor, renderItem,
  referenceDate, onItemClick,
}: DayListProps<T>) {
  const dayMs = startOfDayMs(referenceDate);

  const dayItems = useMemo(() => {
    return items.filter((item) => startOfDayMs(dateAccessor(item)) === dayMs);
  }, [items, dateAccessor, dayMs]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
      {dayItems.map((item) => (
        <button
          key={idAccessor(item)}
          onClick={() => onItemClick(item)}
          className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
        >
          {renderItem(item)}
        </button>
      ))}
      {dayItems.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          이 날짜에 데이터가 없습니다
        </p>
      )}
    </div>
  );
}
```

**Step 2: Verify build, Step 3: Commit**

```bash
git add apps/web/src/components/data-calendar/day-list.tsx
git commit -m "feat: create generic DayList calendar component"
```

---

### Task 8: Create DetailPanel component

**Files:**
- Create: `apps/web/src/components/data-calendar/detail-panel.tsx`

Uses shadcn/ui `Sheet` for a right-side slide-over panel.

**Step 1: Create the component**

```typescript
"use client";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

interface DetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export function DetailPanel({ open, onOpenChange, title, children }: DetailPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Verify that the `Sheet` component is available**

Run: `ls apps/web/src/components/ui/sheet.tsx`

If it doesn't exist, install it:
```bash
cd apps/web && npx shadcn@latest add sheet
```

**Step 3: Verify build, Step 4: Commit**

```bash
git add apps/web/src/components/data-calendar/detail-panel.tsx
git commit -m "feat: create DetailPanel slide-over component"
```

---

### Task 9: Create DataCalendar wrapper component

**Files:**
- Create: `apps/web/src/components/data-calendar/data-calendar.tsx`
- Create: `apps/web/src/components/data-calendar/index.ts`

This is the main component that wires CalendarHeader + MonthGrid/WeekGrid/DayList + DetailPanel together.

**Step 1: Create data-calendar.tsx**

```typescript
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarHeader } from "./calendar-header";
import { MonthGrid } from "./month-grid";
import { WeekGrid } from "./week-grid";
import { DayList } from "./day-list";
import { DetailPanel } from "./detail-panel";
import type { CalendarView } from "@/lib/schedule-utils";
import { toLocalDateStr, getWeekMonday } from "@/lib/schedule-utils";

interface DataCalendarProps<T> {
  items: T[];
  dateAccessor: (item: T) => Date;
  idAccessor: (item: T) => string | number;
  // Renderers
  renderMonthItem: (item: T) => React.ReactNode;
  renderWeekItem: (item: T) => React.ReactNode;
  renderDayItem: (item: T) => React.ReactNode;
  renderDetail: (item: T) => React.ReactNode;
  detailTitle: (item: T) => string;
  // Config
  view: CalendarView;
  referenceDate: Date;
  basePath: string;
  tabParam?: string;
}

export function DataCalendar<T>({
  items, dateAccessor, idAccessor,
  renderMonthItem, renderWeekItem, renderDayItem,
  renderDetail, detailTitle,
  view, referenceDate, basePath, tabParam = "calendar",
}: DataCalendarProps<T>) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<T | null>(null);

  const handleItemClick = useCallback((item: T) => {
    setSelectedItem(item);
  }, []);

  const handleDateClick = useCallback((date: Date) => {
    const params = new URLSearchParams();
    params.set("tab", tabParam);
    params.set("view", "day");
    params.set("date", toLocalDateStr(date));
    router.push(`${basePath}?${params.toString()}`);
  }, [router, basePath, tabParam]);

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <CalendarHeader
        view={view}
        referenceDate={referenceDate}
        basePath={basePath}
        tabParam={tabParam}
      />

      {view === "month" && (
        <MonthGrid
          items={items}
          dateAccessor={dateAccessor}
          idAccessor={idAccessor}
          renderItem={renderMonthItem}
          referenceDate={referenceDate}
          onItemClick={handleItemClick}
          onDateClick={handleDateClick}
        />
      )}

      {view === "week" && (
        <WeekGrid
          items={items}
          dateAccessor={dateAccessor}
          idAccessor={idAccessor}
          renderItem={renderWeekItem}
          referenceDate={referenceDate}
          onItemClick={handleItemClick}
        />
      )}

      {view === "day" && (
        <DayList
          items={items}
          dateAccessor={dateAccessor}
          idAccessor={idAccessor}
          renderItem={renderDayItem}
          referenceDate={referenceDate}
          onItemClick={handleItemClick}
        />
      )}

      <DetailPanel
        open={selectedItem !== null}
        onOpenChange={(open) => { if (!open) setSelectedItem(null); }}
        title={selectedItem ? detailTitle(selectedItem) : ""}
      >
        {selectedItem && renderDetail(selectedItem)}
      </DetailPanel>
    </div>
  );
}
```

**Step 2: Create index.ts barrel export**

```typescript
export { DataCalendar } from "./data-calendar";
export { CalendarHeader } from "./calendar-header";
export { MonthGrid } from "./month-grid";
export { WeekGrid } from "./week-grid";
export { DayList } from "./day-list";
export { DetailPanel } from "./detail-panel";
```

**Step 3: Verify build, Step 4: Commit**

```bash
git add apps/web/src/components/data-calendar/
git commit -m "feat: create DataCalendar generic wrapper component"
```

---

### Task 10: Add calendar tab to Messages page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/messages/page.tsx`
- Create: `apps/web/src/components/message-calendar.tsx`

**Step 1: Create MessageCalendar component**

This component wraps `DataCalendar<RawMessage>` with message-specific renderers.

```typescript
"use client";

import { Badge } from "@/components/ui/badge";
import { DataCalendar } from "@/components/data-calendar";
import type { CalendarView } from "@/lib/schedule-utils";
import type { RawMessage } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  kakaotalk: "카카오톡",
  sms: "SMS",
  telegram: "텔레그램",
  manual: "수동",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  parsed: "default",
  pending: "secondary",
  failed: "destructive",
  skipped: "outline",
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${formatTime(dateStr)}`;
}

// --- Renderers ---

function MonthItem({ msg }: { msg: RawMessage }) {
  return (
    <span>
      <span className="font-medium">{msg.sender ?? "?"}</span>{" "}
      {msg.content?.slice(0, 20)}
    </span>
  );
}

function WeekItem({ msg }: { msg: RawMessage }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium truncate">{msg.sender ?? "?"}</span>
        <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(msg.received_at)}</span>
      </div>
      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{msg.content}</p>
    </div>
  );
}

function DayItem({ msg }: { msg: RawMessage }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{msg.sender ?? "?"}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className="text-[10px]">{SOURCE_LABELS[msg.source_app] ?? msg.source_app}</Badge>
          <Badge variant={STATUS_VARIANTS[msg.parse_status] ?? "secondary"} className="text-[10px]">
            {msg.parse_status === "parsed" ? "파싱완료" : msg.parse_status === "pending" ? "대기" : msg.parse_status === "failed" ? "실패" : msg.parse_status}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDate(msg.received_at)}</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{msg.content}</p>
      {msg.device_name && (
        <span className="text-xs text-muted-foreground mt-1">기기: {msg.device_name}</span>
      )}
    </div>
  );
}

function DetailContent({ msg }: { msg: RawMessage }) {
  const parseResult = msg.parse_result as { items?: Array<{ item: string; qty: number; unit: string; matched_product?: string; confidence?: number }> } | null;

  return (
    <div className="space-y-4">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">발신자</span>
          <p className="font-medium">{msg.sender ?? "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">수신시간</span>
          <p className="font-medium">{formatDate(msg.received_at)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">출처</span>
          <p><Badge variant="outline">{SOURCE_LABELS[msg.source_app] ?? msg.source_app}</Badge></p>
        </div>
        <div>
          <span className="text-muted-foreground">파싱상태</span>
          <p><Badge variant={STATUS_VARIANTS[msg.parse_status] ?? "secondary"}>{msg.parse_status}</Badge></p>
        </div>
        {msg.device_name && (
          <div>
            <span className="text-muted-foreground">기기</span>
            <p className="font-medium">{msg.device_name}</p>
          </div>
        )}
        {msg.order_id && (
          <div>
            <span className="text-muted-foreground">주문</span>
            <p><a href={`/orders/${msg.order_id}`} className="text-primary hover:underline">#{msg.order_id}</a></p>
          </div>
        )}
      </div>

      {/* Content */}
      <div>
        <h4 className="text-sm font-medium mb-1">메시지 내용</h4>
        <div className="rounded border p-3 text-sm whitespace-pre-wrap bg-muted/30">
          {msg.content}
        </div>
      </div>

      {/* Parse result */}
      {parseResult?.items && parseResult.items.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">파싱 결과</h4>
          <div className="rounded border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">품목</th>
                  <th className="text-right px-2 py-1 font-medium">수량</th>
                  <th className="text-left px-2 py-1 font-medium">단위</th>
                  <th className="text-left px-2 py-1 font-medium">매칭</th>
                </tr>
              </thead>
              <tbody>
                {parseResult.items.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1">{item.item}</td>
                    <td className="px-2 py-1 text-right">{item.qty}</td>
                    <td className="px-2 py-1">{item.unit}</td>
                    <td className="px-2 py-1 text-muted-foreground">{item.matched_product ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main component ---

interface MessageCalendarProps {
  messages: RawMessage[];
  view: CalendarView;
  referenceDate: Date;
}

export function MessageCalendar({ messages, view, referenceDate }: MessageCalendarProps) {
  return (
    <DataCalendar
      items={messages}
      dateAccessor={(m) => new Date(m.received_at)}
      idAccessor={(m) => m.id}
      renderMonthItem={(m) => <MonthItem msg={m} />}
      renderWeekItem={(m) => <WeekItem msg={m} />}
      renderDayItem={(m) => <DayItem msg={m} />}
      renderDetail={(m) => <DetailContent msg={m} />}
      detailTitle={(m) => `${m.sender ?? "메시지"} — ${formatTime(m.received_at)}`}
      view={view}
      referenceDate={referenceDate}
      basePath="/messages"
      tabParam="calendar"
    />
  );
}
```

**Step 2: Modify messages/page.tsx to add tab switching**

Replace the entire messages page with:

```typescript
import { getMessages } from "@/lib/queries/messages";
import { getMessagesForCalendar } from "@/lib/queries/messages";
import { getHospitals } from "@/lib/queries/hospitals";
import { getProducts } from "@/lib/queries/products";
import { MessageFilters, MessageTable, CreateMessageDialog } from "@/components/message-list";
import { MessageCalendar } from "@/components/message-calendar";
import { Pagination } from "@/components/pagination";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RealtimeListener } from "@/components/realtime-listener";
import { parseCalendarParams, toLocalDateStr } from "@/lib/schedule-utils";
import Link from "next/link";

interface Props {
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    parse_status?: string;
    source_app?: string;
    page?: string;
    view?: string;
    date?: string;
    week?: string;
    month?: string;
  }>;
}

export default async function MessagesPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = params.tab === "calendar" ? "calendar" : "list";

  // --- List view data ---
  const page = parseInt(params.page || "1", 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const [result, hospitalsResult, productsResult] = await Promise.all([
    tab === "list"
      ? getMessages({ from: params.from, to: params.to, parse_status: params.parse_status, source_app: params.source_app, limit, offset })
          .catch(() => ({ messages: [], total: 0 }))
      : Promise.resolve({ messages: [], total: 0 }),
    getHospitals({ limit: 500 }).catch(() => ({ hospitals: [], total: 0 })),
    getProducts({ limit: 500 }).catch(() => ({ products: [], total: 0 })),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  // --- Calendar view data ---
  let calendarMessages: import("@/lib/types").RawMessage[] = [];
  let calView: import("@/lib/schedule-utils").CalendarView = "week";
  let calRef = new Date();

  if (tab === "calendar") {
    const calParams = parseCalendarParams(params);
    calView = calParams.view;
    calRef = calParams.referenceDate;

    // Convert epoch ms to ISO date strings for query
    const fromStr = toLocalDateStr(new Date(calParams.startMs));
    const toStr = toLocalDateStr(new Date(calParams.endMs));
    calendarMessages = await getMessagesForCalendar({ from: fromStr, to: toStr }).catch(() => []);
  }

  return (
    <>
      <RealtimeListener tables={["raw_messages", "captured_messages"]} />
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">수신메시지</h1>
        {tab === "list" && <CreateMessageDialog />}
      </div>

      <Tabs value={tab}>
        <TabsList>
          <TabsTrigger value="list" asChild>
            <Link href="/messages">목록</Link>
          </TabsTrigger>
          <TabsTrigger value="calendar" asChild>
            <Link href="/messages?tab=calendar">캘린더</Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>메시지 목록</CardTitle>
              <CardDescription><MessageFilters /></CardDescription>
            </CardHeader>
            <CardContent>
              <MessageTable messages={result.messages} hospitals={hospitalsResult.hospitals} products={productsResult.products} />
            </CardContent>
            <CardFooter>
              <Pagination currentPage={page} totalPages={totalPages} totalCount={result.total} />
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <MessageCalendar messages={calendarMessages} view={calView} referenceDate={calRef} />
        </TabsContent>
      </Tabs>
    </>
  );
}
```

**Step 3: Verify build, Step 4: Commit**

```bash
git add apps/web/src/components/message-calendar.tsx apps/web/src/app/\(dashboard\)/messages/page.tsx
git commit -m "feat: add calendar tab to messages page with day/week/month views"
```

---

### Task 11: Add calendar tab to Orders page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx`
- Create: `apps/web/src/components/order-calendar.tsx`

**Step 1: Create OrderCalendar component**

```typescript
"use client";

import { Badge } from "@/components/ui/badge";
import { DataCalendar } from "@/components/data-calendar";
import type { CalendarView } from "@/lib/schedule-utils";
import type { Order } from "@/lib/types";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "임시", variant: "secondary" },
  confirmed: { label: "확인됨", variant: "default" },
  processing: { label: "처리중", variant: "default" },
  delivered: { label: "배송완료", variant: "outline" },
  cancelled: { label: "취소", variant: "destructive" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

// --- Renderers ---

function MonthItem({ order }: { order: Order }) {
  return (
    <span>
      <span className="font-medium">{order.order_number}</span>{" "}
      {order.hospital_name}
    </span>
  );
}

function WeekItem({ order }: { order: Order }) {
  const st = STATUS_MAP[order.status];
  return (
    <div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium font-mono truncate">{order.order_number}</span>
        {st && <Badge variant={st.variant} className="text-[9px] px-1 py-0 h-3.5 shrink-0">{st.label}</Badge>}
      </div>
      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{order.hospital_name}</p>
    </div>
  );
}

function DayItem({ order }: { order: Order }) {
  const st = STATUS_MAP[order.status];
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium font-mono">{order.order_number}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {st && <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>}
          <span className="text-xs text-muted-foreground">{formatDate(order.order_date)}</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{order.hospital_name}</p>
      {order.delivery_date && (
        <span className="text-xs text-muted-foreground">배송: {formatDate(order.delivery_date)}</span>
      )}
    </div>
  );
}

function DetailContent({ order }: { order: Order }) {
  const st = STATUS_MAP[order.status];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">주문번호</span>
          <p className="font-medium font-mono">{order.order_number}</p>
        </div>
        <div>
          <span className="text-muted-foreground">거래처</span>
          <p className="font-medium">{order.hospital_name ?? "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">주문일</span>
          <p className="font-medium">{formatDate(order.order_date)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">배송일</span>
          <p className="font-medium">{order.delivery_date ? formatDate(order.delivery_date) : "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">상태</span>
          <p>{st && <Badge variant={st.variant}>{st.label}</Badge>}</p>
        </div>
        <div>
          <span className="text-muted-foreground">품목수</span>
          <p className="font-medium">{order.total_items}건</p>
        </div>
      </div>

      {order.notes && (
        <div>
          <h4 className="text-sm font-medium mb-1">메모</h4>
          <div className="rounded border p-3 text-sm bg-muted/30">{order.notes}</div>
        </div>
      )}

      <div className="pt-2">
        <a
          href={`/orders/${order.id}`}
          className="text-sm text-primary hover:underline"
        >
          상세 페이지로 이동 →
        </a>
      </div>
    </div>
  );
}

// --- Main component ---

interface OrderCalendarProps {
  orders: Order[];
  view: CalendarView;
  referenceDate: Date;
}

export function OrderCalendar({ orders, view, referenceDate }: OrderCalendarProps) {
  return (
    <DataCalendar
      items={orders}
      dateAccessor={(o) => new Date(o.order_date)}
      idAccessor={(o) => o.id}
      renderMonthItem={(o) => <MonthItem order={o} />}
      renderWeekItem={(o) => <WeekItem order={o} />}
      renderDayItem={(o) => <DayItem order={o} />}
      renderDetail={(o) => <DetailContent order={o} />}
      detailTitle={(o) => `주문 ${o.order_number}`}
      view={view}
      referenceDate={referenceDate}
      basePath="/orders"
      tabParam="calendar"
    />
  );
}
```

**Step 2: Modify orders/page.tsx**

The orders page currently uses `<Tabs>` for status filtering. We need to add "캘린더" as a tab while keeping the existing status tabs for the list view.

Replace the entire orders page with:

```typescript
import Link from "next/link";
import { PlusCircle, File } from "lucide-react";

import { getOrderItems } from "@/lib/queries/orders";
import { getOrdersForCalendar } from "@/lib/queries/orders";
import { getProducts } from "@/lib/queries/products";
import { getHospitals } from "@/lib/queries/hospitals";
import { OrderTable } from "@/components/order-table";
import type { ProductOption } from "@/components/order-table";
import { OrderCalendar } from "@/components/order-calendar";
import { OrderFilters } from "@/components/order-filters";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RealtimeListener } from "@/components/realtime-listener";
import { parseCalendarParams, toLocalDateStr } from "@/lib/schedule-utils";

interface Props {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
    view?: string;
    date?: string;
    week?: string;
    month?: string;
  }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = params.tab === "calendar" ? "calendar" : "list";
  const page = parseInt(params.page || "1", 10);
  const status = params.status;
  const limit = 20;
  const offset = (page - 1) * limit;

  const [result, { products: allProducts }, { hospitals: allHospitals }] = await Promise.all([
    tab === "list"
      ? getOrderItems({ status, from: params.from, to: params.to, limit, offset })
          .catch(() => ({ items: [], total: 0 }))
      : Promise.resolve({ items: [], total: 0 }),
    getProducts({ limit: 1000 }).catch(() => ({ products: [], total: 0 })),
    getHospitals({ limit: 1000 }).catch(() => ({ hospitals: [], total: 0 })),
  ]);

  const productOptions: ProductOption[] = allProducts.map((p) => ({
    id: p.id, name: p.official_name,
  }));
  const hospitalOptions = allHospitals.map((h) => ({
    id: h.id, name: h.name,
  }));
  const totalPages = Math.max(1, Math.ceil(result.total / limit));

  // Calendar data
  let calendarOrders: import("@/lib/types").Order[] = [];
  let calView: import("@/lib/schedule-utils").CalendarView = "week";
  let calRef = new Date();

  if (tab === "calendar") {
    const calParams = parseCalendarParams(params);
    calView = calParams.view;
    calRef = calParams.referenceDate;
    const fromStr = toLocalDateStr(new Date(calParams.startMs));
    const toStr = toLocalDateStr(new Date(calParams.endMs));
    calendarOrders = await getOrdersForCalendar({ from: fromStr, to: toStr }).catch(() => []);
  }

  return (
    <>
      <RealtimeListener tables={["orders", "order_items"]} />
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">주문 관리</h1>
        {tab === "list" && (
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1">
              <File className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">내보내기</span>
            </Button>
            <Button size="sm" className="h-8 gap-1">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">주문 추가</span>
            </Button>
          </div>
        )}
      </div>

      <Tabs value={tab}>
        <TabsList>
          <TabsTrigger value="list" asChild>
            <Link href="/orders">목록</Link>
          </TabsTrigger>
          <TabsTrigger value="calendar" asChild>
            <Link href="/orders?tab=calendar">캘린더</Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {/* Sub-tabs for status filtering */}
          <Tabs defaultValue={status || "all"}>
            <TabsList>
              <TabsTrigger value="all" asChild><Link href="/orders">전체</Link></TabsTrigger>
              <TabsTrigger value="confirmed" asChild><Link href="/orders?status=confirmed">확인됨</Link></TabsTrigger>
              <TabsTrigger value="processing" asChild><Link href="/orders?status=processing">처리중</Link></TabsTrigger>
              <TabsTrigger value="delivered" asChild><Link href="/orders?status=delivered">배송완료</Link></TabsTrigger>
            </TabsList>
            <TabsContent value={status || "all"}>
              <Card>
                <CardHeader>
                  <CardTitle>주문 목록</CardTitle>
                  <CardDescription><OrderFilters /></CardDescription>
                </CardHeader>
                <CardContent>
                  <OrderTable items={result.items} products={productOptions} hospitals={hospitalOptions} />
                </CardContent>
                <CardFooter>
                  <Pagination currentPage={page} totalPages={totalPages} totalCount={result.total} />
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="calendar">
          <OrderCalendar orders={calendarOrders} view={calView} referenceDate={calRef} />
        </TabsContent>
      </Tabs>
    </>
  );
}
```

**Step 3: Verify build, Step 4: Commit**

```bash
git add apps/web/src/components/order-calendar.tsx apps/web/src/app/\(dashboard\)/orders/page.tsx
git commit -m "feat: add calendar tab to orders page with day/week/month views"
```

---

### Task 12: Final cleanup and build verification

**Files:**
- Possibly modify: `apps/web/src/lib/types.ts` (remove unused types)
- Possibly modify: `apps/web/src/lib/schedule-utils.ts` (remove unused exports)
- Possibly modify: `apps/web/src/lib/actions.ts` (clean unused imports)

**Step 1: Check for unused imports and types**

Run: `cd apps/web && npx next build 2>&1 | grep -i error`

Fix any remaining build errors (unused imports, missing types, etc.).

**Step 2: Verify the app runs**

Run: `cd apps/web && npm run dev`

Test these URLs manually:
- `/messages` — list view (unchanged)
- `/messages?tab=calendar` — calendar view (week default)
- `/messages?tab=calendar&view=month&month=2026-02` — month view
- `/messages?tab=calendar&view=day&date=2026-02-24` — day view
- `/orders` — list view (unchanged)
- `/orders?tab=calendar` — calendar view
- `/orders?tab=calendar&view=month` — month view

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: final cleanup — remove unused types, imports, and verify build"
```

---

### Task Summary

| # | Task | Creates/Modifies |
|---|------|-----------------|
| 1 | Remove calendar from sidebar | nav-items.ts |
| 2 | Delete old calendar code | 10 files deleted, actions.ts, types.ts, schedule-utils.ts |
| 3 | Calendar query functions | queries/messages.ts, queries/orders.ts |
| 4 | CalendarHeader component | data-calendar/calendar-header.tsx |
| 5 | MonthGrid component | data-calendar/month-grid.tsx |
| 6 | WeekGrid component | data-calendar/week-grid.tsx |
| 7 | DayList component | data-calendar/day-list.tsx |
| 8 | DetailPanel component | data-calendar/detail-panel.tsx |
| 9 | DataCalendar wrapper | data-calendar/data-calendar.tsx, index.ts |
| 10 | Messages calendar tab | message-calendar.tsx, messages/page.tsx |
| 11 | Orders calendar tab | order-calendar.tsx, orders/page.tsx |
| 12 | Final cleanup | various |

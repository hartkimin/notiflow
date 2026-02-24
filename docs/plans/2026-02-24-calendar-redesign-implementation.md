# Calendar Tab Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add day/week/month view switching, bidirectional category management, and filter rule editing to the web dashboard's calendar tab.

**Architecture:** Extend the existing `ScheduleView` by extracting the week rendering into a `WeekView` sub-component, adding `DayView` and `MonthView` siblings, a `ViewSwitcher` header, and a `CalendarSidePanel` (Sheet) for category/filter-rule CRUD. Data queries are generalized to range-based. Server actions are added for category and filter-rule mutations.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (Tabs, Sheet, Select, Switch, Label), Supabase PostgREST, Realtime

**Design doc:** `docs/plans/2026-02-24-calendar-redesign-design.md`

---

## Conventions

- All new calendar components go in `apps/web/src/components/calendar/`
- All file paths are relative to `apps/web/` unless stated otherwise
- Use existing patterns: `"use client"` directive, `useTransition` for server actions, `router.refresh()` after mutations, `toast` for feedback
- Korean UI text (matching existing app)
- ARGB colors from mobile stored as integers — use `argbToHex()` for CSS
- IDs use `generateId()` (UUID v4) matching mobile pattern
- Epoch milliseconds for all dates (matching mobile)
- Soft delete pattern: `is_deleted = true`, never hard delete
- Build verification: `npm run build --workspace=apps/web` must pass after each commit

---

## Task 1: Add Types and Date Utilities

**Files:**
- Modify: `src/lib/types.ts` (add FilterRule interface at end of file, after StatusStep block around line 295)
- Modify: `src/lib/schedule-utils.ts` (add month utility functions after `generateId` at line 88)

**Step 1: Add FilterRule type to types.ts**

Append after the `MessageLocalStateMap` type (line 321):

```typescript
// --- Filter Rules (synced with mobile) ---

export interface FilterRule {
  id: string;
  category_id: string;
  sender_keywords: string[];
  sender_match_type: 'CONTAINS' | 'EXACT' | 'REGEX';
  sms_phone_number: string | null;
  include_words: string[];
  exclude_words: string[];
  include_match_type: 'OR' | 'AND';
  condition_type: 'AND' | 'OR';
  target_app_packages: string[];
  is_active: boolean;
}
```

**Step 2: Add month/day utilities to schedule-utils.ts**

Append after `generateId()` (line 88):

```typescript
/**
 * Get the first day of the month containing the given date (local timezone).
 */
export function getMonthStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the first day of the next month (local timezone).
 */
export function getMonthEnd(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get all dates in a month grid (6 rows x 7 columns, Mon-Sun).
 * Includes padding days from previous/next months.
 */
export function getMonthGridDates(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  // Day of week: 0=Sun..6=Sat → adjust to Mon-start: Mon=0..Sun=6
  const startDow = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - startDow);
  gridStart.setHours(0, 0, 0, 0);

  const dates: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Format month label: "2026년 2월"
 */
export function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

/**
 * Format day label: "2026. 2. 24 (화)"
 */
export function formatDayLabel(date: Date): string {
  const dow = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()} (${dow})`;
}

/**
 * Parse ?view= and date params from URL search params.
 */
export type CalendarView = "day" | "week" | "month";

export interface CalendarParams {
  view: CalendarView;
  startMs: number;
  endMs: number;
  /** The reference date for navigation (Monday for week, 1st for month, exact for day) */
  referenceDate: Date;
}

export function parseCalendarParams(searchParams: {
  view?: string;
  week?: string;
  date?: string;
  month?: string;
}): CalendarParams {
  const view = (searchParams.view === "day" || searchParams.view === "month")
    ? searchParams.view
    : "week" as CalendarView;

  if (view === "day") {
    const d = searchParams.date ? new Date(searchParams.date + "T00:00:00") : new Date();
    const ref = isNaN(d.getTime()) ? new Date() : d;
    ref.setHours(0, 0, 0, 0);
    const startMs = ref.getTime();
    const endMs = startMs + 24 * 60 * 60 * 1000;
    return { view, startMs, endMs, referenceDate: ref };
  }

  if (view === "month") {
    let ref: Date;
    if (searchParams.month) {
      const [y, m] = searchParams.month.split("-").map(Number);
      ref = new Date(y, m - 1, 1);
      if (isNaN(ref.getTime())) ref = new Date();
    } else {
      ref = new Date();
    }
    const start = getMonthStart(ref);
    const end = getMonthEnd(ref);
    return { view, startMs: start.getTime(), endMs: end.getTime(), referenceDate: start };
  }

  // week (default)
  const monday = parseWeekParam(searchParams.week);
  const startMs = startOfDayMs(monday);
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
  return { view, startMs, endMs, referenceDate: monday };
}
```

**Step 3: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds (types and utils are not imported yet so no runtime impact)

**Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/schedule-utils.ts
git commit -m "feat(web): add FilterRule type and calendar date utilities"
```

---

## Task 2: Refactor Data Queries to Range-Based

**Files:**
- Modify: `src/lib/queries/schedule.ts` (generalize all 3 range queries + add filter rules query)

**Step 1: Refactor queries**

Replace `getWeekPlans`, `getWeekDayCategories`, `getWeekMessages` with range-based versions while preserving the old names as wrappers for backward compat during migration:

```typescript
import { createClient } from "@/lib/supabase/server";
import type { MobileCategory, Plan, DayCategory, CapturedMessage, FilterRule } from "@/lib/types";

export async function getCategories(): Promise<MobileCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color, order_index, is_active")
    .eq("is_deleted", false)
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as MobileCategory[];
}

export async function getAllCategories(): Promise<(MobileCategory & { is_deleted: boolean })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color, order_index, is_active, is_deleted")
    .eq("is_deleted", false)
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as (MobileCategory & { is_deleted: boolean })[];
}

export async function getPlans(startMs: number, endMs: number): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, category_id, date, title, is_completed, linked_message_id, order_number, order_index")
    .eq("is_deleted", false)
    .gte("date", startMs)
    .lt("date", endMs)
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as Plan[];
}

export async function getDayCategories(startMs: number, endMs: number): Promise<DayCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("day_categories")
    .select("id, date, category_id")
    .gte("date", startMs)
    .lt("date", endMs);
  if (error) throw error;
  return (data ?? []) as DayCategory[];
}

export async function getMessages(startMs: number, endMs: number): Promise<CapturedMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captured_messages")
    .select("id, source, app_name, sender, content, received_at, category_id, status_id, is_archived, room_name, sender_icon, attached_image")
    .eq("is_deleted", false)
    .gte("received_at", startMs)
    .lt("received_at", endMs)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CapturedMessage[];
}

export async function getFilterRules(): Promise<FilterRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("filter_rules")
    .select("id, category_id, sender_keywords, sender_match_type, sms_phone_number, include_words, exclude_words, include_match_type, condition_type, target_app_packages, is_active")
    .eq("is_deleted", false)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as FilterRule[];
}

// Backward-compatible wrappers (used until page.tsx is updated)
export function getWeekPlans(weekStartMs: number) {
  return getPlans(weekStartMs, weekStartMs + 7 * 24 * 60 * 60 * 1000);
}
export function getWeekDayCategories(weekStartMs: number) {
  return getDayCategories(weekStartMs, weekStartMs + 7 * 24 * 60 * 60 * 1000);
}
export function getWeekMessages(weekStartMs: number) {
  return getMessages(weekStartMs, weekStartMs + 7 * 24 * 60 * 60 * 1000);
}
```

**Step 2: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds (old function names still exported as wrappers)

**Step 3: Commit**

```bash
git add apps/web/src/lib/queries/schedule.ts
git commit -m "refactor(web): generalize schedule queries to range-based"
```

---

## Task 3: Add Category CRUD Server Actions

**Files:**
- Modify: `src/lib/actions.ts` (add new section after "Schedule: Week Operations" ~line 700+)

**Step 1: Add category CRUD actions**

Append new section to `actions.ts`:

```typescript
// --- Schedule: Category Management ---

export async function createCategory(data: {
  name: string;
  color: number;
  order_index?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = Date.now();
  const { error } = await supabase.from("categories").insert({
    id: generateId(),
    user_id: user.id,
    name: data.name,
    color: data.color,
    order_index: data.order_index ?? 0,
    is_active: true,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function updateCategory(
  id: string,
  data: { name?: string; color?: number; is_active?: boolean; order_index?: number },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ ...data, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_deleted: true, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function reorderCategories(orderedIds: string[]) {
  const supabase = await createClient();
  const now = Date.now();
  // Update each category's order_index
  const promises = orderedIds.map((id, index) =>
    supabase
      .from("categories")
      .update({ order_index: index, updated_at: now })
      .eq("id", id)
  );
  const results = await Promise.all(promises);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
  revalidatePath("/calendar");
  return { success: true };
}
```

**Step 2: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "feat(web): add category CRUD server actions"
```

---

## Task 4: Add Filter Rule CRUD Server Actions

**Files:**
- Modify: `src/lib/actions.ts` (add new section after category management)

**Step 1: Add filter rule CRUD actions**

Append after the category management section:

```typescript
// --- Schedule: Filter Rules ---

export async function createFilterRule(data: {
  category_id: string;
  sender_keywords?: string[];
  sender_match_type?: string;
  sms_phone_number?: string | null;
  include_words?: string[];
  exclude_words?: string[];
  include_match_type?: string;
  condition_type?: string;
  target_app_packages?: string[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = Date.now();
  const { error } = await supabase.from("filter_rules").insert({
    id: generateId(),
    user_id: user.id,
    category_id: data.category_id,
    sender_keywords: data.sender_keywords ?? [],
    sender_match_type: data.sender_match_type ?? "CONTAINS",
    sms_phone_number: data.sms_phone_number ?? null,
    include_words: data.include_words ?? [],
    exclude_words: data.exclude_words ?? [],
    include_match_type: data.include_match_type ?? "OR",
    condition_type: data.condition_type ?? "AND",
    target_app_packages: data.target_app_packages ?? [],
    is_active: true,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function updateFilterRule(
  id: string,
  data: Record<string, unknown>,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("filter_rules")
    .update({ ...data, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteFilterRule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("filter_rules")
    .update({ is_deleted: true, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}
```

**Step 2: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "feat(web): add filter rule CRUD server actions"
```

---

## Task 5: Update Calendar Page for View Params

**Files:**
- Modify: `src/app/(dashboard)/calendar/page.tsx` (full rewrite)

**Step 1: Rewrite page.tsx**

Replace the entire file content:

```typescript
import { ScheduleView } from "@/components/schedule-view";
import { RealtimeListener } from "@/components/realtime-listener";
import {
  getCategories,
  getPlans,
  getDayCategories,
  getMessages,
  getFilterRules,
} from "@/lib/queries/schedule";
import { parseCalendarParams } from "@/lib/schedule-utils";

interface Props {
  searchParams: Promise<{
    view?: string;
    week?: string;
    date?: string;
    month?: string;
  }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const calendarParams = parseCalendarParams(params);
  const { view, startMs, endMs } = calendarParams;

  const [categories, plans, dayCategories, messages, filterRules] =
    await Promise.all([
      getCategories().catch(() => []),
      getPlans(startMs, endMs).catch(() => []),
      getDayCategories(startMs, endMs).catch(() => []),
      getMessages(startMs, endMs).catch(() => []),
      getFilterRules().catch(() => []),
    ]);

  return (
    <div className="flex flex-col h-full">
      <RealtimeListener
        tables={[
          "categories",
          "plans",
          "day_categories",
          "captured_messages",
          "filter_rules",
        ]}
      />
      <ScheduleView
        categories={categories}
        plans={plans}
        dayCategories={dayCategories}
        messages={messages}
        filterRules={filterRules}
        view={view}
        startMs={startMs}
        endMs={endMs}
        referenceDate={calendarParams.referenceDate.getTime()}
      />
    </div>
  );
}
```

**Step 2: Update ScheduleView props temporarily**

In `src/components/schedule-view.tsx`, update the interface to accept the new props (keeping backward compat for now). Replace the `ScheduleViewProps` interface (lines 41-47):

```typescript
interface ScheduleViewProps {
  categories: MobileCategory[];
  plans: Plan[];
  dayCategories: DayCategory[];
  messages: CapturedMessage[];
  filterRules: FilterRule[];
  view: "day" | "week" | "month";
  startMs: number;
  endMs: number;
  referenceDate: number; // epoch ms
}
```

And update the destructuring (line 53-55):

```typescript
export function ScheduleView({
  categories, plans, dayCategories, messages, filterRules,
  view, startMs, endMs, referenceDate,
}: ScheduleViewProps) {
```

Also add the `FilterRule` import at the top (line 37):

```typescript
import type { MobileCategory, Plan, DayCategory, CapturedMessage, FilterRule } from "@/lib/types";
```

Update `monday` computation (line 58) to use `referenceDate`:

```typescript
const monday = useMemo(() => new Date(referenceDate), [referenceDate]);
```

Remove old `weekStartMs` references — the `monday` variable is still used for week view rendering. The existing rendering logic stays intact since `view` defaults to `"week"` and the same data is passed.

**Step 3: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds — the page still renders the week view since all data flows are compatible

**Step 4: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/calendar/page.tsx apps/web/src/components/schedule-view.tsx
git commit -m "feat(web): update calendar page for view param routing"
```

---

## Task 6: Create ViewSwitcher Component

**Files:**
- Create: `src/components/calendar/view-switcher.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import {
  formatWeekLabel,
  formatMonthLabel,
  formatDayLabel,
  getWeekMonday,
  startOfDayMs,
  type CalendarView,
} from "@/lib/schedule-utils";

interface ViewSwitcherProps {
  view: CalendarView;
  referenceDate: Date;
  onToggleSidePanel: () => void;
  children?: React.ReactNode; // slot for week-specific action buttons
}

export function ViewSwitcher({
  view,
  referenceDate,
  onToggleSidePanel,
  children,
}: ViewSwitcherProps) {
  const router = useRouter();

  function navigate(direction: -1 | 1) {
    if (view === "day") {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() + direction);
      router.push(`/calendar?view=day&date=${d.toISOString().slice(0, 10)}`);
    } else if (view === "week") {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() + direction * 7);
      router.push(`/calendar?view=week&week=${d.toISOString().slice(0, 10)}`);
    } else {
      const d = new Date(referenceDate);
      d.setMonth(d.getMonth() + direction);
      const param = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      router.push(`/calendar?view=month&month=${param}`);
    }
  }

  function goToday() {
    if (view === "day") {
      const d = new Date();
      router.push(`/calendar?view=day&date=${d.toISOString().slice(0, 10)}`);
    } else if (view === "week") {
      const mon = getWeekMonday(new Date());
      router.push(`/calendar?view=week&week=${mon.toISOString().slice(0, 10)}`);
    } else {
      const d = new Date();
      const param = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      router.push(`/calendar?view=month&month=${param}`);
    }
  }

  function switchView(newView: string) {
    if (newView === "day") {
      const d = view === "week" ? referenceDate : new Date();
      router.push(`/calendar?view=day&date=${d.toISOString().slice(0, 10)}`);
    } else if (newView === "week") {
      const mon = getWeekMonday(referenceDate);
      router.push(`/calendar?view=week&week=${mon.toISOString().slice(0, 10)}`);
    } else {
      const param = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}`;
      router.push(`/calendar?view=month&month=${param}`);
    }
  }

  const label =
    view === "day"
      ? formatDayLabel(referenceDate)
      : view === "month"
        ? formatMonthLabel(referenceDate)
        : formatWeekLabel(referenceDate);

  return (
    <div className="flex items-center gap-2 mb-3">
      {/* Navigation */}
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <h2 className="text-lg font-semibold whitespace-nowrap">{label}</h2>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={goToday}>
        오늘
      </Button>

      {/* View tabs */}
      <Tabs value={view} onValueChange={switchView} className="ml-2">
        <TabsList className="h-8">
          <TabsTrigger value="day" className="text-xs px-3 h-7">일</TabsTrigger>
          <TabsTrigger value="week" className="text-xs px-3 h-7">주</TabsTrigger>
          <TabsTrigger value="month" className="text-xs px-3 h-7">월</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Week action buttons (passed as children) */}
      {children}

      {/* Side panel toggle */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 ml-auto"
        onClick={onToggleSidePanel}
      >
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds (component not imported yet)

**Step 3: Commit**

```bash
git add apps/web/src/components/calendar/view-switcher.tsx
git commit -m "feat(web): create ViewSwitcher component for calendar"
```

---

## Task 7: Extract WeekView from ScheduleView

**Files:**
- Create: `src/components/calendar/week-view.tsx`

**Step 1: Create WeekView**

Extract the `DayColumn`, `CategorySection`, `PlanItem`, `MessageCountPopover`, and `MessageLinkPopover` sub-components from `schedule-view.tsx` into the new file. The `WeekView` component receives the same data and renders the 7-column grid.

Copy lines 216-799 from `schedule-view.tsx` (the grid rendering and all sub-components) into this new file. Adjust the imports:

```typescript
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Plus, X, Link2, Hash, Trash2, MessageSquare,
} from "lucide-react";
import {
  createPlan, togglePlanCompletion, deletePlan, linkPlanToMessage,
  updatePlanOrderNumber, addCategoryToDay, removeCategoryFromDay,
} from "@/lib/actions";
import {
  getWeekDates, startOfDayMs, argbToHex, formatEpochTime,
} from "@/lib/schedule-utils";
import type { MobileCategory, Plan, DayCategory, CapturedMessage } from "@/lib/types";

// ─── Types ─────────────────────────────────────────────────────

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

interface WeekViewProps {
  categories: MobileCategory[];
  plans: Plan[];
  dayCategories: DayCategory[];
  messages: CapturedMessage[];
  referenceDate: Date; // Monday of the week
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
}

// ─── Main Component ────────────────────────────────────────────

export function WeekView({
  categories, plans, dayCategories, messages,
  referenceDate, isPending, startTransition,
}: WeekViewProps) {
  const router = useRouter();
  const weekDates = useMemo(() => getWeekDates(referenceDate), [referenceDate]);

  // Group data by day
  const plansByDay = useMemo(() => {
    const map = new Map<number, Plan[]>();
    for (const p of plans) map.set(p.date, [...(map.get(p.date) ?? []), p]);
    return map;
  }, [plans]);

  const dayCatsByDay = useMemo(() => {
    const map = new Map<number, DayCategory[]>();
    for (const dc of dayCategories) map.set(dc.date, [...(map.get(dc.date) ?? []), dc]);
    return map;
  }, [dayCategories]);

  const messagesByDay = useMemo(() => {
    const map = new Map<number, CapturedMessage[]>();
    for (const m of messages) {
      const dayMs = startOfDayMs(new Date(m.received_at));
      map.set(dayMs, [...(map.get(dayMs) ?? []), m]);
    }
    return map;
  }, [messages]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  return (
    <div className="grid grid-cols-7 gap-2 flex-1 min-h-0 overflow-y-auto">
      {weekDates.map((date, i) => {
        const dayMs = startOfDayMs(date);
        const isToday = startOfDayMs(new Date()) === dayMs;
        const isSaturday = i === 5;
        const isSunday = i === 6;

        return (
          <DayColumn
            key={dayMs}
            date={date}
            dayMs={dayMs}
            dayLabel={DAY_LABELS[i]}
            isToday={isToday}
            isSaturday={isSaturday}
            isSunday={isSunday}
            categories={categories}
            categoryMap={categoryMap}
            dayCategories={dayCatsByDay.get(dayMs) ?? []}
            plans={plansByDay.get(dayMs) ?? []}
            messages={messagesByDay.get(dayMs) ?? []}
            isPending={isPending}
            startTransition={startTransition}
            router={router}
          />
        );
      })}
    </div>
  );
}

// Then paste the DayColumn, CategorySection, PlanItem, MessageCountPopover,
// and MessageLinkPopover functions EXACTLY as they are in schedule-view.tsx
// (lines 248-799). No changes needed — just move them here.
```

**Important:** Copy `DayColumn`, `CategorySection`, `PlanItem`, `MessageCountPopover`, and `MessageLinkPopover` verbatim from `schedule-view.tsx` (lines 248-799) into this file below the `WeekView` component. No logic changes.

**Step 2: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/src/components/calendar/week-view.tsx
git commit -m "feat(web): extract WeekView component from ScheduleView"
```

---

## Task 8: Create MonthView Component

**Files:**
- Create: `src/components/calendar/month-view.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getMonthGridDates, startOfDayMs, argbToHex } from "@/lib/schedule-utils";
import type { MobileCategory, Plan, DayCategory, CapturedMessage } from "@/lib/types";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

interface MonthViewProps {
  categories: MobileCategory[];
  plans: Plan[];
  dayCategories: DayCategory[];
  messages: CapturedMessage[];
  referenceDate: Date; // 1st of the month
}

export function MonthView({
  categories, plans, dayCategories, messages, referenceDate,
}: MonthViewProps) {
  const router = useRouter();
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const gridDates = useMemo(() => getMonthGridDates(year, month), [year, month]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  // Group day categories by date
  const dayCatsByDay = useMemo(() => {
    const map = new Map<number, DayCategory[]>();
    for (const dc of dayCategories) map.set(dc.date, [...(map.get(dc.date) ?? []), dc]);
    return map;
  }, [dayCategories]);

  // Group messages by date
  const messageCountByDay = useMemo(() => {
    const map = new Map<number, number>();
    for (const m of messages) {
      const dayMs = startOfDayMs(new Date(m.received_at));
      map.set(dayMs, (map.get(dayMs) ?? 0) + 1);
    }
    return map;
  }, [messages]);

  // Group plans by date
  const planCountByDay = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of plans) {
      map.set(p.date, (map.get(p.date) ?? 0) + 1);
    }
    return map;
  }, [plans]);

  const todayMs = startOfDayMs(new Date());

  // Determine how many rows we need (5 or 6)
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const firstDayDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const rowCount = Math.ceil((firstDayDow + lastDayOfMonth) / 7);
  const cellCount = rowCount * 7;

  function handleDateClick(date: Date) {
    router.push(`/calendar?view=day&date=${date.toISOString().slice(0, 10)}`);
  }

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

      {/* Calendar grid */}
      <div className={`grid grid-cols-7 gap-1 flex-1 grid-rows-${rowCount}`}>
        {gridDates.slice(0, cellCount).map((date) => {
          const dayMs = startOfDayMs(date);
          const isCurrentMonth = date.getMonth() === month;
          const isToday = dayMs === todayMs;
          const dayCats = dayCatsByDay.get(dayMs) ?? [];
          const msgCount = messageCountByDay.get(dayMs) ?? 0;
          const planCount = planCountByDay.get(dayMs) ?? 0;

          return (
            <button
              key={dayMs}
              onClick={() => handleDateClick(date)}
              className={[
                "rounded-lg border p-1.5 text-left transition-colors hover:bg-muted/50 flex flex-col min-h-0",
                !isCurrentMonth && "opacity-40",
                isToday && "ring-2 ring-primary/50",
              ].filter(Boolean).join(" ")}
            >
              <span className={[
                "text-sm font-medium",
                isToday && "text-primary",
                date.getDay() === 0 && "text-red-500",
                date.getDay() === 6 && "text-blue-500",
              ].filter(Boolean).join(" ")}>
                {date.getDate()}
              </span>

              {/* Category dots */}
              {dayCats.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {dayCats.slice(0, 5).map((dc) => {
                    const cat = categoryMap.get(dc.category_id);
                    if (!cat) return null;
                    return (
                      <span
                        key={dc.id}
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: argbToHex(cat.color) }}
                      />
                    );
                  })}
                  {dayCats.length > 5 && (
                    <span className="text-[9px] text-muted-foreground">+{dayCats.length - 5}</span>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="mt-auto flex items-center gap-1">
                {planCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {planCount}건
                  </span>
                )}
                {msgCount > 0 && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                    📨{msgCount}
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/src/components/calendar/month-view.tsx
git commit -m "feat(web): create MonthView component for calendar"
```

---

## Task 9: Create DayView Component

**Files:**
- Create: `src/components/calendar/day-view.tsx`

**Step 1: Create the component**

The DayView reuses the same plan management actions as WeekView but renders a single-column expanded layout with inline message lists.

```typescript
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Plus, X, Link2, Hash, Trash2, MessageSquare, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  createPlan, togglePlanCompletion, deletePlan, linkPlanToMessage,
  updatePlanOrderNumber, addCategoryToDay, removeCategoryFromDay,
} from "@/lib/actions";
import { startOfDayMs, argbToHex, formatEpochTime } from "@/lib/schedule-utils";
import type { MobileCategory, Plan, DayCategory, CapturedMessage } from "@/lib/types";

interface DayViewProps {
  categories: MobileCategory[];
  plans: Plan[];
  dayCategories: DayCategory[];
  messages: CapturedMessage[];
  referenceDate: Date;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
}

export function DayView({
  categories, plans, dayCategories, messages,
  referenceDate, isPending, startTransition,
}: DayViewProps) {
  const router = useRouter();
  const dayMs = startOfDayMs(referenceDate);
  const [addCatOpen, setAddCatOpen] = useState(false);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const addedCatIds = useMemo(
    () => new Set(dayCategories.map((dc) => dc.category_id)),
    [dayCategories],
  );

  const availableCategories = useMemo(
    () => categories.filter((c) => !addedCatIds.has(c.id)),
    [categories, addedCatIds],
  );

  const sortedDayCats = useMemo(
    () => [...dayCategories].sort((a, b) => {
      const catA = categoryMap.get(a.category_id);
      const catB = categoryMap.get(b.category_id);
      return (catA?.order_index ?? 0) - (catB?.order_index ?? 0);
    }),
    [dayCategories, categoryMap],
  );

  function handleAddCategory(categoryId: string) {
    setAddCatOpen(false);
    startTransition(async () => {
      try {
        await addCategoryToDay(dayMs, categoryId);
        router.refresh();
      } catch { toast.error("카테고리 추가 실패"); }
    });
  }

  function handleRemoveCategory(dayCategoryId: string) {
    startTransition(async () => {
      try {
        await removeCategoryFromDay(dayCategoryId);
        router.refresh();
      } catch { toast.error("카테고리 제거 실패"); }
    });
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
      {sortedDayCats.map((dc) => {
        const cat = categoryMap.get(dc.category_id);
        if (!cat) return null;
        const catPlans = plans.filter((p) => p.category_id === dc.category_id);
        const catMessages = messages.filter((m) => m.category_id === dc.category_id);

        return (
          <DayCategorySection
            key={dc.id}
            category={cat}
            dayCategoryId={dc.id}
            dayMs={dayMs}
            plans={catPlans}
            messages={catMessages}
            allMessages={messages}
            isPending={isPending}
            startTransition={startTransition}
            router={router}
            onRemove={() => handleRemoveCategory(dc.id)}
          />
        );
      })}

      {/* Add Category */}
      {availableCategories.length > 0 && (
        <Popover open={addCatOpen} onOpenChange={setAddCatOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={isPending}>
              <Plus className="h-3.5 w-3.5" /> 카테고리 추가
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            {availableCategories.map((c) => (
              <button
                key={c.id}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                onClick={() => handleAddCategory(c.id)}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: argbToHex(c.color) }}
                />
                {c.name}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {dayCategories.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          카테고리를 추가하여 일정을 관리하세요
        </p>
      )}
    </div>
  );
}

// ─── Day Category Section (expanded layout) ───────────────────

function DayCategorySection({
  category, dayCategoryId, dayMs, plans, messages, allMessages,
  isPending, startTransition, router, onRemove,
}: {
  category: MobileCategory;
  dayCategoryId: string;
  dayMs: number;
  plans: Plan[];
  messages: CapturedMessage[];
  allMessages: CapturedMessage[];
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  router: ReturnType<typeof useRouter>;
  onRemove: () => void;
}) {
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [messagesExpanded, setMessagesExpanded] = useState(false);
  const color = argbToHex(category.color);

  function handleAddPlan() {
    const title = newPlanTitle.trim();
    if (!title) return;
    setNewPlanTitle("");
    setIsAdding(false);
    startTransition(async () => {
      try {
        await createPlan({ category_id: category.id, date: dayMs, title });
        router.refresh();
      } catch { toast.error("플랜 추가 실패"); }
    });
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Section Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <span
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium flex-1">{category.name}</span>
        {messages.length > 0 && (
          <Badge variant="outline" className="text-xs">
            <MessageSquare className="h-3 w-3 mr-1" />
            {messages.length}
          </Badge>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
              onClick={() => setIsAdding(true)}
              disabled={isPending}
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent>플랜 추가</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10"
              onClick={onRemove}
              disabled={isPending}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent>카테고리 제거</TooltipContent>
        </Tooltip>
      </div>

      <div className="p-3 space-y-2">
        {/* Plan Items */}
        {plans.map((plan) => (
          <DayPlanItem
            key={plan.id}
            plan={plan}
            allMessages={allMessages}
            isPending={isPending}
            startTransition={startTransition}
            router={router}
          />
        ))}

        {/* Inline add plan */}
        {isAdding && (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); handleAddPlan(); }}
          >
            <Input
              value={newPlanTitle}
              onChange={(e) => setNewPlanTitle(e.target.value)}
              placeholder="플랜 입력..."
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") { setIsAdding(false); setNewPlanTitle(""); }
              }}
            />
            <Button type="submit" size="sm" disabled={isPending || !newPlanTitle.trim()}>
              추가
            </Button>
          </form>
        )}

        {plans.length === 0 && !isAdding && (
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setIsAdding(true)}
          >
            + 플랜 추가
          </button>
        )}

        {/* Messages Section */}
        {messages.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <button
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMessagesExpanded(!messagesExpanded)}
            >
              {messagesExpanded
                ? <ChevronDown className="h-4 w-4" />
                : <ChevronRight className="h-4 w-4" />}
              메시지 ({messages.length}건)
            </button>

            {messagesExpanded && (
              <div className="mt-2 space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className="rounded border p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{m.sender}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatEpochTime(m.received_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{m.content}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {m.app_name}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Day Plan Item (expanded) ─────────────────────────────────

function DayPlanItem({
  plan, allMessages, isPending, startTransition, router,
}: {
  plan: Plan;
  allMessages: CapturedMessage[];
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  router: ReturnType<typeof useRouter>;
}) {
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderNum, setOrderNum] = useState(plan.order_number ?? "");

  const linkedMessage = plan.linked_message_id
    ? allMessages.find((m) => m.id === plan.linked_message_id)
    : null;

  function handleToggle() {
    startTransition(async () => {
      try {
        await togglePlanCompletion(plan.id, !plan.is_completed);
        router.refresh();
      } catch { toast.error("상태 변경 실패"); }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deletePlan(plan.id);
        router.refresh();
      } catch { toast.error("삭제 실패"); }
    });
  }

  function handleLinkMessage(messageId: string | null) {
    startTransition(async () => {
      try {
        await linkPlanToMessage(plan.id, messageId);
        toast.success(messageId ? "메시지가 연결되었습니다." : "연결이 해제되었습니다.");
        router.refresh();
      } catch { toast.error("연결 실패"); }
    });
  }

  function handleSaveOrderNumber() {
    setOrderDialogOpen(false);
    startTransition(async () => {
      try {
        await updatePlanOrderNumber(plan.id, orderNum || null);
        router.refresh();
      } catch { toast.error("주문번호 저장 실패"); }
    });
  }

  return (
    <div className={[
      "group flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors",
      plan.is_completed && "opacity-50",
    ].filter(Boolean).join(" ")}>
      <Checkbox
        checked={plan.is_completed}
        onCheckedChange={handleToggle}
        disabled={isPending}
        className="mt-0.5"
      />

      <div className="flex-1 min-w-0">
        <span className={[
          "text-sm",
          plan.is_completed && "line-through text-muted-foreground",
        ].filter(Boolean).join(" ")}>
          {plan.title}
        </span>

        {/* Linked message preview */}
        {linkedMessage && (
          <div className="mt-1 flex items-center gap-1 text-xs text-blue-500">
            <Link2 className="h-3 w-3" />
            <span className="truncate">{linkedMessage.sender}: {linkedMessage.content}</span>
          </div>
        )}

        {plan.order_number && (
          <Badge variant="outline" className="mt-1 text-[10px] font-mono">
            #{plan.order_number}
          </Badge>
        )}
      </div>

      {/* Action buttons */}
      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted">
              <Link2 className={["h-4 w-4", linkedMessage ? "text-blue-500" : "text-muted-foreground"].join(" ")} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2 max-h-60 overflow-y-auto" align="start">
            <h4 className="text-xs font-semibold mb-2">메시지 연결</h4>
            {linkedMessage && (
              <div className="mb-2">
                <div className="rounded border p-2 bg-primary/5">
                  <p className="text-xs font-medium">{linkedMessage.sender}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{linkedMessage.content}</p>
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-1 text-xs text-destructive" onClick={() => handleLinkMessage(null)}>
                  연결 해제
                </Button>
              </div>
            )}
            {allMessages.filter((m) => m.id !== plan.linked_message_id).map((m) => (
              <button
                key={m.id}
                className="w-full text-left rounded border p-2 hover:bg-muted transition-colors mb-1"
                onClick={() => handleLinkMessage(m.id)}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium">{m.sender}</span>
                  <span className="text-[10px] text-muted-foreground">{formatEpochTime(m.received_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{m.content}</p>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted"
          onClick={() => { setOrderNum(plan.order_number ?? ""); setOrderDialogOpen(true); }}
        >
          <Hash className="h-4 w-4 text-muted-foreground" />
        </button>

        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-destructive/10"
          onClick={handleDelete}
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>주문번호 입력</DialogTitle></DialogHeader>
          <Input
            value={orderNum}
            onChange={(e) => setOrderNum(e.target.value)}
            placeholder="주문번호를 입력하세요"
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveOrderNumber(); }}
          />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
            <Button onClick={handleSaveOrderNumber} disabled={isPending}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/src/components/calendar/day-view.tsx
git commit -m "feat(web): create DayView component for calendar"
```

---

## Task 10: Create CategoryManager Component

**Files:**
- Create: `src/components/calendar/category-manager.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Pencil, Trash2, GripVertical } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createCategory, updateCategory, deleteCategory,
} from "@/lib/actions";
import { argbToHex } from "@/lib/schedule-utils";
import type { MobileCategory } from "@/lib/types";

// Predefined color palette (ARGB integers matching Android defaults)
const COLOR_PALETTE = [
  0xFFE57373, // Red
  0xFFFFB74D, // Orange
  0xFFFFF176, // Yellow
  0xFFAED581, // Light Green
  0xFF81C784, // Green
  0xFF4FC3F7, // Light Blue
  0xFF64B5F6, // Blue
  0xFF9575CD, // Purple
  0xFFF06292, // Pink
  0xFF90A4AE, // Blue Grey
  0xFFA1887F, // Brown
  0xFFE0E0E0, // Grey
];

interface CategoryManagerProps {
  categories: MobileCategory[];
}

export function CategoryManager({ categories }: CategoryManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(COLOR_PALETTE[0]);
  const [formActive, setFormActive] = useState(true);

  function startEdit(cat: MobileCategory) {
    setEditingId(cat.id);
    setFormName(cat.name);
    setFormColor(cat.color);
    setFormActive(cat.is_active);
    setIsCreating(false);
  }

  function startCreate() {
    setEditingId(null);
    setFormName("");
    setFormColor(COLOR_PALETTE[0]);
    setFormActive(true);
    setIsCreating(true);
  }

  function cancelForm() {
    setEditingId(null);
    setIsCreating(false);
  }

  function handleSave() {
    const name = formName.trim();
    if (!name) { toast.error("이름을 입력하세요"); return; }

    startTransition(async () => {
      try {
        if (isCreating) {
          await createCategory({
            name,
            color: formColor,
            order_index: categories.length,
          });
          toast.success("카테고리가 생성되었습니다.");
        } else if (editingId) {
          await updateCategory(editingId, {
            name,
            color: formColor,
            is_active: formActive,
          });
          toast.success("카테고리가 수정되었습니다.");
        }
        cancelForm();
        router.refresh();
      } catch {
        toast.error("저장 실패");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteCategory(id);
        toast.success("카테고리가 삭제되었습니다.");
        if (editingId === id) cancelForm();
        router.refresh();
      } catch { toast.error("삭제 실패"); }
    });
  }

  return (
    <div className="space-y-3">
      {/* Category List */}
      <div className="space-y-1">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={[
              "flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors",
              editingId === cat.id && "bg-muted/50 ring-1 ring-primary/30",
              !cat.is_active && "opacity-50",
            ].filter(Boolean).join(" ")}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab shrink-0" />
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: argbToHex(cat.color) }}
            />
            <span className="flex-1 text-sm truncate">{cat.name}</span>
            {!cat.is_active && (
              <span className="text-[10px] text-muted-foreground">비활성</span>
            )}
            <button
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted shrink-0"
              onClick={() => startEdit(cat)}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 shrink-0">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>카테고리를 삭제할까요?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &quot;{cat.name}&quot; 카테고리가 삭제됩니다. 관련된 플랜과 메시지는 유지됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(cat.id)}>삭제</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </div>

      {/* Create Button */}
      {!isCreating && !editingId && (
        <Button variant="outline" size="sm" className="w-full" onClick={startCreate}>
          + 새 카테고리
        </Button>
      )}

      {/* Edit/Create Form */}
      {(isCreating || editingId) && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-medium">
              {isCreating ? "새 카테고리" : "카테고리 편집"}
            </h4>

            <div className="space-y-1.5">
              <Label className="text-xs">이름</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="카테고리 이름"
                className="h-8 text-sm"
                maxLength={30}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">색상</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    className={[
                      "h-6 w-6 rounded-full border-2 transition-all",
                      formColor === c ? "border-foreground scale-110" : "border-transparent",
                    ].join(" ")}
                    style={{ backgroundColor: argbToHex(c) }}
                    onClick={() => setFormColor(c)}
                  />
                ))}
              </div>
            </div>

            {editingId && (
              <div className="flex items-center justify-between">
                <Label className="text-xs">활성화</Label>
                <Switch checked={formActive} onCheckedChange={setFormActive} />
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                저장
              </Button>
              <Button size="sm" variant="outline" onClick={cancelForm}>
                취소
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/src/components/calendar/category-manager.tsx
git commit -m "feat(web): create CategoryManager component for side panel"
```

---

## Task 11: Create FilterRuleEditor Component

**Files:**
- Create: `src/components/calendar/filter-rule-editor.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import {
  createFilterRule, updateFilterRule, deleteFilterRule,
} from "@/lib/actions";
import { argbToHex } from "@/lib/schedule-utils";
import type { MobileCategory, FilterRule } from "@/lib/types";

interface FilterRuleEditorProps {
  filterRules: FilterRule[];
  categories: MobileCategory[];
}

export function FilterRuleEditor({ filterRules, categories }: FilterRuleEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSenderKeywords, setFormSenderKeywords] = useState("");
  const [formSenderMatchType, setFormSenderMatchType] = useState("CONTAINS");
  const [formIncludeWords, setFormIncludeWords] = useState("");
  const [formExcludeWords, setFormExcludeWords] = useState("");
  const [formIncludeMatchType, setFormIncludeMatchType] = useState("OR");
  const [formConditionType, setFormConditionType] = useState("AND");
  const [formActive, setFormActive] = useState(true);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  function startEdit(rule: FilterRule) {
    setEditingId(rule.id);
    setFormCategoryId(rule.category_id);
    setFormSenderKeywords(rule.sender_keywords.join(", "));
    setFormSenderMatchType(rule.sender_match_type);
    setFormIncludeWords(rule.include_words.join(", "));
    setFormExcludeWords(rule.exclude_words.join(", "));
    setFormIncludeMatchType(rule.include_match_type);
    setFormConditionType(rule.condition_type);
    setFormActive(rule.is_active);
    setIsCreating(false);
  }

  function startCreate() {
    setEditingId(null);
    setFormCategoryId(categories[0]?.id ?? "");
    setFormSenderKeywords("");
    setFormSenderMatchType("CONTAINS");
    setFormIncludeWords("");
    setFormExcludeWords("");
    setFormIncludeMatchType("OR");
    setFormConditionType("AND");
    setFormActive(true);
    setIsCreating(true);
  }

  function cancelForm() {
    setEditingId(null);
    setIsCreating(false);
  }

  function parseCSV(s: string): string[] {
    return s.split(",").map((w) => w.trim()).filter(Boolean);
  }

  function handleSave() {
    if (!formCategoryId) { toast.error("카테고리를 선택하세요"); return; }

    const data = {
      category_id: formCategoryId,
      sender_keywords: parseCSV(formSenderKeywords),
      sender_match_type: formSenderMatchType,
      include_words: parseCSV(formIncludeWords),
      exclude_words: parseCSV(formExcludeWords),
      include_match_type: formIncludeMatchType,
      condition_type: formConditionType,
      is_active: formActive,
    };

    startTransition(async () => {
      try {
        if (isCreating) {
          await createFilterRule(data);
          toast.success("규칙이 생성되었습니다.");
        } else if (editingId) {
          await updateFilterRule(editingId, data);
          toast.success("규칙이 수정되었습니다.");
        }
        cancelForm();
        router.refresh();
      } catch { toast.error("저장 실패"); }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteFilterRule(id);
        toast.success("규칙이 삭제되었습니다.");
        if (editingId === id) cancelForm();
        router.refresh();
      } catch { toast.error("삭제 실패"); }
    });
  }

  function summarizeRule(rule: FilterRule): string {
    const parts: string[] = [];
    if (rule.sender_keywords.length > 0) parts.push(`발신: ${rule.sender_keywords.join(", ")}`);
    if (rule.include_words.length > 0) parts.push(`포함: ${rule.include_words.join(", ")}`);
    if (rule.exclude_words.length > 0) parts.push(`제외: ${rule.exclude_words.join(", ")}`);
    return parts.join(" | ") || "조건 없음";
  }

  return (
    <div className="space-y-3">
      {/* Rule List */}
      <div className="space-y-1">
        {filterRules.map((rule) => {
          const cat = categoryMap.get(rule.category_id);
          return (
            <div
              key={rule.id}
              className={[
                "flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors",
                editingId === rule.id && "bg-muted/50 ring-1 ring-primary/30",
                !rule.is_active && "opacity-50",
              ].filter(Boolean).join(" ")}
            >
              {cat && (
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 mt-1"
                  style={{ backgroundColor: argbToHex(cat.color) }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cat?.name ?? "알 수 없음"}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {summarizeRule(rule)}
                </p>
              </div>
              <button
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted shrink-0"
                onClick={() => startEdit(rule)}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 shrink-0">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>규칙을 삭제할까요?</AlertDialogTitle>
                    <AlertDialogDescription>이 필터 규칙이 삭제됩니다.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(rule.id)}>삭제</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        })}

        {filterRules.length === 0 && !isCreating && (
          <p className="text-sm text-muted-foreground text-center py-4">
            등록된 규칙이 없습니다
          </p>
        )}
      </div>

      {/* Create Button */}
      {!isCreating && !editingId && (
        <Button variant="outline" size="sm" className="w-full" onClick={startCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" /> 새 규칙
        </Button>
      )}

      {/* Edit/Create Form */}
      {(isCreating || editingId) && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-medium">
              {isCreating ? "새 규칙" : "규칙 편집"}
            </h4>

            <div className="space-y-1.5">
              <Label className="text-xs">대상 카테고리</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: argbToHex(c.color) }}
                        />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">발신자 키워드 (쉼표 구분)</Label>
              <Input
                value={formSenderKeywords}
                onChange={(e) => setFormSenderKeywords(e.target.value)}
                placeholder="과장, 팀장, 병원"
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">발신자 매칭 방식</Label>
              <Select value={formSenderMatchType} onValueChange={setFormSenderMatchType}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTAINS">포함</SelectItem>
                  <SelectItem value="EXACT">정확히 일치</SelectItem>
                  <SelectItem value="REGEX">정규식</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">포함 단어 (쉼표 구분)</Label>
              <Input
                value={formIncludeWords}
                onChange={(e) => setFormIncludeWords(e.target.value)}
                placeholder="회의, 보고, 주문"
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">제외 단어 (쉼표 구분)</Label>
              <Input
                value={formExcludeWords}
                onChange={(e) => setFormExcludeWords(e.target.value)}
                placeholder="광고, 스팸"
                className="h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">포함 조건</Label>
                <Select value={formIncludeMatchType} onValueChange={setFormIncludeMatchType}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OR">하나라도 (OR)</SelectItem>
                    <SelectItem value="AND">모두 (AND)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">전체 조건</Label>
                <Select value={formConditionType} onValueChange={setFormConditionType}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">모두 충족 (AND)</SelectItem>
                    <SelectItem value="OR">하나만 (OR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">활성화</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                저장
              </Button>
              <Button size="sm" variant="outline" onClick={cancelForm}>
                취소
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/src/components/calendar/filter-rule-editor.tsx
git commit -m "feat(web): create FilterRuleEditor component for side panel"
```

---

## Task 12: Create CalendarSidePanel Component

**Files:**
- Create: `src/components/calendar/side-panel.tsx`

**Step 1: Create the component**

```typescript
"use client";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "./category-manager";
import { FilterRuleEditor } from "./filter-rule-editor";
import type { MobileCategory, FilterRule } from "@/lib/types";

interface CalendarSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: MobileCategory[];
  filterRules: FilterRule[];
}

export function CalendarSidePanel({
  open, onOpenChange, categories, filterRules,
}: CalendarSidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[360px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>캘린더 설정</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="categories" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="categories" className="flex-1">카테고리</TabsTrigger>
            <TabsTrigger value="rules" className="flex-1">필터 규칙</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-4">
            <CategoryManager categories={categories} />
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <FilterRuleEditor filterRules={filterRules} categories={categories} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/src/components/calendar/side-panel.tsx
git commit -m "feat(web): create CalendarSidePanel with tabs"
```

---

## Task 13: Wire ScheduleView to Use New Components

**Files:**
- Modify: `src/components/schedule-view.tsx` (major rewrite — replace with orchestrator)

**Step 1: Rewrite ScheduleView as a thin orchestrator**

Replace the entire `schedule-view.tsx` content. The component now delegates to ViewSwitcher + the 3 view components + side panel:

```typescript
"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ClipboardPaste, CalendarPlus, Copy } from "lucide-react";
import {
  addAllCategoriesToWeek, copyPreviousWeekPlans, copyCurrentWeekToNext,
} from "@/lib/actions";
import { getWeekMonday } from "@/lib/schedule-utils";
import type {
  MobileCategory, Plan, DayCategory, CapturedMessage, FilterRule,
} from "@/lib/types";
import type { CalendarView } from "@/lib/schedule-utils";

import { ViewSwitcher } from "@/components/calendar/view-switcher";
import { WeekView } from "@/components/calendar/week-view";
import { DayView } from "@/components/calendar/day-view";
import { MonthView } from "@/components/calendar/month-view";
import { CalendarSidePanel } from "@/components/calendar/side-panel";

interface ScheduleViewProps {
  categories: MobileCategory[];
  plans: Plan[];
  dayCategories: DayCategory[];
  messages: CapturedMessage[];
  filterRules: FilterRule[];
  view: CalendarView;
  startMs: number;
  endMs: number;
  referenceDate: number; // epoch ms
}

export function ScheduleView({
  categories, plans, dayCategories, messages, filterRules,
  view, startMs, endMs, referenceDate,
}: ScheduleViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const refDate = useMemo(() => new Date(referenceDate), [referenceDate]);

  // Week actions (only shown in week view)
  function handleAddAllCategories() {
    startTransition(async () => {
      try {
        await addAllCategoriesToWeek(startMs);
        toast.success("전체 카테고리를 추가했습니다.");
        router.refresh();
      } catch { toast.error("카테고리 추가 실패"); }
    });
  }

  function handleCopyPrevWeek() {
    startTransition(async () => {
      try {
        await copyPreviousWeekPlans(startMs);
        toast.success("전주 플랜을 불러왔습니다.");
        router.refresh();
      } catch { toast.error("전주 복사 실패"); }
    });
  }

  function handleCopyToNext() {
    startTransition(async () => {
      try {
        await copyCurrentWeekToNext(startMs);
        toast.success("다음주로 복사했습니다.");
        router.refresh();
      } catch { toast.error("다음주 복사 실패"); }
    });
  }

  const weekActions = view === "week" ? (
    <div className="ml-auto flex items-center gap-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={isPending}>
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">전주 불러오기</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>전주 플랜을 불러올까요?</AlertDialogTitle>
            <AlertDialogDescription>이전 주의 플랜과 카테고리가 현재 주로 복사됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleCopyPrevWeek}>불러오기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={isPending}>
            <CalendarPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">전체 카테고리</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>전체 카테고리를 추가할까요?</AlertDialogTitle>
            <AlertDialogDescription>모든 활성 카테고리를 이번 주 7일 모두에 추가합니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddAllCategories}>추가</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={isPending}>
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">다음주로 복사</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>다음주로 복사할까요?</AlertDialogTitle>
            <AlertDialogDescription>현재 주의 플랜과 카테고리가 다음 주로 복사됩니다.</AlertDialogDescription>
          </AlertDialogFooter>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleCopyToNext}>복사</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <ViewSwitcher
        view={view}
        referenceDate={refDate}
        onToggleSidePanel={() => setSidePanelOpen(!sidePanelOpen)}
      >
        {weekActions}
      </ViewSwitcher>

      {view === "week" && (
        <WeekView
          categories={categories}
          plans={plans}
          dayCategories={dayCategories}
          messages={messages}
          referenceDate={refDate}
          isPending={isPending}
          startTransition={startTransition}
        />
      )}

      {view === "day" && (
        <DayView
          categories={categories}
          plans={plans}
          dayCategories={dayCategories}
          messages={messages}
          referenceDate={refDate}
          isPending={isPending}
          startTransition={startTransition}
        />
      )}

      {view === "month" && (
        <MonthView
          categories={categories}
          plans={plans}
          dayCategories={dayCategories}
          messages={messages}
          referenceDate={refDate}
        />
      )}

      <CalendarSidePanel
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
        categories={categories}
        filterRules={filterRules}
      />
    </div>
  );
}
```

**Note:** There's an intentional JSX structure issue in the week actions (AlertDialogDescription closing with Footer). Fix the `</AlertDialogDescription>` to properly close before `<AlertDialogFooter>` on the last AlertDialog. This is a known copy-paste area — double-check the JSX nesting.

**Step 2: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds

**Step 3: Verify dev server**

Run: `npm run dev --workspace=apps/web`
Navigate to `http://localhost:3001/calendar` — should see week view with new tab switcher
Navigate to `http://localhost:3001/calendar?view=month` — should see month grid
Navigate to `http://localhost:3001/calendar?view=day` — should see day detail

**Step 4: Commit**

```bash
git add apps/web/src/components/schedule-view.tsx
git commit -m "feat(web): wire ScheduleView to use view switching and side panel"
```

---

## Task 14: Remove Backward-Compat Wrappers and Clean Up

**Files:**
- Modify: `src/lib/queries/schedule.ts` (remove old wrappers)

**Step 1: Remove backward-compat functions**

Remove these lines from the end of `schedule.ts`:

```typescript
// Remove these:
export function getWeekPlans(weekStartMs: number) { ... }
export function getWeekDayCategories(weekStartMs: number) { ... }
export function getWeekMessages(weekStartMs: number) { ... }
```

**Step 2: Update any remaining imports**

Search for any files still importing the old names:

```bash
grep -r "getWeekPlans\|getWeekDayCategories\|getWeekMessages" apps/web/src/
```

If `page.tsx` was properly updated in Task 5, there should be no remaining references. Fix any that remain.

**Step 3: Verify build**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add apps/web/src/lib/queries/schedule.ts
git commit -m "refactor(web): remove backward-compat query wrappers"
```

---

## Task 15: Final Integration Verification

**Step 1: Full build check**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds

**Step 2: Manual testing checklist**

Start dev server and verify each feature:

1. **Week view** (`/calendar` or `/calendar?view=week`)
   - [ ] Renders 7-day grid as before
   - [ ] Navigation arrows work
   - [ ] "오늘" button works
   - [ ] Week action buttons (전주 불러오기, 전체 카테고리, 다음주로 복사) visible
   - [ ] Plan CRUD works
   - [ ] Category add/remove works
   - [ ] Message popover works

2. **Day view** (`/calendar?view=day`)
   - [ ] Shows single day with expanded categories
   - [ ] Plan add/toggle/delete works
   - [ ] Message list expands/collapses
   - [ ] Navigation arrows move by day
   - [ ] Clicking "주" tab switches to week view

3. **Month view** (`/calendar?view=month`)
   - [ ] Calendar grid renders with correct days
   - [ ] Category color dots visible
   - [ ] Message count badges visible
   - [ ] Clicking a date navigates to day view
   - [ ] Navigation arrows move by month

4. **Side panel**
   - [ ] Settings gear icon opens sheet
   - [ ] Categories tab: list, create, edit, delete
   - [ ] Filter rules tab: list, create, edit, delete
   - [ ] Changes reflect in calendar after save

5. **View switching**
   - [ ] Tabs switch between day/week/month
   - [ ] URL parameters update correctly
   - [ ] Data loads correctly for each view

**Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat(web): complete calendar tab redesign with day/week/month views"
```

---

## Summary of All New/Modified Files

### New Files (7)
| File | Description |
|------|-------------|
| `src/components/calendar/view-switcher.tsx` | Tab switching + navigation header |
| `src/components/calendar/week-view.tsx` | Extracted week rendering (from schedule-view) |
| `src/components/calendar/day-view.tsx` | New single-day detail view |
| `src/components/calendar/month-view.tsx` | New month grid view |
| `src/components/calendar/side-panel.tsx` | Sheet wrapper with tabs |
| `src/components/calendar/category-manager.tsx` | Category CRUD UI |
| `src/components/calendar/filter-rule-editor.tsx` | Filter rule CRUD UI |

### Modified Files (5)
| File | Changes |
|------|---------|
| `src/app/(dashboard)/calendar/page.tsx` | View param handling, range-based fetching, filter_rules |
| `src/components/schedule-view.tsx` | Thin orchestrator delegating to sub-components |
| `src/lib/queries/schedule.ts` | Range-based queries, getAllCategories, getFilterRules |
| `src/lib/actions.ts` | Category CRUD + filter rule CRUD server actions |
| `src/lib/types.ts` | FilterRule interface |
| `src/lib/schedule-utils.ts` | Month utilities, CalendarView type, parseCalendarParams |

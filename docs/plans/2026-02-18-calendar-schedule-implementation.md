# Calendar → Schedule View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the web dashboard calendar with a desktop-optimized weekly schedule view that shares mobile app data (categories, plans, day_categories, captured_messages).

**Architecture:** Server Component page fetches week data from Supabase mobile sync tables → passes to ScheduleView client component → sidebar (mini calendar + categories + actions) + 7-column weekly grid with category sections and plan items. All data is user_id scoped via RLS.

**Tech Stack:** Next.js 16, Supabase SSR, shadcn/ui, Tailwind CSS, Server Actions

---

### Task 1: Add TypeScript Types

**Files:**
- Modify: `apps/web/src/lib/types.ts`

**Step 1: Add mobile sync table types**

Add these types after the existing `MobileDevice` interface:

```typescript
// --- Mobile Sync (shared with mobile app) ---

export interface MobileCategory {
  id: string;
  name: string;
  color: number;       // ARGB integer
  order_index: number;
  is_active: boolean;
}

export interface Plan {
  id: string;
  category_id: string | null;
  date: number;           // epoch ms
  title: string;
  is_completed: boolean;
  linked_message_id: string | null;
  order_number: string | null;
  order_index: number;
}

export interface DayCategory {
  id: string;
  date: number;           // epoch ms
  category_id: string;
}

export interface CapturedMessage {
  id: string;
  app_name: string;
  sender: string;
  content: string;
  received_at: number;    // epoch ms
  category_id: string | null;
  status_id: string | null;
  is_archived: boolean;
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat(web): add TypeScript types for mobile sync tables"
```

---

### Task 2: Add Date and Color Utility Helpers

**Files:**
- Create: `apps/web/src/lib/schedule-utils.ts`

**Step 1: Create utility file**

```typescript
/**
 * Get Monday of the week containing the given date.
 */
export function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Convert a Date to epoch milliseconds at start of day (local timezone).
 */
export function startOfDayMs(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Get 7 dates starting from Monday.
 */
export function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/**
 * Convert ARGB integer (as stored by Android) to CSS hex color.
 * Android Color.toArgb() produces signed 32-bit int. Example: -16776961 → #0000FF (blue).
 */
export function argbToHex(argb: number): string {
  const hex = ((argb & 0x00FFFFFF) >>> 0).toString(16).padStart(6, "0");
  return `#${hex}`;
}

/**
 * Format epoch ms to short date string.
 */
export function formatEpochDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format epoch ms to time string.
 */
export function formatEpochTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Parse ?week=yyyy-MM-dd param to a Monday Date. Falls back to current week.
 */
export function parseWeekParam(param?: string): Date {
  if (param) {
    const d = new Date(param + "T00:00:00");
    if (!isNaN(d.getTime())) return getWeekMonday(d);
  }
  return getWeekMonday(new Date());
}

/**
 * Format week label: "2026년 2월 3주차"
 */
export function formatWeekLabel(monday: Date): string {
  const year = monday.getFullYear();
  const month = monday.getMonth() + 1;
  // Week of month = ceil(dayOfMonth / 7)
  const weekOfMonth = Math.ceil(monday.getDate() / 7);
  return `${year}년 ${month}월 ${weekOfMonth}주차`;
}

/**
 * Generate a UUID v4 (for creating new records matching mobile pattern).
 */
export function generateId(): string {
  return crypto.randomUUID();
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/schedule-utils.ts
git commit -m "feat(web): add schedule date/color utility helpers"
```

---

### Task 3: Create Schedule Queries

**Files:**
- Create: `apps/web/src/lib/queries/schedule.ts`

**Step 1: Create query file**

All queries use the RLS-enforced `createClient()` — the `user_id` filter is automatic via RLS policies on mobile sync tables.

```typescript
import { createClient } from "@/lib/supabase/server";
import type { MobileCategory, Plan, DayCategory, CapturedMessage } from "@/lib/types";

export async function getCategories(): Promise<MobileCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color, order_index, is_active")
    .eq("is_deleted", false)
    .eq("is_active", true)
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as MobileCategory[];
}

export async function getWeekPlans(weekStartMs: number): Promise<Plan[]> {
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, category_id, date, title, is_completed, linked_message_id, order_number, order_index")
    .eq("is_deleted", false)
    .gte("date", weekStartMs)
    .lt("date", weekEndMs)
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as Plan[];
}

export async function getWeekDayCategories(weekStartMs: number): Promise<DayCategory[]> {
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("day_categories")
    .select("id, date, category_id")
    .gte("date", weekStartMs)
    .lt("date", weekEndMs);
  if (error) throw error;
  return (data ?? []) as DayCategory[];
}

export async function getWeekMessages(weekStartMs: number): Promise<CapturedMessage[]> {
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("captured_messages")
    .select("id, app_name, sender, content, received_at, category_id, status_id, is_archived")
    .eq("is_deleted", false)
    .gte("received_at", weekStartMs)
    .lt("received_at", weekEndMs)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CapturedMessage[];
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/queries/schedule.ts
git commit -m "feat(web): add schedule queries for mobile sync tables"
```

---

### Task 4: Create Schedule Server Actions

**Files:**
- Create: `apps/web/src/lib/actions/schedule.ts`

**Step 1: Create the actions file**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateId } from "@/lib/schedule-utils";

// --- Plans ---

export async function createPlan(data: {
  category_id: string;
  date: number;
  title: string;
  order_index?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = Date.now();
  const { error } = await supabase.from("plans").insert({
    id: generateId(),
    user_id: user.id,
    category_id: data.category_id,
    date: data.date,
    title: data.title,
    is_completed: false,
    order_index: data.order_index ?? 0,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function updatePlan(id: string, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ ...data, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function togglePlanCompletion(id: string, isCompleted: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ is_completed: isCompleted, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function deletePlan(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ is_deleted: true, updated_at: Date.now() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function linkPlanToMessage(planId: string, messageId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ linked_message_id: messageId, updated_at: Date.now() })
    .eq("id", planId);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function updatePlanOrderNumber(planId: string, orderNumber: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ order_number: orderNumber, updated_at: Date.now() })
    .eq("id", planId);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

// --- Day Categories ---

export async function addCategoryToDay(date: number, categoryId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = Date.now();
  const { error } = await supabase.from("day_categories").insert({
    id: generateId(),
    user_id: user.id,
    date,
    category_id: categoryId,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

export async function removeCategoryFromDay(dayCategoryId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("day_categories")
    .delete()
    .eq("id", dayCategoryId);
  if (error) throw error;
  revalidatePath("/calendar");
  return { success: true };
}

// --- Week Operations ---

export async function addAllCategoriesToWeek(weekStartMs: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get active categories
  const { data: categories } = await supabase
    .from("categories")
    .select("id")
    .eq("is_deleted", false)
    .eq("is_active", true);

  if (!categories || categories.length === 0) return { success: true };

  // Get existing day_categories for the week
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
  const { data: existing } = await supabase
    .from("day_categories")
    .select("date, category_id")
    .gte("date", weekStartMs)
    .lt("date", weekEndMs);

  const existingSet = new Set(
    (existing ?? []).map((e) => `${e.date}-${e.category_id}`)
  );

  const now = Date.now();
  const toInsert: Array<Record<string, unknown>> = [];

  for (let i = 0; i < 7; i++) {
    const dayMs = weekStartMs + i * 24 * 60 * 60 * 1000;
    for (const cat of categories) {
      if (!existingSet.has(`${dayMs}-${cat.id}`)) {
        toInsert.push({
          id: generateId(),
          user_id: user.id,
          date: dayMs,
          category_id: cat.id,
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("day_categories").insert(toInsert);
    if (error) throw error;
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function copyPreviousWeekPlans(targetWeekStartMs: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const sourceWeekStartMs = targetWeekStartMs - 7 * 24 * 60 * 60 * 1000;
  const sourceWeekEndMs = targetWeekStartMs;
  const now = Date.now();

  // Copy day_categories
  const { data: srcDayCats } = await supabase
    .from("day_categories")
    .select("*")
    .gte("date", sourceWeekStartMs)
    .lt("date", sourceWeekEndMs);

  if (srcDayCats && srcDayCats.length > 0) {
    const dcInsert = srcDayCats.map((dc) => ({
      id: generateId(),
      user_id: user.id,
      date: dc.date + 7 * 24 * 60 * 60 * 1000,
      category_id: dc.category_id,
      created_at: now,
      updated_at: now,
    }));
    await supabase.from("day_categories").upsert(dcInsert, { onConflict: "id" });
  }

  // Copy plans
  const { data: srcPlans } = await supabase
    .from("plans")
    .select("*")
    .eq("is_deleted", false)
    .gte("date", sourceWeekStartMs)
    .lt("date", sourceWeekEndMs);

  if (srcPlans && srcPlans.length > 0) {
    const planInsert = srcPlans.map((p) => ({
      id: generateId(),
      user_id: user.id,
      category_id: p.category_id,
      date: p.date + 7 * 24 * 60 * 60 * 1000,
      title: p.title,
      is_completed: false,
      linked_message_id: null,
      order_number: null,
      order_index: p.order_index,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    }));
    await supabase.from("plans").insert(planInsert);
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function copyCurrentWeekToNext(sourceWeekStartMs: number) {
  const targetWeekStartMs = sourceWeekStartMs + 7 * 24 * 60 * 60 * 1000;
  return copyPreviousWeekPlans(targetWeekStartMs);
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/actions/schedule.ts
git commit -m "feat(web): add schedule server actions for plans and day categories"
```

---

### Task 5: Create ScheduleView Component (Main Layout + All Sub-components)

**Files:**
- Create: `apps/web/src/components/schedule-view.tsx`

This is the main client component that contains: sidebar (MiniCalendar, CategoryList, WeekActions), week header, 7 day columns, category sections, plan items, and all dialogs.

**Step 1: Create the component file**

The component receives server-fetched data as props and handles all client-side interactions. Key sections:

1. **MiniCalendar** — small 7×6 grid for week selection, highlights current week
2. **CategoryList** — color dots + names, used as reference (no filter needed since day_categories controls visibility)
3. **WeekActions** — 3 buttons: copy prev week, add all categories, copy to next week
4. **WeekHeader** — "2026년 2월 3주차 ◀ ▶" + Mon-Sun labels
5. **DayColumn** — single day with category sections
6. **CategorySection** — category header (color + name + msg count + add/remove) + plan items
7. **PlanItem** — checkbox + title + message link + order number + delete
8. **Dialogs** — AddPlanDialog, MessageLinkPopover, OrderNumberDialog, ConfirmDialogs

The full component is ~800-1000 lines. Build it incrementally:

**Sub-step 1a: File skeleton with types and imports**

Create `apps/web/src/components/schedule-view.tsx` with:
- All imports (react, next/navigation, sonner, shadcn components, lucide icons, actions, utils, types)
- Props interface: `{ categories, plans, dayCategories, messages, weekStartMs }`
- Main `ScheduleView` export with flex layout (sidebar + main)

**Sub-step 1b: MiniCalendar**

Internal component rendering:
- Month/year header with ◀▶ navigation
- 7×6 day grid (Sun-Sat labels)
- Clicking a day navigates to `?week=yyyy-MM-dd` (the Monday of that week)
- Current week row highlighted with bg-primary/10
- Today has a ring indicator

**Sub-step 1c: WeekHeader + DayColumn layout**

- Week label (formatWeekLabel) + ◀▶ buttons that shift by 7 days
- `grid grid-cols-7 gap-2` for day columns
- Each column: date header + scrollable content area

**Sub-step 1d: CategorySection + PlanItem**

- CategorySection: colored circle + category name + message count badge (clickable) + [+] button + [×] button
- PlanItem: checkbox (togglePlanCompletion), title text (strikethrough when done), 🔗 icon, order# badge, delete icon
- Inline add: text input at bottom of category section

**Sub-step 1e: AddCategory button + dialogs**

- "+" button at bottom of each day column → Select from categories not yet added to that day
- Message link popover: shows captured_messages for that day + category
- Confirm dialogs for: copy prev week, copy to next week, add all categories, remove category from day

**Step 2: Commit**

```bash
git add apps/web/src/components/schedule-view.tsx
git commit -m "feat(web): add ScheduleView component with weekly planner layout"
```

---

### Task 6: Replace Calendar Page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/calendar/page.tsx`

**Step 1: Rewrite the page server component**

Replace the entire page to fetch from mobile sync tables:

```typescript
import { ScheduleView } from "@/components/schedule-view";
import { RealtimeListener } from "@/components/realtime-listener";
import { getCategories, getWeekPlans, getWeekDayCategories, getWeekMessages } from "@/lib/queries/schedule";
import { parseWeekParam, startOfDayMs } from "@/lib/schedule-utils";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const monday = parseWeekParam(params.week);
  const weekStartMs = startOfDayMs(monday);

  const [categories, plans, dayCategories, messages] = await Promise.all([
    getCategories().catch(() => []),
    getWeekPlans(weekStartMs).catch(() => []),
    getWeekDayCategories(weekStartMs).catch(() => []),
    getWeekMessages(weekStartMs).catch(() => []),
  ]);

  return (
    <>
      <RealtimeListener tables={["plans", "day_categories", "captured_messages"]} />
      <ScheduleView
        categories={categories}
        plans={plans}
        dayCategories={dayCategories}
        messages={messages}
        weekStartMs={weekStartMs}
      />
    </>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/(dashboard)/calendar/page.tsx
git commit -m "feat(web): replace calendar page with schedule view"
```

---

### Task 7: Verify and Polish

**Step 1: Dev server check**

Run `npm run dev:web` from project root, navigate to `/calendar`. Verify:
- [ ] Sidebar renders with mini calendar, category list, week actions
- [ ] 7 day columns render with correct dates
- [ ] Category sections appear for days with day_categories entries
- [ ] Plans render with checkboxes and titles
- [ ] Plan completion toggle works
- [ ] Adding a new plan works (inline input)
- [ ] Adding/removing category from day works
- [ ] Week navigation (◀▶) works
- [ ] Mini calendar week selection works
- [ ] Copy previous week works
- [ ] Add all categories to week works
- [ ] Copy to next week works
- [ ] Message count badges show correct counts
- [ ] Message link popover works
- [ ] Order number input works

**Step 2: Visual polish**

- Ensure responsive behavior (sidebar collapses on narrow screens)
- Saturday/Sunday column headers in blue/red
- Today column has subtle highlight
- Completed plans have strikethrough + muted opacity
- Empty columns show helpful placeholder text

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(web): polish schedule view with responsive layout and visual refinements"
```

---

## File Summary

| Action | File |
|--------|------|
| Modify | `apps/web/src/lib/types.ts` |
| Create | `apps/web/src/lib/schedule-utils.ts` |
| Create | `apps/web/src/lib/queries/schedule.ts` |
| Create | `apps/web/src/lib/actions/schedule.ts` |
| Create | `apps/web/src/components/schedule-view.tsx` |
| Modify | `apps/web/src/app/(dashboard)/calendar/page.tsx` |

## Dependencies

- No new npm packages needed (all shadcn/ui components already installed)
- No database migrations needed (tables exist from migration 00010 + 00011)
- RLS policies already exist for all mobile sync tables (user_id scoped)

# Web Performance Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve web app loading speed across all pages by reducing JS bundle size, eliminating unnecessary data fetching, and optimizing component rendering.

**Architecture:** Approach B — bundle + data optimization with minimal structural changes. Dynamic imports for heavy components, lazy-loading dropdowns via server actions, deferring calendar tab data, preserving client state across realtime refreshes, and memoizing expensive row components.

**Tech Stack:** Next.js 16, React 19, Recharts, @tanstack/react-table, Supabase, shadcn/ui

---

## Task 1: Dynamic Import — TrendChart

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx:32-33,107`

**Step 1: Convert TrendChart to dynamic import**

In `apps/web/src/app/(dashboard)/dashboard/page.tsx`, replace the static import:

```tsx
// REMOVE this line:
import { TrendChart } from "@/components/trend-chart";
```

Add dynamic import at the top (after other imports):

```tsx
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const TrendChart = dynamic(() => import("@/components/trend-chart").then(m => ({ default: m.TrendChart })), {
  loading: () => <Skeleton className="h-[250px] w-full rounded-md" />,
  ssr: false,
});
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds without errors.

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "perf: dynamic import TrendChart to reduce initial bundle"
```

---

## Task 2: Dynamic Import — OrderTable & OrderCalendar

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx:10-12`

**Step 1: Convert OrderTable and OrderCalendar to dynamic imports**

In `apps/web/src/app/(dashboard)/orders/page.tsx`, replace:

```tsx
// REMOVE these lines:
import { OrderTable } from "@/components/order-table";
import type { ProductOption } from "@/components/order-table";
import { OrderCalendar } from "@/components/order-calendar";
```

Add:

```tsx
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const OrderTable = dynamic(
  () => import("@/components/order-table").then(m => ({ default: m.OrderTable })),
  { loading: () => <Skeleton className="h-[400px] w-full rounded-md" /> }
);
const OrderCalendar = dynamic(
  () => import("@/components/order-calendar").then(m => ({ default: m.OrderCalendar })),
  { loading: () => <Skeleton className="h-[500px] w-full rounded-md" /> }
);

// Keep the type import separately:
import type { ProductOption } from "@/components/order-table";
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/orders/page.tsx
git commit -m "perf: dynamic import OrderTable and OrderCalendar"
```

---

## Task 3: Dynamic Import — MfdsSearchPanel

**Files:**
- Modify: `apps/web/src/app/(dashboard)/products/page.tsx`

**Step 1: Read current products page**

Read `apps/web/src/app/(dashboard)/products/page.tsx` to see exact import line.

**Step 2: Convert to dynamic import**

Replace the static import of `MfdsSearchPanel` with:

```tsx
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const MfdsSearchPanel = dynamic(
  () => import("@/components/mfds-search-panel").then(m => ({ default: m.MfdsSearchPanel })),
  { loading: () => <Skeleton className="h-[600px] w-full rounded-md" /> }
);
```

**Step 3: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/products/page.tsx
git commit -m "perf: dynamic import MfdsSearchPanel"
```

---

## Task 4: Dynamic Import — MessageCalendar in MessagesView

**Files:**
- Modify: `apps/web/src/components/messages-view.tsx:12`

**Step 1: Convert MessageCalendar to dynamic import**

In `apps/web/src/components/messages-view.tsx`, replace:

```tsx
// REMOVE:
import { MessageCalendar } from "@/components/message-calendar";
```

Add:

```tsx
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const MessageCalendar = dynamic(
  () => import("@/components/message-calendar").then(m => ({ default: m.MessageCalendar })),
  { loading: () => <Skeleton className="h-[500px] w-full rounded-md" /> }
);
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/web/src/components/messages-view.tsx
git commit -m "perf: dynamic import MessageCalendar"
```

---

## Task 5: Dropdown Lazy Load — Create search server actions

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/actions.ts` (add two new server actions)

**Step 1: Add searchHospitalsAction and searchSuppliersAction**

Append to `apps/web/src/app/(dashboard)/orders/actions.ts`:

```tsx
export async function searchHospitalsAction(query: string) {
  if (!query || query.length < 1) return [];
  const { getHospitals } = await import("@/lib/queries/hospitals");
  const { hospitals } = await getHospitals({ search: query, limit: 20 });
  return hospitals.map((h) => ({ id: h.id, name: h.name }));
}

export async function searchSuppliersAction(query: string) {
  if (!query || query.length < 1) return [];
  const { getSuppliers } = await import("@/lib/queries/suppliers");
  const { suppliers } = await getSuppliers({ search: query, limit: 20 });
  return suppliers.map((s) => ({ id: s.id, name: s.name }));
}
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/orders/actions.ts
git commit -m "feat: add hospital/supplier search server actions for lazy loading"
```

---

## Task 6: Dropdown Lazy Load — Create SearchableCombobox component

**Files:**
- Create: `apps/web/src/components/searchable-combobox.tsx`

**Step 1: Create the reusable lazy-loading combobox**

```tsx
"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

interface Option {
  id: number;
  name: string;
}

interface SearchableComboboxProps {
  value: number | null;
  /** Display name for the currently selected value (avoids extra lookup) */
  displayName?: string;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  onSelect: (id: number) => void;
  searchAction: (query: string) => Promise<Option[]>;
  /** Pre-loaded options shown before user types (e.g. recent items) */
  initialOptions?: Option[];
  className?: string;
}

export function SearchableCombobox({
  value,
  displayName,
  placeholder,
  searchPlaceholder = "검색...",
  emptyText = "결과 없음",
  onSelect,
  searchAction,
  initialOptions = [],
  className,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>(initialOptions);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function handleSearch(query: string) {
    clearTimeout(debounceRef.current);
    if (!query || query.length < 1) {
      setOptions(initialOptions);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const results = await searchAction(query);
        setOptions(results);
      });
    }, 300);
  }

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const label = displayName ?? options.find((o) => o.id === value)?.name ?? placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          <span className="truncate">{value ? label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} onValueChange={handleSearch} />
          <CommandList>
            <CommandEmpty>{isPending ? "검색 중..." : emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={String(opt.id)}
                  onSelect={() => { onSelect(opt.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt.id ? "opacity-100" : "opacity-0")} />
                  {opt.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/web/src/components/searchable-combobox.tsx
git commit -m "feat: add SearchableCombobox with debounced server action search"
```

---

## Task 7: Dropdown Lazy Load — Replace OrderInlineForm hospital combobox

**Files:**
- Modify: `apps/web/src/components/order-inline-form.tsx`
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx` (remove hospitals prop)

**Step 1: Read OrderInlineForm to identify hospital combobox location**

Read `apps/web/src/components/order-inline-form.tsx` fully. Find the hospital Popover/Command block (around lines 314-359) and the Props interface.

**Step 2: Replace hospital combobox with SearchableCombobox**

In the Props interface, change `hospitals` to optional or remove it:

```tsx
// Change from:
interface Props {
  hospitals: Array<{ id: number; name: string }>;
  displayColumns: { drug: string[]; device: string[] };
}

// Change to:
interface Props {
  displayColumns: { drug: string[]; device: string[] };
}
```

Add import at top:

```tsx
import { SearchableCombobox } from "@/components/searchable-combobox";
import { searchHospitalsAction } from "@/app/(dashboard)/orders/actions";
```

Replace the hospital Popover block with:

```tsx
<SearchableCombobox
  value={hospitalId}
  placeholder="거래처 선택"
  searchPlaceholder="거래처 검색..."
  emptyText="거래처 없음"
  onSelect={(id) => setHospitalId(id)}
  searchAction={searchHospitalsAction}
  className="w-[200px]"
/>
```

**Step 3: Update orders page.tsx — remove hospitalOptions from OrderInlineForm**

In `apps/web/src/app/(dashboard)/orders/page.tsx` line 96, remove the `hospitals` prop:

```tsx
// Change from:
<OrderInlineForm hospitals={hospitalOptions} displayColumns={displayColumns} />

// Change to:
<OrderInlineForm displayColumns={displayColumns} />
```

**Step 4: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add apps/web/src/components/order-inline-form.tsx apps/web/src/app/\(dashboard\)/orders/page.tsx
git commit -m "perf: replace OrderInlineForm hospital dropdown with lazy search"
```

---

## Task 8: Dropdown Lazy Load — Replace OrderAccordionContent dropdowns

**Files:**
- Modify: `apps/web/src/components/order-table.tsx` (OrderAccordionContent hospital/supplier dropdowns)

**Step 1: Read OrderAccordionContent (lines 342-858)**

Read lines 342-858 in `apps/web/src/components/order-table.tsx`. Identify:
- Hospital dropdown (around lines 481-518)
- Supplier dropdown per item (around lines 669-715)

**Step 2: Add imports to order-table.tsx**

Add at top of `apps/web/src/components/order-table.tsx`:

```tsx
import { SearchableCombobox } from "@/components/searchable-combobox";
import { searchHospitalsAction, searchSuppliersAction } from "@/app/(dashboard)/orders/actions";
```

**Step 3: Replace hospital dropdown in OrderAccordionContent**

Find the hospital Popover block (lines ~481-518) and replace with:

```tsx
<SearchableCombobox
  value={group.hospital_id}
  displayName={group.hospital_name}
  placeholder="거래처 선택"
  searchPlaceholder="거래처 검색..."
  onSelect={(id) => handleHospitalChange(id)}
  searchAction={searchHospitalsAction}
  className="w-[180px]"
/>
```

**Step 4: Replace supplier dropdown per item**

Find the supplier Popover block (lines ~669-715) and replace with:

```tsx
<SearchableCombobox
  value={localItems[item.id]?.supplier_id ?? item.supplier_id}
  displayName={item.supplier_name}
  placeholder="공급처"
  searchPlaceholder="공급처 검색..."
  onSelect={(id) => updateItemField(item.id, "supplier_id", id)}
  searchAction={searchSuppliersAction}
  className="w-[160px]"
/>
```

**Step 5: Remove unused hospitals/suppliers props if no longer needed**

Check if `hospitals` and `suppliers` arrays are still used elsewhere in OrderAccordionContent. If only used for dropdown options, remove them from the props and the parent component's calls.

**Step 6: Update OrderTable to stop requiring hospitals/suppliers if unused**

If hospitals/suppliers are no longer passed to OrderAccordionContent, also remove them from OrderGroupRow props and OrderTable props. Then update `orders/page.tsx` to remove the hospital/supplier queries:

In `apps/web/src/app/(dashboard)/orders/page.tsx`, remove from Promise.all:
```tsx
// REMOVE these two lines from Promise.all:
getHospitals({ limit: 1000 }).catch(() => ({ hospitals: [], total: 0 })),
getSuppliers({ limit: 1000 }).catch(() => ({ suppliers: [], total: 0 })),
```

And remove the corresponding destructured variables and option mappings.

**Step 7: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 8: Commit**

```bash
git add apps/web/src/components/order-table.tsx apps/web/src/app/\(dashboard\)/orders/page.tsx
git commit -m "perf: replace OrderTable hospital/supplier dropdowns with lazy search"
```

---

## Task 9: Tab Data Separation — Orders calendar

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx` (remove calendarOrders from Promise.all)
- Modify: `apps/web/src/components/order-calendar.tsx` (add client-side data fetching)
- Modify: `apps/web/src/app/(dashboard)/orders/actions.ts` (add calendar data action)

**Step 1: Add calendar data server action**

Append to `apps/web/src/app/(dashboard)/orders/actions.ts`:

```tsx
export async function getCalendarOrdersAction(from: string, to: string) {
  const { getOrdersForCalendar } = await import("@/lib/queries/orders");
  return getOrdersForCalendar({ from, to });
}
```

**Step 2: Remove calendarOrders from orders page Promise.all**

In `apps/web/src/app/(dashboard)/orders/page.tsx`, remove `getOrdersForCalendar` from Promise.all and pass calendar params to the component instead:

```tsx
// Change Promise.all to remove calendar query:
const [result, allProducts, displayColumns] = await Promise.all([
  getOrderItems({ status, from: params.from, to: params.to, limit, offset })
    .catch(() => ({ items: [], total: 0 })),
  getProductsCatalog().catch(() => []),
  getOrderDisplayColumns(),
]);
```

Pass calendar params to OrderCalendar:

```tsx
<OrderCalendar
  calendarFrom={fromStr}
  calendarTo={toStr}
  initialView={calView}
  initialDate={calRef}
/>
```

**Step 3: Update OrderCalendar to fetch data on mount**

In `apps/web/src/components/order-calendar.tsx`, add state-based data fetching:

```tsx
import { useState, useEffect } from "react";
import { getCalendarOrdersAction } from "@/app/(dashboard)/orders/actions";

interface OrderCalendarProps {
  calendarFrom: string;
  calendarTo: string;
  initialView: CalendarView;
  initialDate: Date;
}

export function OrderCalendar({ calendarFrom, calendarTo, initialView, initialDate }: OrderCalendarProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCalendarOrdersAction(calendarFrom, calendarTo)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [calendarFrom, calendarTo]);

  if (loading) return <Skeleton className="h-[500px] w-full rounded-md" />;

  return (
    <DataCalendar
      items={orders}
      {/* ...existing props... */}
    />
  );
}
```

**Step 4: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/orders/page.tsx apps/web/src/components/order-calendar.tsx apps/web/src/app/\(dashboard\)/orders/actions.ts
git commit -m "perf: defer calendar data fetch to tab activation on orders page"
```

---

## Task 10: Tab Data Separation — Notifications calendar

**Files:**
- Modify: `apps/web/src/app/(dashboard)/notifications/page.tsx` (remove calendar queries)
- Modify: `apps/web/src/components/messages-view.tsx` (fetch calendar data on tab switch)
- Create: `apps/web/src/app/(dashboard)/notifications/actions.ts` (calendar data actions)

**Step 1: Create notifications actions file**

Create `apps/web/src/app/(dashboard)/notifications/actions.ts`:

```tsx
"use server";

export async function getCalendarMessagesAction(startMs: number, endMs: number) {
  const { getMessagesForCalendar } = await import("@/lib/queries/messages");
  return getMessagesForCalendar({ startMs, endMs });
}

export async function getCalendarForecastsAction(from: string, to: string) {
  const { getForecastsForCalendar } = await import("@/lib/queries/forecasts");
  return getForecastsForCalendar({ from, to });
}
```

**Step 2: Remove calendar queries from notifications page**

In `apps/web/src/app/(dashboard)/notifications/page.tsx`, simplify Promise.all:

```tsx
const [
  { data: messages, count: totalCount },
  hospitals,
  products,
] = await Promise.all([
  getMessages({
    from: params.from, to: params.to, source: params.source,
    limit: PAGE_SIZE, offset,
  }).catch(() => ({ data: [], count: 0 })),
  getHospitals({}).then((r) => r.hospitals).catch(() => []),
  getProductsCatalog().catch(() => []),
]);
```

Remove `getMessagesForCalendar` and `getForecastsForCalendar` imports.

Pass calendar params instead of data to MessagesView:

```tsx
<MessagesView
  initialTab={tab as "list" | "calendar"}
  messages={messages}
  hospitals={hospitals}
  products={products}
  currentPage={page}
  totalPages={totalPages}
  totalCount={totalCount}
  calendarStartMs={calParams.startMs}
  calendarEndMs={calParams.endMs}
  calendarFrom={calFrom}
  calendarTo={calTo}
  initialCalView={calParams.view}
  initialCalDate={calParams.referenceDate}
/>
```

**Step 3: Update MessagesView to fetch calendar data on tab switch**

In `apps/web/src/components/messages-view.tsx`, update the props interface and add lazy calendar fetching:

```tsx
interface MessagesViewProps {
  initialTab: TabValue;
  messages: CapturedMessage[];
  hospitals: Hospital[];
  products: ProductOption[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  // Calendar params (data fetched on demand)
  calendarStartMs: number;
  calendarEndMs: number;
  calendarFrom: string;
  calendarTo: string;
  initialCalView: CalendarView;
  initialCalDate: Date;
}
```

Add lazy fetching when calendar tab is activated:

```tsx
const [calendarMessages, setCalendarMessages] = useState<CapturedMessage[]>([]);
const [calendarForecasts, setCalendarForecasts] = useState<OrderForecast[]>([]);
const [calLoading, setCalLoading] = useState(false);
const calFetchedRef = useRef(false);

// Fetch calendar data when tab switches to calendar
useEffect(() => {
  if (tab === "calendar" && !calFetchedRef.current) {
    calFetchedRef.current = true;
    setCalLoading(true);
    Promise.all([
      getCalendarMessagesAction(calendarStartMs, calendarEndMs),
      getCalendarForecastsAction(calendarFrom, calendarTo),
    ])
      .then(([msgs, fcsts]) => {
        setCalendarMessages(msgs);
        setCalendarForecasts(fcsts);
      })
      .catch(() => {})
      .finally(() => setCalLoading(false));
  }
}, [tab, calendarStartMs, calendarEndMs, calendarFrom, calendarTo]);
```

**Step 4: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/notifications/page.tsx apps/web/src/app/\(dashboard\)/notifications/actions.ts apps/web/src/components/messages-view.tsx
git commit -m "perf: defer calendar data fetch to tab activation on notifications page"
```

---

## Task 11: Realtime State Preservation

**Files:**
- Modify: `apps/web/src/hooks/use-realtime.ts`

**Step 1: Add scroll position and UI state preservation**

Replace the entire `apps/web/src/hooks/use-realtime.ts`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe to Postgres changes on a table via Supabase Realtime.
 * Triggers `router.refresh()` on INSERT, UPDATE, or DELETE events
 * so that server components re-fetch fresh data.
 * Preserves scroll position across refreshes.
 */
export function useRealtime(
  table: string,
  opts?: {
    event?: "INSERT" | "UPDATE" | "DELETE" | "*";
    schema?: string;
    filter?: string;
  },
) {
  const router = useRouter();
  const scrollRef = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        "postgres_changes" as never,
        {
          event: opts?.event ?? "*",
          schema: opts?.schema ?? "public",
          table,
          ...(opts?.filter ? { filter: opts.filter } : {}),
        },
        () => {
          // Save scroll position before refresh
          scrollRef.current = window.scrollY;
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, opts?.event, opts?.schema, opts?.filter, router]);

  // Restore scroll position after React finishes re-rendering
  useEffect(() => {
    if (scrollRef.current > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollRef.current);
      });
    }
  });
}
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/web/src/hooks/use-realtime.ts
git commit -m "perf: preserve scroll position across realtime refreshes"
```

---

## Task 12: Component Memoization — OrderGroupRow

**Files:**
- Modify: `apps/web/src/components/order-table.tsx` (lines 249-334)

**Step 1: Add memo import**

At the top of `order-table.tsx`, add `memo` to the React import:

```tsx
import { useMemo, useState, useTransition, memo } from "react";
```

**Step 2: Wrap OrderGroupRow with React.memo**

Replace the `function OrderGroupRow(` declaration (line 249) with a memoized version. Change:

```tsx
function OrderGroupRow({
```

To:

```tsx
const OrderGroupRow = memo(function OrderGroupRow({
```

And close the memo wrapper at the end of the function (after the closing `}`):

```tsx
});
```

Add displayName:

```tsx
OrderGroupRow.displayName = "OrderGroupRow";
```

**Step 3: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add apps/web/src/components/order-table.tsx
git commit -m "perf: memoize OrderGroupRow to prevent unnecessary re-renders"
```

---

## Task 13: Component Memoization — TrendChart

**Files:**
- Modify: `apps/web/src/components/trend-chart.tsx`

**Step 1: Memoize TrendChart and its data transformation**

```tsx
"use client";

import { memo, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { TrendPoint } from "@/lib/types";

export const TrendChart = memo(function TrendChart({ data }: { data: TrendPoint[] }) {
  const formatted = useMemo(
    () => data.map((d) => ({ ...d, label: d.date.slice(5) })),
    [data],
  );

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={250}>
      {/* ...existing chart JSX unchanged... */}
    </ResponsiveContainer>
  );
});
```

Note: Keep the entire chart JSX identical, just add the `memo` wrapper and `useMemo` for `formatted`.

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/web/src/components/trend-chart.tsx
git commit -m "perf: memoize TrendChart and data transformation"
```

---

## Task 14: Final verification and cleanup

**Step 1: Run full build to verify everything works**

Run: `cd apps/web && npx next build 2>&1 | tail -30`
Expected: Build succeeds with no errors.

**Step 2: Run dev server and smoke test**

Run: `cd apps/web && npm run dev`
Manually verify:
- Dashboard loads with skeleton → chart appears
- Orders page loads without hospital/supplier delay
- Orders calendar tab loads data on click
- Notifications calendar tab loads data on click
- Realtime updates preserve scroll position

**Step 3: Final commit with all remaining changes (if any)**

```bash
git status
# If any uncommitted changes exist, commit them
```

---

## Summary of Changes

| Task | File(s) | Change |
|------|---------|--------|
| 1 | dashboard/page.tsx | Dynamic import TrendChart |
| 2 | orders/page.tsx | Dynamic import OrderTable, OrderCalendar |
| 3 | products/page.tsx | Dynamic import MfdsSearchPanel |
| 4 | messages-view.tsx | Dynamic import MessageCalendar |
| 5 | orders/actions.ts | Add search server actions |
| 6 | searchable-combobox.tsx | Create lazy-loading combobox |
| 7 | order-inline-form.tsx, orders/page.tsx | Replace hospital dropdown |
| 8 | order-table.tsx, orders/page.tsx | Replace hospital/supplier dropdowns, remove 1000-item queries |
| 9 | orders/page.tsx, order-calendar.tsx, orders/actions.ts | Defer calendar data fetch |
| 10 | notifications/page.tsx, messages-view.tsx, notifications/actions.ts | Defer calendar data fetch |
| 11 | use-realtime.ts | Preserve scroll position |
| 12 | order-table.tsx | Memoize OrderGroupRow |
| 13 | trend-chart.tsx | Memoize TrendChart |
| 14 | — | Final build verification |

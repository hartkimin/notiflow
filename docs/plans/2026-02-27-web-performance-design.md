# Web Performance Optimization Design

**Date:** 2026-02-27
**Approach:** B - Bundle + Data Optimization (minimal structural changes)
**Scope:** All pages, perceived + actual speed, including Realtime

---

## 1. Dynamic Import (Heavy Component Lazy Loading)

### Target Components

| Component | Size | Page | Method |
|-----------|------|------|--------|
| Recharts (TrendChart, SalesChart) | ~100KB+ gzip | Dashboard | `next/dynamic` + ssr:false |
| OrderTable | 859 LOC | Orders | `next/dynamic` + skeleton |
| MfdsSearchPanel | 710 LOC | Products | `next/dynamic` + skeleton |
| OrderCalendar | Calendar view | Orders tab | `next/dynamic` (load on tab switch) |
| MessageCalendar | Calendar view | Notifications tab | `next/dynamic` (load on tab switch) |

### Pattern
```tsx
const TrendChart = dynamic(() => import("@/components/trend-chart"), {
  loading: () => <Skeleton className="h-[300px] w-full" />,
  ssr: false
});
```

**Effect:** Remove ~200KB+ from initial JS bundle, improve TTI.

---

## 2. Dropdown Lazy Load

### Problem
Orders page pre-loads 1000 hospitals + 1000 suppliers for dropdown/combobox options.

### Solution
- Remove full list pre-fetch from server page
- Convert comboboxes to **search-based API call** (server action)
- Debounce(300ms) on user typing → return top 20 results
- Display already-selected values via individual lookup

### Affected Components
- `OrderInlineForm` hospital/supplier comboboxes
- `OrderAccordionContent` edit comboboxes

**Effect:** Remove 2x 1000-row queries from orders page server response.

---

## 3. Tab Data Separation

### Problem
Orders/Notifications pages load both list AND calendar data simultaneously.

### Solution
- Load only active tab's data on server
- Fetch calendar data client-side on tab click (server action + SWR caching)

### Affected Pages
- `/dashboard/orders` — calendarOrders query deferred
- `/dashboard/notifications` — calendarMessages + calendarForecasts queries deferred

**Effect:** Remove 2-3 queries from initial server load per page.

---

## 4. Realtime Selective Update

### Problem
DB change → `router.refresh()` → full page re-render → UI state lost (scroll, expanded rows).

### Solution (Minimal Change)
- Keep `router.refresh()` as the refresh mechanism
- Preserve client state across refresh using `useRef` for:
  - Scroll position
  - Expanded accordion/row IDs
  - Active tab selection
- Restore state after refresh via `useEffect`

**Effect:** Maintain user context across realtime updates.

---

## 5. Component Memoization

### Targets
- `OrderGroupRow` → `React.memo()`
- `MfdsSearchPanel` table rows → `React.memo()`
- `TrendChart`, `SalesChart` → `React.memo()` + `useMemo()` for data transforms
- Event handlers → `useCallback()` for reference stability

### Criteria
- List/table **row components**: `React.memo()` required
- **Complex computations** (grouping, filtering): `useMemo()`
- **Event handlers** passed as props: `useCallback()`

**Effect:** Only changed rows re-render on state change.

---

## Summary

| Section | Perceived | Actual | Change Size |
|---------|-----------|--------|-------------|
| 1. Dynamic Import | Med | High | Small |
| 2. Dropdown Lazy Load | Low | High | Medium |
| 3. Tab Data Separation | Low | Med | Medium |
| 4. Realtime State Preserve | Med | Low | Small |
| 5. Component Memoization | Low | Med | Small |

# Calendar Fixes Design — 2026-02-25

## Problems

### 1. Week view shows first week of month instead of current week
**Root cause:** `messages/page.tsx` and `orders/page.tsx` set `initialDate` to `new Date(calYear, calMonth, 1)` — always the 1st of the month. This `initialDate` becomes `referenceDate` in `DataCalendar`, so `WeekGrid` renders the week containing the 1st.

### 2. Calendar item click opens right-side Sheet instead of popup
**Current behavior:** `detail-panel.tsx` uses shadcn `<Sheet>` (right slide-in panel).
**Desired behavior:** Center modal dialog with backdrop dim.

## Solution

### Fix 1: initialDate — use today when viewing current month

**Files:** `messages/page.tsx`, `orders/page.tsx`

```typescript
// Before
const calRef = new Date(calYear, calMonth, 1);

// After
const now = new Date();
const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();
const calRef = isCurrentMonth ? now : new Date(calYear, calMonth, 1);
```

- Current month → today's date → `WeekGrid` shows current week
- Other months → 1st of month → shows first week (unchanged behavior)

### Fix 2: DetailPanel — Sheet → Dialog

**File:** `data-calendar/detail-panel.tsx`

Replace `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` with `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`.

- Same props interface: `open`, `onOpenChange`, `title`, `children`
- `DialogContent` with `sm:max-w-lg`, `max-h-[80vh]`, `overflow-y-auto`
- Automatically applies to all calendars (messages, orders) via `DataCalendar`

## Files Modified

| File | Change |
|------|--------|
| `apps/web/src/app/(dashboard)/messages/page.tsx` | `initialDate` logic |
| `apps/web/src/app/(dashboard)/orders/page.tsx` | `initialDate` logic |
| `apps/web/src/components/data-calendar/detail-panel.tsx` | Sheet → Dialog |

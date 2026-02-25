# Calendar Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two calendar UX issues — week view showing wrong week on load, and item detail opening as right sheet instead of center dialog.

**Architecture:** Two isolated fixes. Fix 1 adjusts the `initialDate` calculation in two server-component pages so the current week is shown when viewing the current month. Fix 2 swaps the `DetailPanel` component from shadcn `Sheet` to `Dialog`, which propagates to all calendar views automatically.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (Dialog, Sheet), TypeScript

---

### Task 1: Fix week view initialDate in messages page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/messages/page.tsx:46`

**Step 1: Apply the fix**

Change line 46 from:
```typescript
const calRef = new Date(calYear, calMonth, 1);
```

To:
```typescript
const now = new Date();
const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();
const calRef = isCurrentMonth ? now : new Date(calYear, calMonth, 1);
```

Note: The `now` variable on line 43 is scoped inside the `else` block and not accessible here, so we declare a new one.

**Step 2: Verify build compiles**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: "Compiled successfully"

---

### Task 2: Fix week view initialDate in orders page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx:51`

**Step 1: Apply the fix**

Change line 51 from:
```typescript
const calRef = new Date(calYear, calMonth, 1);
```

To:
```typescript
const now2 = new Date();
const isCurrentMonth = calYear === now2.getFullYear() && calMonth === now2.getMonth();
const calRef = isCurrentMonth ? now2 : new Date(calYear, calMonth, 1);
```

Note: The `now` variable on line 48 is scoped inside the `else` block. Use `now2` to avoid shadowing if the block variable leaks via hoisting concerns, or reuse `now` if the block is clearly scoped. Check the actual code — if `now` is in an `else` block, declare a fresh const.

**Step 2: Verify build compiles**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: "Compiled successfully"

**Step 3: Commit both initialDate fixes**

```bash
git add apps/web/src/app/\(dashboard\)/messages/page.tsx apps/web/src/app/\(dashboard\)/orders/page.tsx
git commit -m "fix(web): show current week instead of first week of month in calendar view"
```

---

### Task 3: Convert DetailPanel from Sheet to Dialog

**Files:**
- Modify: `apps/web/src/components/data-calendar/detail-panel.tsx`

**Step 1: Replace the full file content**

Replace the entire file with:
```typescript
"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface DetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export function DetailPanel({ open, onOpenChange, title, children }: DetailPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Key changes:
- `Sheet` → `Dialog`
- `SheetContent` → `DialogContent` with `sm:max-w-lg max-h-[80vh] overflow-y-auto`
- `SheetHeader/SheetTitle` → `DialogHeader/DialogTitle`
- Props interface unchanged — no changes needed in consuming components

**Step 2: Verify build compiles**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: "Compiled successfully"

**Step 3: Commit**

```bash
git add apps/web/src/components/data-calendar/detail-panel.tsx
git commit -m "fix(web): change calendar detail panel from side sheet to center dialog"
```

---

### Task 4: Manual verification checklist

Open the app and verify:

1. `/messages?tab=calendar` — week view shows **current week** (not first week of month)
2. `/orders?tab=calendar` — same behavior
3. Navigate to a different month → week view shows first week of that month (existing behavior preserved)
4. Click any item in week/month/day view → **center modal dialog** appears (not right sheet)
5. Dialog has backdrop dim, scrolls if content is long, closes on backdrop click or X
6. Mobile responsive: dialog works on narrow viewports

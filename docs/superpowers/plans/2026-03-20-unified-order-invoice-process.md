# Unified Order-to-Invoice Process Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the order status flow from `draft→confirmed→processing→delivered` to `draft→confirmed→delivered→invoiced`, removing `processing` and adding `invoiced` as a terminal state tied to tax invoice issuance.

**Architecture:** Single DB migration to replace the enum and drop `tax_invoice_status`. Update all TypeScript types, service layer, query functions, and UI components that reference `processing` or `tax_invoice_status`. Wire `issueInvoice()`/`cancelInvoice()`/`deleteInvoice()` to automatically transition orders to/from `invoiced`.

**Tech Stack:** Supabase PostgreSQL (enum migration), Next.js 16, TypeScript, React 19, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-20-unified-order-invoice-process-design.md`

---

## File Structure

### New Files

| Path | Responsibility |
|---|---|
| `packages/supabase/migrations/00054_order_status_simplify.sql` | Migrate data, replace enum, drop `tax_invoice_status` |

### Modified Files

| Path | Change |
|---|---|
| `apps/web/src/lib/types.ts` | Update `Order.status` union, remove `tax_invoice_status` |
| `apps/web/src/lib/tax-invoice/types.ts` | Remove `tax_invoice_status` from `UnbilledOrder` |
| `apps/web/src/lib/order-status.ts` | Replace labels/variants: remove `processing`, add `invoiced` |
| `apps/web/src/lib/tax-invoice/service.ts` | Replace `recomputeOrderInvoiceStatus` with direct transitions; update status filters |
| `apps/web/src/lib/queries/invoices.ts` | Update `getUnbilledOrders` and `getInvoiceStats` — remove `tax_invoice_status` |
| `apps/web/src/lib/queries/deliveries.ts` | Remove `processing` from status filter |
| `apps/web/src/components/order-status-actions.tsx` | Update `NEXT_STATUS` map |
| `apps/web/src/components/order-detail-client.tsx` | Update buttons, `isEditable`, `canCreateInvoice` |
| `apps/web/src/components/order-filters.tsx` | Replace `processing` with `invoiced` in filter dropdown |
| `apps/web/src/components/order-calendar.tsx` | Update `STATUS_MAP` |
| `apps/web/src/components/order-table.tsx` | Update status references if any |
| `apps/web/src/components/invoice-form.tsx` | Remove `tax_invoice_status` usage if any |
| `CLAUDE.md` | Update order status workflow description |

---

## Task 1: DB Migration — replace enum, migrate data, drop column

**Files:**
- Create: `packages/supabase/migrations/00054_order_status_simplify.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00054_order_status_simplify.sql
-- Simplify order status: remove processing, add invoiced, drop tax_invoice_status

-- ═══ 1. Migrate existing data (while old enum still active) ═══

-- Move all processing → delivered
UPDATE orders SET status = 'delivered' WHERE status = 'processing';

-- Move delivered+fully-invoiced → invoiced (read tax_invoice_status before dropping it)
UPDATE orders SET status = 'invoiced'
WHERE status = 'delivered' AND tax_invoice_status = 'issued';

-- ═══ 2. Drop tax_invoice_status column (no longer needed) ═══
ALTER TABLE orders DROP COLUMN IF EXISTS tax_invoice_status;

-- ═══ 3. Replace order_status_enum ═══
ALTER TYPE order_status_enum RENAME TO order_status_enum_old;

CREATE TYPE order_status_enum AS ENUM (
  'draft', 'confirmed', 'delivered', 'invoiced', 'cancelled'
);

ALTER TABLE orders
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE order_status_enum USING status::text::order_status_enum,
  ALTER COLUMN status SET DEFAULT 'draft';

DROP TYPE order_status_enum_old;
```

- [ ] **Step 2: Apply migration**

Run: `npm run supabase:reset`

- [ ] **Step 3: Commit**

```bash
git add packages/supabase/migrations/00054_order_status_simplify.sql
git commit -m "feat: simplify order status enum — remove processing, add invoiced"
```

---

## Task 2: TypeScript types — update Order and UnbilledOrder

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/tax-invoice/types.ts`

- [ ] **Step 1: Update Order interface in types.ts**

In `apps/web/src/lib/types.ts`, change:
```typescript
// Line ~26: change status union
status: 'draft' | 'confirmed' | 'delivered' | 'invoiced' | 'cancelled';
```

Remove the `tax_invoice_status` field (line ~37):
```typescript
// DELETE this line:
tax_invoice_status: 'pending' | 'partial' | 'issued' | null;
```

- [ ] **Step 2: Update UnbilledOrder in tax-invoice/types.ts**

In `apps/web/src/lib/tax-invoice/types.ts`, remove `tax_invoice_status` from `UnbilledOrder`:
```typescript
// DELETE this line from UnbilledOrder interface:
tax_invoice_status: string | null;
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/tax-invoice/types.ts
git commit -m "feat: update Order type — remove processing/tax_invoice_status, add invoiced"
```

---

## Task 3: Order status labels and variants

**Files:**
- Modify: `apps/web/src/lib/order-status.ts`

- [ ] **Step 1: Replace entire file content**

```typescript
export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  confirmed: "접수확인",
  delivered: "배송완료",
  invoiced: "발행완료",
  cancelled: "취소",
};

export const ORDER_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  confirmed: "default",
  delivered: "outline",
  invoiced: "default",
  cancelled: "destructive",
};
```

Note: `invoiced` uses `"default"` variant. For green styling, the UI components can add a custom class when status is `invoiced`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/order-status.ts
git commit -m "feat: update order status labels — remove processing, add invoiced"
```

---

## Task 4: Service layer — replace recomputeOrderInvoiceStatus with direct transitions

**Files:**
- Modify: `apps/web/src/lib/tax-invoice/service.ts`

- [ ] **Step 1: Read service.ts fully before editing**

Read `apps/web/src/lib/tax-invoice/service.ts` to find all occurrences of:
- `recomputeOrderInvoiceStatus`
- `"processing"` in status filter arrays
- `tax_invoice_status`

- [ ] **Step 2: Update createInvoiceFromOrder() status filter**

Change `.in("status", ["confirmed", "processing", "delivered"])` to:
```typescript
.in("status", ["confirmed", "delivered"])
```

- [ ] **Step 3: Update createConsolidatedInvoice() status filter**

Same change — remove `"processing"` from the `.in()` filter.

- [ ] **Step 4: Replace issueInvoice() — remove recompute, add direct transition**

After setting invoice status to `"issued"`, replace the `recomputeOrderInvoiceStatus` loop with:

```typescript
// Transition linked orders: delivered → invoiced
const { data: linkedOrders } = await supabase
  .from("tax_invoice_orders")
  .select("order_id")
  .eq("invoice_id", invoiceId);

for (const lo of linkedOrders ?? []) {
  await supabase
    .from("orders")
    .update({ status: "invoiced" })
    .eq("id", lo.order_id)
    .eq("status", "delivered");
}
```

- [ ] **Step 5: Replace cancelInvoice() — remove recompute, add direct rollback**

After setting invoice status to `"cancelled"`, replace the `recomputeOrderInvoiceStatus` loop with:

```typescript
const { data: linkedOrders } = await supabase
  .from("tax_invoice_orders")
  .select("order_id")
  .eq("invoice_id", invoiceId);

for (const lo of linkedOrders ?? []) {
  await supabase
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", lo.order_id)
    .eq("status", "invoiced");
}
```

- [ ] **Step 6: Replace deleteInvoice() — remove recompute, add direct rollback**

Before the delete (while links still exist), replace the `recomputeOrderInvoiceStatus` loop with the same rollback:

```typescript
for (const lo of linkedOrders ?? []) {
  await supabase
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", lo.order_id)
    .eq("status", "invoiced");
}
```

- [ ] **Step 7: Delete recomputeOrderInvoiceStatus() function entirely**

Remove the entire `async function recomputeOrderInvoiceStatus(...)` definition.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/tax-invoice/service.ts
git commit -m "feat: replace recomputeOrderInvoiceStatus with direct order status transitions"
```

---

## Task 5: Query functions — update invoices.ts and deliveries.ts

**Files:**
- Modify: `apps/web/src/lib/queries/invoices.ts`
- Modify: `apps/web/src/lib/queries/deliveries.ts`

- [ ] **Step 1: Update getUnbilledOrders() in invoices.ts**

Change from:
```typescript
.in("status", ["confirmed", "processing", "delivered"])
.eq("tax_invoice_status", "pending")
```

To:
```typescript
.eq("status", "delivered")
```

Remove `tax_invoice_status` from the select string if explicitly listed. Remove the `tax_invoice_status` field from the return mapping.

- [ ] **Step 2: Update getInvoiceStats() in invoices.ts**

Change the unbilled count query from:
```typescript
.eq("status", "delivered")
.eq("tax_invoice_status", "pending")
```

To:
```typescript
.eq("status", "delivered")
```

(Orders with status `delivered` are by definition unbilled; `invoiced` orders already have their invoice.)

- [ ] **Step 3: Update deliveries.ts**

In `getTodayDeliveries()`, change line 12 from:
```typescript
.in("status", ["confirmed", "processing"])
```

To:
```typescript
.eq("status", "confirmed")
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/queries/invoices.ts apps/web/src/lib/queries/deliveries.ts
git commit -m "feat: update queries — remove processing/tax_invoice_status references"
```

---

## Task 6: UI components — order-status-actions, order-filters, order-calendar

**Files:**
- Modify: `apps/web/src/components/order-status-actions.tsx`
- Modify: `apps/web/src/components/order-filters.tsx`
- Modify: `apps/web/src/components/order-calendar.tsx`

- [ ] **Step 1: Update order-status-actions.tsx NEXT_STATUS map**

Replace lines 9-15:
```typescript
const NEXT_STATUS: Record<string, { label: string; status: string } | null> = {
  draft: { label: "주문 확인", status: "confirmed" },
  confirmed: { label: "배송 완료", status: "delivered" },
  delivered: null,
  invoiced: null,
  cancelled: null,
};
```

- [ ] **Step 2: Update order-filters.tsx dropdown**

Replace lines 43-47 (the SelectItem list):
```tsx
<SelectItem value="all">전체</SelectItem>
<SelectItem value="draft">초안</SelectItem>
<SelectItem value="confirmed">접수확인</SelectItem>
<SelectItem value="delivered">배송완료</SelectItem>
<SelectItem value="invoiced">발행완료</SelectItem>
<SelectItem value="cancelled">취소</SelectItem>
```

- [ ] **Step 3: Update order-calendar.tsx STATUS_MAP**

Replace lines 11-17:
```typescript
const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "초안", variant: "secondary" },
  confirmed: { label: "접수확인", variant: "default" },
  delivered: { label: "배송완료", variant: "outline" },
  invoiced: { label: "발행완료", variant: "default" },
  cancelled: { label: "취소", variant: "destructive" },
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/order-status-actions.tsx apps/web/src/components/order-filters.tsx apps/web/src/components/order-calendar.tsx
git commit -m "feat: update order UI components — remove processing, add invoiced"
```

---

## Task 7: Order detail client — update buttons, isEditable, canCreateInvoice

**Files:**
- Modify: `apps/web/src/components/order-detail-client.tsx`

- [ ] **Step 1: Read order-detail-client.tsx fully before editing**

- [ ] **Step 2: Update isEditable**

Find `isEditable` and change to:
```typescript
const isEditable = !["delivered", "invoiced", "cancelled"].includes(order.status);
```

- [ ] **Step 3: Update canCreateInvoice**

Change to:
```typescript
const canCreateInvoice = order.status === "delivered";
```

(Only `delivered` orders can create invoices — `confirmed` orders must be delivered first, `invoiced` orders already have their invoice.)

- [ ] **Step 4: Remove processing from status buttons**

Find the status button section (handleStatusChange / conditional button rendering). Ensure:
- `draft` → "접수 확인" button (confirmed)
- `confirmed` → "배송 완료" button (delivered) — NOT "처리 시작"
- `delivered` → "세금계산서 발행" button (invoice dialog)
- `invoiced` → no action buttons, show linked invoice link
- Remove any `processing` → `delivered` button

- [ ] **Step 5: Remove tax_invoice_status badges**

Find and remove any rendering of `order.tax_invoice_status` badges (the "일부발행" / "발행완료" badges that were added in the invoice integration task). These are replaced by the `invoiced` status badge.

- [ ] **Step 6: Add invoiced status badge styling**

Where status badges are rendered, ensure `invoiced` gets a green style:
```typescript
// If using ORDER_STATUS_VARIANT from order-status.ts, it's handled there.
// If there's a local badge variant mapping, add:
invoiced: "default" // with className="bg-green-100 text-green-800" or similar
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/order-detail-client.tsx
git commit -m "feat: update order detail — remove processing, integrate invoiced status"
```

---

## Task 8: Update order-table.tsx and invoice-form.tsx

**Files:**
- Modify: `apps/web/src/components/order-table.tsx`
- Modify: `apps/web/src/components/invoice-form.tsx`

- [ ] **Step 1: Read both files, grep for processing/tax_invoice_status**

- [ ] **Step 2: Update order-table.tsx**

Remove any `processing` references in status displays or filters. If the table uses `ORDER_STATUS_LABELS` from `order-status.ts`, no changes needed (already updated in Task 3). If it has inline status mappings, update them.

- [ ] **Step 3: Update invoice-form.tsx**

Remove any references to `tax_invoice_status` in the form component. The form receives `UnbilledOrder[]` — since we removed `tax_invoice_status` from that type, any usage will cause a TypeScript error that must be fixed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/order-table.tsx apps/web/src/components/invoice-form.tsx
git commit -m "fix: remove processing/tax_invoice_status from order table and invoice form"
```

---

## Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update order status workflow**

Find the line:
```
- Order status workflow: `draft` → `confirmed` → `processing` → `delivered`
```

Replace with:
```
- Order status workflow: `draft` → `confirmed` → `delivered` → `invoiced` (tax invoice issued)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update order status workflow in CLAUDE.md"
```

---

## Task 10: Build verification

- [ ] **Step 1: Run lint**

Run: `npm run lint:web`
Expected: No new errors from our changes.

- [ ] **Step 2: Run production build**

Run: `npm run build:web`
Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 3: Fix any issues**

- [ ] **Step 4: Commit fixes if needed**

```bash
git add -A
git commit -m "fix: resolve lint and build issues for order status simplification"
```

---

## Summary

| Task | Description | Key Files |
|---|---|---|
| 1 | DB migration (enum replace, data migrate, drop column) | migration 00054 |
| 2 | TypeScript types (Order, UnbilledOrder) | types.ts, tax-invoice/types.ts |
| 3 | Status labels and variants | order-status.ts |
| 4 | Service layer (direct transitions, remove recompute) | tax-invoice/service.ts |
| 5 | Query functions (invoices.ts, deliveries.ts) | queries/ |
| 6 | UI: status-actions, filters, calendar | 3 components |
| 7 | UI: order detail client | order-detail-client.tsx |
| 8 | UI: order table, invoice form | 2 components |
| 9 | Documentation | CLAUDE.md |
| 10 | Build verification | lint + build |

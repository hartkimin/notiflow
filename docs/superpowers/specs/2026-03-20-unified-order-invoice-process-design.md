# Unified Order-to-Invoice Process Design

> **Date**: 2026-03-20
> **Status**: Approved
> **Scope**: Simplify order status flow, remove `processing`, add `invoiced`, integrate with tax invoice lifecycle

---

## 1. Goal

Unify the order lifecycle and tax invoice lifecycle into a single organic flow:

```
draft(초안) → confirmed(접수확인) → delivered(배송완료) → invoiced(발행완료)
  └→ cancelled(취소)
```

Remove the unused `processing` status. The order reaches its terminal state (`invoiced`) only when a tax invoice has been issued.

## 2. Current State

### Current order_status_enum
```
draft, confirmed, processing, delivered, cancelled
```

### Current issues
- `processing` adds no value — orders go `confirmed → delivered` in practice
- `delivered` is the terminal state, with no connection to tax invoice issuance
- `tax_invoice_status` (pending/partial/issued) on orders is a separate tracking field that fragments the lifecycle

## 3. New Order Status Flow

### New order_status_enum
```
draft, confirmed, delivered, invoiced, cancelled
```

### State Transitions

| From | To | Trigger | Code Location |
|---|---|---|---|
| `draft` | `confirmed` | Manual: "접수 확인" button | `confirmOrderAction` |
| `draft` | `cancelled` | Manual: "주문 취소" button | `updateOrderStatusAction` |
| `confirmed` | `delivered` | Manual: "배송 완료" button | `updateOrderStatusAction` |
| `confirmed` | `cancelled` | Manual: "주문 취소" button | `updateOrderStatusAction` |
| `delivered` | `invoiced` | Automatic: when `issueInvoice()` confirms linked invoice | `issueInvoice` in `tax-invoice/service.ts` |
| `invoiced` | `delivered` | Automatic: when `cancelInvoice()` or `deleteInvoice()` reverts | `cancelInvoice` / `deleteInvoice` in `tax-invoice/service.ts` |

### Terminal States
- `invoiced` — order fully complete (delivered + tax invoice issued)
- `cancelled` — order cancelled

### Partial Invoicing

When an order has multiple invoices (e.g., split across months), the order stays `delivered` until ALL linked non-cancelled invoices are `issued`. Cancelling one invoice of a multi-invoice order rolls back the order from `invoiced` to `delivered` only if no other active issued invoice remains.

## 4. DB Migration

File: `packages/supabase/migrations/00054_order_status_simplify.sql`

All steps run within a single migration (Supabase runs migrations in transactions).

### 4.1 Migrate existing data

```sql
-- Step 1: Move processing orders to delivered
UPDATE orders SET status = 'delivered' WHERE status = 'processing';

-- Step 2: Move delivered+invoiced orders to invoiced
UPDATE orders SET status = 'invoiced'
WHERE status = 'delivered' AND tax_invoice_status = 'issued';
```

### 4.2 Drop tax_invoice_status column

Must happen AFTER step 2 (which reads this column).

```sql
-- Step 3: Drop the now-redundant column
ALTER TABLE orders DROP COLUMN IF EXISTS tax_invoice_status;
```

### 4.3 Replace enum

```sql
-- Step 4: Replace order_status_enum (remove processing, add invoiced)
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

Note: This runs within a transaction. No existing PostgreSQL functions reference `order_status_enum` as a parameter type (the column is typed, not function params), so the rename is safe.

## 5. TypeScript Type Changes

### Order interface (`apps/web/src/lib/types.ts`)

```typescript
// Before
status: 'draft' | 'confirmed' | 'processing' | 'delivered' | 'cancelled';
tax_invoice_status: 'pending' | 'partial' | 'issued' | null;

// After
status: 'draft' | 'confirmed' | 'delivered' | 'invoiced' | 'cancelled';
// tax_invoice_status removed
```

### UnbilledOrder interface (`apps/web/src/lib/tax-invoice/types.ts`)

```typescript
// Before
export interface UnbilledOrder {
  ...
  tax_invoice_status: string | null;
}

// After — remove tax_invoice_status, no longer needed
// getUnbilledOrders() filters by status === 'delivered' instead
export interface UnbilledOrder {
  id: number;
  order_number: string;
  order_date: string;
  hospital_id: number;
  hospital_name: string | undefined;
  status: string;
  total_amount: number | null;
  supply_amount: number | null;
  tax_amount: number | null;
  delivery_date: string | null;
  delivered_at: string | null;
}
```

## 6. Service Layer Changes

### 6.1 issueInvoice() — automatic delivered → invoiced

When a tax invoice is issued, transition each linked order to `invoiced` (only if currently `delivered`).

```typescript
// In issueInvoice(), after setting invoice status to 'issued':
for (const lo of linkedOrders) {
  await supabase
    .from("orders")
    .update({ status: "invoiced" })
    .eq("id", lo.order_id)
    .eq("status", "delivered"); // only transition from delivered
}
```

### 6.2 cancelInvoice() — automatic invoiced → delivered

When a tax invoice is cancelled, roll back linked orders from `invoiced` to `delivered`.

```typescript
// In cancelInvoice(), after setting invoice status to 'cancelled':
for (const lo of linkedOrders) {
  await supabase
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", lo.order_id)
    .eq("status", "invoiced"); // only roll back invoiced orders
}
```

### 6.3 deleteInvoice() — same rollback as cancel

When a draft invoice is deleted, roll back linked orders the same way.

```typescript
// In deleteInvoice(), before deleting (CASCADE removes links):
for (const lo of linkedOrders) {
  await supabase
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", lo.order_id)
    .eq("status", "invoiced");
}
```

### 6.4 Remove recomputeOrderInvoiceStatus()

Delete this function entirely. Replace all call sites in `issueInvoice()`, `cancelInvoice()`, and `deleteInvoice()` with the direct transitions above.

### 6.5 Update status filters in createInvoiceFromOrder() and createConsolidatedInvoice()

Both functions currently filter: `.in("status", ["confirmed", "processing", "delivered"])`.

Change to: `.in("status", ["confirmed", "delivered"])` — remove `processing` reference.

### 6.6 Update getUnbilledOrders() in queries/invoices.ts

```typescript
// Before
.in("status", ["confirmed", "processing", "delivered"])
.eq("tax_invoice_status", "pending")

// After — orders eligible for invoicing are simply status === "delivered"
.eq("status", "delivered")
// No tax_invoice_status filter (column removed)
```

### 6.7 Update getInvoiceStats() in queries/invoices.ts

```typescript
// Before: unbilled count
.eq("status", "delivered")
.eq("tax_invoice_status", "pending")

// After — "delivered" orders ARE the unbilled ones (invoiced orders have status "invoiced")
.eq("status", "delivered")
```

## 7. UI Changes

### 7.1 Order Detail (order-detail-client.tsx)

**Button mapping by status:**

| Status | Primary Button | Secondary |
|---|---|---|
| `draft` | "접수 확인" → `confirmed` | "주문 취소" → `cancelled` |
| `confirmed` | "배송 완료" → `delivered` | "주문 취소" → `cancelled` |
| `delivered` | "세금계산서 발행" → opens invoice dialog | — |
| `invoiced` | (none — final state) | View linked invoice link |
| `cancelled` | (none — final state) | — |

**Update logic:**
- `isEditable`: `!["delivered", "invoiced", "cancelled"].includes(order.status)`
- `canCreateInvoice`: `order.status === "delivered"` (only delivered orders can create invoices)
- Remove all `processing` references
- Remove `tax_invoice_status` badge display

### 7.2 Order Status Actions (order-status-actions.tsx)

```typescript
const NEXT_STATUS: Record<string, { label: string; status: string } | null> = {
  draft:     { label: "주문 확인",   status: "confirmed" },
  confirmed: { label: "배송 완료",   status: "delivered" },
  delivered: null,  // invoice action is in detail page
  invoiced:  null,  // terminal state
  cancelled: null,  // terminal state
};
```

### 7.3 Order Status Labels & Badge (order-status.ts)

Update the canonical status label/variant registry:

```typescript
// Remove processing, add invoiced
export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  confirmed: "접수확인",
  delivered: "배송완료",
  invoiced: "발행완료",
  cancelled: "취소",
};
```

Badge variant for `invoiced`: green (or a custom class like `bg-green-100 text-green-800`).

### 7.4 Order Filters (order-filters.tsx)

Remove `<SelectItem value="processing">처리중</SelectItem>`.
Add `<SelectItem value="invoiced">발행완료</SelectItem>`.

### 7.5 Order Calendar (order-calendar.tsx)

Update local `STATUS_MAP`: remove `processing`, add `invoiced`.

### 7.6 Order Table (order-table.tsx)

- Remove `processing` from status badges
- Add `invoiced` badge (green, "발행완료")
- Remove `tax_invoice_status` column/badge if displayed

### 7.7 Order List Page (orders/page.tsx)

Update status tabs: 전체, 초안, 접수확인, 배송완료, 발행완료, 취소. Remove `processing` tab.

### 7.8 Status Badge Colors

| Status | Label | Color |
|---|---|---|
| `draft` | 초안 | secondary (gray) |
| `confirmed` | 접수확인 | blue |
| `delivered` | 배송완료 | default |
| `invoiced` | 발행완료 | green |
| `cancelled` | 취소 | destructive (red) |

## 8. Files to Change

### Migration
- Create: `packages/supabase/migrations/00054_order_status_simplify.sql`

### Types
- Modify: `apps/web/src/lib/types.ts` — update Order status union, remove tax_invoice_status
- Modify: `apps/web/src/lib/tax-invoice/types.ts` — remove tax_invoice_status from UnbilledOrder

### Service & Queries
- Modify: `apps/web/src/lib/tax-invoice/service.ts` — remove recomputeOrderInvoiceStatus, add direct transitions in issue/cancel/delete, update status filters in create functions
- Modify: `apps/web/src/lib/queries/invoices.ts` — update getUnbilledOrders (filter by status=delivered), update getInvoiceStats (remove tax_invoice_status filter)
- Modify: `apps/web/src/lib/queries/orders.ts` — remove processing references
- Modify: `apps/web/src/lib/queries/deliveries.ts` — remove processing from getTodayDeliveries filter

### UI Components
- Modify: `apps/web/src/components/order-detail-client.tsx` — update buttons, isEditable, canCreateInvoice, remove processing/tax_invoice_status
- Modify: `apps/web/src/components/order-status-actions.tsx` — update NEXT_STATUS map
- Modify: `apps/web/src/components/order-table.tsx` — update badges
- Modify: `apps/web/src/components/order-detail.tsx` — remove processing references
- Modify: `apps/web/src/components/order-filters.tsx` — remove processing, add invoiced
- Modify: `apps/web/src/components/order-calendar.tsx` — update STATUS_MAP
- Modify: `apps/web/src/lib/order-status.ts` — update labels/variants

### Pages
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx` — update status tabs

### Documentation
- Modify: `CLAUDE.md` — update order status workflow description

## 9. What Does NOT Change

- Tax invoice tables and their own lifecycle (draft/issued/sent/cancelled/modified) — unchanged
- Invoice creation flow (select orders → set date → create) — unchanged
- PDF generation — unchanged
- Company settings — unchanged

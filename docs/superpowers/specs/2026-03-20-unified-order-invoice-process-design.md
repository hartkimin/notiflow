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
| `delivered` | `invoiced` | Automatic: when `issueInvoice()` confirms all linked invoices | `issueInvoice` in `tax-invoice/service.ts` |
| `invoiced` | `delivered` | Automatic: when `cancelInvoice()` reverts invoice | `cancelInvoice` in `tax-invoice/service.ts` |

### Terminal States
- `invoiced` — order fully complete (delivered + tax invoice issued)
- `cancelled` — order cancelled

## 4. DB Migration

### 4.1 Migrate existing data

```sql
-- Step 1: Move processing orders to delivered
UPDATE orders SET status = 'delivered' WHERE status = 'processing';

-- Step 2: Move delivered+invoiced orders to invoiced
UPDATE orders SET status = 'invoiced'
WHERE status = 'delivered' AND tax_invoice_status = 'issued';
```

### 4.2 Replace enum

```sql
-- Step 3: Replace order_status_enum (remove processing, add invoiced)
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

### 4.3 Drop tax_invoice_status column

The `tax_invoice_status` column on orders becomes redundant — `order.status === 'invoiced'` replaces it.

```sql
ALTER TABLE orders DROP COLUMN IF EXISTS tax_invoice_status;
```

## 5. TypeScript Type Changes

### Order interface

```typescript
// Before
status: 'draft' | 'confirmed' | 'processing' | 'delivered' | 'cancelled';
tax_invoice_status: 'pending' | 'partial' | 'issued' | null;

// After
status: 'draft' | 'confirmed' | 'delivered' | 'invoiced' | 'cancelled';
// tax_invoice_status removed
```

## 6. Service Layer Changes

### 6.1 issueInvoice() — automatic delivered → invoiced

When a tax invoice is issued, check if ALL linked orders have all their invoices issued. If so, transition each order to `invoiced`.

```typescript
// In issueInvoice(), after setting invoice status to 'issued':
for (const lo of linkedOrders) {
  // Check if order has any remaining non-issued invoices
  // If all invoices for this order are issued → set order status to 'invoiced'
  await supabase
    .from("orders")
    .update({ status: "invoiced" })
    .eq("id", lo.order_id)
    .eq("status", "delivered"); // only transition from delivered
}
```

### 6.2 cancelInvoice() — automatic invoiced → delivered

When a tax invoice is cancelled, roll back the linked orders from `invoiced` to `delivered`.

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

### 6.3 Remove recomputeOrderInvoiceStatus()

This function managed `tax_invoice_status` (pending/partial/issued) which is now replaced by `order.status`. Remove it and replace calls with direct status transitions above.

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

**Remove:**
- All `processing` references (buttons, conditions, labels)
- `tax_invoice_status` badge display (replaced by `invoiced` status)

### 7.2 Order Status Actions (order-status-actions.tsx)

Update `NEXT_STATUS` map:

```typescript
const NEXT_STATUS = {
  draft:     { label: "주문 확인",   status: "confirmed" },
  confirmed: { label: "배송 완료",   status: "delivered" },
  delivered: null,  // invoice action is in detail page, not inline
  invoiced:  null,
  cancelled: null,
};
```

### 7.3 Order Table (order-table.tsx)

- Remove `processing` from status filter/badge
- Add `invoiced` badge (green, "발행완료")
- Remove `tax_invoice_status` column/badge if displayed

### 7.4 Order List Page (orders/page.tsx)

- Update status tabs: 전체, 초안, 접수, 배송완료, 발행완료, 취소
- Remove any `processing` tab

### 7.5 Status Badge Colors

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

### Service
- Modify: `apps/web/src/lib/tax-invoice/service.ts` — replace recomputeOrderInvoiceStatus with direct transitions
- Modify: `apps/web/src/lib/queries/orders.ts` — remove processing references

### UI
- Modify: `apps/web/src/components/order-detail-client.tsx` — update buttons, remove processing
- Modify: `apps/web/src/components/order-status-actions.tsx` — update NEXT_STATUS map
- Modify: `apps/web/src/components/order-table.tsx` — update badges, remove processing
- Modify: `apps/web/src/components/order-detail.tsx` — if it references processing
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx` — update status tabs

### Queries
- Modify: `apps/web/src/lib/queries/invoices.ts` — remove tax_invoice_status references in getUnbilledOrders
- Modify: `apps/web/src/lib/tax-invoice/types.ts` — remove UnbilledOrder.tax_invoice_status or update

## 9. What Does NOT Change

- Tax invoice tables and their own lifecycle (draft/issued/sent/cancelled/modified) — unchanged
- Invoice creation flow (select orders → set date → create) — unchanged
- PDF generation — unchanged
- Company settings — unchanged

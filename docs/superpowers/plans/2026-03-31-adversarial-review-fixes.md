# Adversarial Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three critical issues found in the adversarial review: realtime disabled in production, non-idempotent invoice creation, and invoice header/item calculation mismatch.

**Architecture:** Three independent fixes — (1) env-var-gated realtime hook, (2) DB trigger + app-level guard for invoice idempotency, (3) extracted pure calculation helper used consistently by both header and item rows.

**Tech Stack:** Next.js 16 / React 19 Server Actions, Supabase (PostgreSQL + Realtime), Vitest for unit tests, TypeScript strict.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `apps/web/src/hooks/use-realtime.ts` | Replace hostname guard with env-var flag |
| Modify | `apps/web/.env.local.example` | Document `NEXT_PUBLIC_REALTIME_DISABLED` |
| Create | `packages/supabase/migrations/00068_tax_invoice_order_guard.sql` | DB trigger preventing duplicate active invoice per order |
| Create | `apps/web/src/lib/tax-invoice/calc.ts` | Pure `resolveItemSupply()` helper, shared by header + items |
| Modify | `apps/web/src/lib/tax-invoice/service.ts` | Add idempotency guard + import `resolveItemSupply` |
| Create | `apps/web/vitest.config.ts` | Minimal Vitest config (Node environment) |
| Modify | `apps/web/package.json` | Add `vitest` devDependency + `test` script |
| Create | `apps/web/src/lib/tax-invoice/__tests__/calc.test.ts` | Unit tests for `resolveItemSupply` |
| Create | `apps/web/src/lib/tax-invoice/__tests__/service.idempotency.test.ts` | Unit test for duplicate-invoice guard |

---

## Task 1: Fix realtime — replace hostname guard with env-var flag

**Problem:** `use-realtime.ts:26` returns early for any non-localhost hostname, disabling realtime in all production deployments.

**Fix:** Read `NEXT_PUBLIC_REALTIME_DISABLED` env var instead of inspecting `window.location.hostname`. Set this var in Docker/local Cloudflare environments; leave it unset on Vercel.

**Files:**
- Modify: `apps/web/src/hooks/use-realtime.ts:22-27`
- Modify: `apps/web/.env.local.example`

- [ ] **Step 1: Edit use-realtime.ts**

Replace lines 22–27:

```diff
-  useEffect(() => {
-    // Skip realtime on external domains (Cloudflare Tunnel can't proxy WebSocket)
-    if (typeof window !== "undefined") {
-      const h = window.location.hostname;
-      if (h !== "localhost" && h !== "127.0.0.1") return;
-    }
+  useEffect(() => {
+    // Opt-out via env var for environments where WebSocket is unavailable (e.g. Cloudflare Tunnel)
+    if (process.env.NEXT_PUBLIC_REALTIME_DISABLED === "true") return;
```

- [ ] **Step 2: Document env var in .env.local.example**

Add after the existing env var block (or near the end) in `apps/web/.env.local.example`:

```
# Set to "true" in environments where Supabase Realtime WebSocket is unavailable
# (e.g. local Cloudflare Tunnel docker-compose). Leave unset for Vercel/production.
NEXT_PUBLIC_REALTIME_DISABLED=
```

- [ ] **Step 3: Verify it builds**

```bash
npm run build:web
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-realtime.ts apps/web/.env.local.example
git commit -m "fix(web): restore realtime subscriptions on deployed domains via env-var opt-out"
```

---

## Task 2: Set up Vitest

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 1: Install Vitest**

```bash
cd apps/web && npm install --save-dev vitest
```

- [ ] **Step 2: Create vitest.config.ts**

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

In `apps/web/package.json`, add to `"scripts"`:
```json
"test": "vitest run --passWithNoTests"
```

- [ ] **Step 4: Verify Vitest runs**

```bash
cd apps/web && npm test
```

Expected: exits 0 with "No test files found" message.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/web/vitest.config.ts apps/web/package.json apps/web/package-lock.json
git commit -m "chore(web): add Vitest test runner"
```

---

## Task 3: Fix calculation mismatch — extract resolveItemSupply helper

**Problem:** In `service.ts`, the invoice **header** totals fall back to `lineSupply(unitPrice, qty)` when `line_total` is missing (line 39), but the **item rows** fall back to `0` (line 79 and 209). This produces an invoice whose header total is non-zero but whose line items sum to zero.

**Fix:** Extract `resolveItemSupply(item)` as a pure function in a new `calc.ts` module. Use it in both the header aggregation loop and the item row construction — in both `createInvoiceFromOrder` and `createConsolidatedInvoice`.

**Files:**
- Create: `apps/web/src/lib/tax-invoice/calc.ts`
- Modify: `apps/web/src/lib/tax-invoice/service.ts`
- Create: `apps/web/src/lib/tax-invoice/__tests__/calc.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/lib/tax-invoice/__tests__/calc.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveItemSupply } from "../calc";

describe("resolveItemSupply", () => {
  it("uses line_total when present and non-zero", () => {
    expect(resolveItemSupply({ line_total: 50000, unit_price: 60000, quantity: 1 })).toBe(50000);
  });

  it("falls back to lineSupply(unit_price, qty) when line_total is null", () => {
    // lineSupply(10000, 3) = round(10000 * 3) = 30000
    expect(resolveItemSupply({ line_total: null, unit_price: 10000, quantity: 3 })).toBe(30000);
  });

  it("falls back to lineSupply when line_total is 0 (stale)", () => {
    expect(resolveItemSupply({ line_total: 0, unit_price: 10000, quantity: 3 })).toBe(30000);
  });

  it("returns 0 when both line_total and unit_price are null", () => {
    expect(resolveItemSupply({ line_total: null, unit_price: null, quantity: 5 })).toBe(0);
  });
});

describe("resolveItemSupply consistency: header and item agree", () => {
  it("two calls with same args return equal values (no split-brain)", () => {
    const item = { line_total: null as null, unit_price: 25000, quantity: 2 };
    const headerContrib = resolveItemSupply(item);
    const itemRowAmount = resolveItemSupply(item);
    expect(headerContrib).toBe(itemRowAmount);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/web && npm test
```

Expected: FAIL — "Cannot find module '../calc'"

- [ ] **Step 3: Create calc.ts**

```typescript
// apps/web/src/lib/tax-invoice/calc.ts
import { lineSupply } from "@/lib/price-calc";

export interface OrderItemLike {
  line_total: number | null | undefined;
  unit_price: number | null | undefined;
  quantity: number;
}

/**
 * Canonical supply amount for one order item used by both invoice header
 * aggregation and invoice_items row construction.
 *
 * Priority: line_total (if > 0) → lineSupply(unit_price, qty) → 0
 */
export function resolveItemSupply(item: OrderItemLike): number {
  if (item.line_total) return item.line_total;
  if (item.unit_price) return lineSupply(item.unit_price, item.quantity);
  return 0;
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd apps/web && npm test
```

Expected: 5 tests pass.

- [ ] **Step 5: Update service.ts to use resolveItemSupply**

Add import at top of `apps/web/src/lib/tax-invoice/service.ts`:
```typescript
import { resolveItemSupply } from "./calc";
```

Remove the `lineSupply` and `lineTax` imports (both are now unused — tax is computed inline as `Math.floor(supply * 0.1)`, and supply calculation is delegated to `calc.ts`):

```diff
-import { lineSupply, lineTax } from "@/lib/price-calc";
+import { resolveItemSupply } from "./calc";
```

In `createInvoiceFromOrder`, replace the header aggregation loop (lines 36–42):

```diff
   for (const item of orderItems) {
     const qty = item.quantity as number;
-    const unitPrice = item.unit_price as number | null;
-    const supply = (item.line_total as number) || (unitPrice ? lineSupply(unitPrice, qty) : 0);
+    const supply = resolveItemSupply({
+      line_total: item.line_total as number | null,
+      unit_price: item.unit_price as number | null,
+      quantity: qty,
+    });
     supplyAmount += supply;
     taxAmount += Math.floor(supply * 0.1);
   }
```

Replace the item row construction (line 79):

```diff
   const items = orderItems.map((item, idx) => {
-    const supply = (item.line_total as number) || 0;
+    const supply = resolveItemSupply({
+      line_total: item.line_total as number | null,
+      unit_price: item.unit_price as number | null,
+      quantity: item.quantity as number,
+    });
     return {
```

In `createConsolidatedInvoice`, replace the header aggregation loop (lines 154–159):

```diff
     for (const item of items) {
-      const supply = (item.line_total as number) || ((item.quantity as number) * ((item.unit_price as number) || 0));
+      const supply = resolveItemSupply({
+        line_total: item.line_total as number | null,
+        unit_price: item.unit_price as number | null,
+        quantity: item.quantity as number,
+      });
       const tax = Math.floor(supply * 0.1);
```

Replace the consolidated item row construction (line 209):

```diff
       const items = orderItems.map((item) => {
-        const supply = (item.line_total as number) || 0;
+        const supply = resolveItemSupply({
+          line_total: item.line_total as number | null,
+          unit_price: item.unit_price as number | null,
+          quantity: item.quantity as number,
+        });
         return {
```

- [ ] **Step 6: Verify build still passes**

```bash
npm run build:web
```

Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/tax-invoice/calc.ts \
        apps/web/src/lib/tax-invoice/service.ts \
        apps/web/src/lib/tax-invoice/__tests__/calc.test.ts
git commit -m "fix(web): unify invoice item supply calculation — header and items now use identical resolveItemSupply helper"
```

---

## Task 4: Make invoice creation idempotent

**Problem:** `createInvoiceFromOrder` and `createConsolidatedInvoice` insert a new invoice without first checking if the order already has an active (non-cancelled) invoice. Double-clicks or retries produce duplicate issued invoices.

**Fix:**
1. **DB trigger** (hard guard): `tax_invoice_orders` BEFORE INSERT trigger raises an exception if the order_id is already linked to a non-cancelled invoice.
2. **App-level guard**: Check before issuing and throw a friendly Korean error message.

**Files:**
- Create: `packages/supabase/migrations/00068_tax_invoice_order_guard.sql`
- Modify: `apps/web/src/lib/tax-invoice/service.ts`
- Create: `apps/web/src/lib/tax-invoice/__tests__/service.idempotency.test.ts`

### Sub-task 4a: DB migration

- [ ] **Step 1: Create migration**

Create `packages/supabase/migrations/00068_tax_invoice_order_guard.sql`:

```sql
-- 00068_tax_invoice_order_guard.sql
-- Prevents an order from being linked to more than one active invoice.
-- "Active" means status is not 'cancelled'.

CREATE OR REPLACE FUNCTION check_invoice_order_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tax_invoice_orders tio
    JOIN tax_invoices ti ON ti.id = tio.invoice_id
    WHERE tio.order_id = NEW.order_id
      AND ti.status NOT IN ('cancelled')
  ) THEN
    RAISE EXCEPTION
      'Order % is already linked to an active invoice', NEW.order_id
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_duplicate_invoice_order
  BEFORE INSERT ON tax_invoice_orders
  FOR EACH ROW
  EXECUTE FUNCTION check_invoice_order_uniqueness();
```

- [ ] **Step 2: Apply to local Supabase (if running)**

```bash
npm run supabase:start
# then apply the new migration:
npx supabase db push
```

If local Supabase is not running, skip — migration runs automatically on next `npm run supabase:reset`.

- [ ] **Step 3: Commit migration**

```bash
git add packages/supabase/migrations/00068_tax_invoice_order_guard.sql
git commit -m "feat(db): add trigger to prevent duplicate active invoice per order"
```

### Sub-task 4b: App-level guard + tests

- [ ] **Step 4: Write failing test**

Create `apps/web/src/lib/tax-invoice/__tests__/service.idempotency.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// Import the guard helper we will extract in step 6:
import { assertOrderNotAlreadyInvoiced } from "../service";

// Mock shape matches the query in assertOrderNotAlreadyInvoiced:
// supabase.from().select().eq().maybeSingle()
function makeMock(data: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data, error: null }),
        }),
      }),
    }),
  };
}

describe("assertOrderNotAlreadyInvoiced", () => {
  it("resolves without error when no linked invoice exists", async () => {
    await expect(
      assertOrderNotAlreadyInvoiced(makeMock(null) as never, 42),
    ).resolves.toBeUndefined();
  });

  it("resolves when the linked invoice is cancelled", async () => {
    await expect(
      assertOrderNotAlreadyInvoiced(
        makeMock({ invoice_id: 7, tax_invoices: { status: "cancelled" } }) as never,
        42,
      ),
    ).resolves.toBeUndefined();
  });

  it("throws when an active (issued) invoice already exists for the order", async () => {
    await expect(
      assertOrderNotAlreadyInvoiced(
        makeMock({ invoice_id: 7, tax_invoices: { status: "issued" } }) as never,
        42,
      ),
    ).rejects.toThrow("이미 발행된 세금계산서가 있습니다");
  });

  it("throws when a draft invoice is linked (draft is also active)", async () => {
    await expect(
      assertOrderNotAlreadyInvoiced(
        makeMock({ invoice_id: 3, tax_invoices: { status: "draft" } }) as never,
        42,
      ),
    ).rejects.toThrow("이미 발행된 세금계산서가 있습니다");
  });
});
```

- [ ] **Step 5: Run test — confirm it fails**

```bash
cd apps/web && npm test
```

Expected: FAIL — "assertOrderNotAlreadyInvoiced is not exported"

- [ ] **Step 6: Extract and export guard helper in service.ts**

Add this function near the top of `apps/web/src/lib/tax-invoice/service.ts`, before `createInvoiceFromOrder`:

```typescript
/**
 * Throws if the order already has a non-cancelled active invoice.
 * Used as a pre-flight guard before issuing a new invoice.
 *
 * Uses a plain join (not !inner) so the query works regardless of RLS;
 * status filtering is done in application code to avoid PostgREST
 * embedded-filter edge cases.
 */
export async function assertOrderNotAlreadyInvoiced(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orderId: number,
): Promise<void> {
  const { data } = await supabase
    .from("tax_invoice_orders")
    .select("invoice_id, tax_invoices(status)")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!data) return;

  const status = (data.tax_invoices as { status: string } | null)?.status;
  if (status && status !== "cancelled") {
    throw new Error("이미 발행된 세금계산서가 있습니다. 기존 계산서를 확인해주세요.");
  }
}
```

- [ ] **Step 7: Call the guard in createInvoiceFromOrder**

Insert guard call right after the `if (orderErr || !order)` check (after line 19 in current service.ts):

```typescript
  await assertOrderNotAlreadyInvoiced(supabase, orderId);
```

- [ ] **Step 8: Call the guard in createConsolidatedInvoice**

For consolidated invoice, check ALL order IDs before any inserts begin (pre-flight, so no partial inserts occur if a later order fails the guard). Insert after the orders are fetched and validated (after line 136), before the `supabase.rpc("generate_invoice_number")` call:

```typescript
  // Pre-flight: verify no order is already linked to an active invoice
  for (const id of orderIds) {
    await assertOrderNotAlreadyInvoiced(supabase, id);
  }
```

- [ ] **Step 9: Run tests — confirm all pass**

```bash
cd apps/web && npm test
```

Expected: all tests pass (calc.test.ts + service.idempotency.test.ts).

- [ ] **Step 10: Verify build**

```bash
npm run build:web
```

Expected: no TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/lib/tax-invoice/service.ts \
        apps/web/src/lib/tax-invoice/__tests__/service.idempotency.test.ts
git commit -m "fix(web): make invoice creation idempotent — guard against duplicate active invoice per order"
```

---

## Verification Checklist

- [ ] `npm run build:web` passes with no errors
- [ ] `cd apps/web && npm test` — all tests green
- [ ] Realtime: deploy to staging/Vercel and confirm `router.refresh()` fires on a Supabase INSERT outside localhost
- [ ] Idempotency: manually trigger "발행" twice on the same order — second attempt shows Korean error message
- [ ] Calculation: create an invoice for an order with null `line_total` — PDF line items should show non-zero supply amounts matching the header total

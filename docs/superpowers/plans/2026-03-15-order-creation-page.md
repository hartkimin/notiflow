# Order Creation Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated order creation page (`/orders/new`) with hospital selection, multi-source item picking (hospital products, supplier products, my items, MFDS search), per-item supplier/pricing/margin, unit dropdown with custom input, configurable columns, and KPIS reference number entry.

**Architecture:** New page route `/orders/new` with a Server Component loading display settings, and a Client Component managing the full form state. Items are selected through a 4-tab picker, added to an editable table with margin calculations, then submitted via a new `createOrderWithDetailsAction` server action. A new `hospital_products` junction table tracks per-hospital product assignments with selling prices.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (PostgreSQL), shadcn/ui, TanStack Table, TypeScript, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-15-order-creation-page-design.md`

---

## Chunk 1: Database & Types Foundation

### Task 1: Create `hospital_products` migration

**Files:**
- Create: `packages/supabase/migrations/00037_hospital_products.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 00037_hospital_products.sql
-- Hospital-Product junction table for tracking per-hospital product assignments and selling prices

CREATE TABLE hospital_products (
  id              SERIAL PRIMARY KEY,
  hospital_id     INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  product_id      INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  selling_price   DECIMAL(12,2),
  default_quantity INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, product_id)
);

CREATE INDEX idx_hospital_products_hospital ON hospital_products(hospital_id);
CREATE INDEX idx_hospital_products_product ON hospital_products(product_id);

-- Auto-update trigger (reuse existing function from 00001)
CREATE TRIGGER trg_hospital_products_updated
  BEFORE UPDATE ON hospital_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS policies
ALTER TABLE hospital_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read hospital_products"
  ON hospital_products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert hospital_products"
  ON hospital_products FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update hospital_products"
  ON hospital_products FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete hospital_products"
  ON hospital_products FOR DELETE TO authenticated USING (true);
```

- [ ] **Step 2: Apply migration to local Supabase**

Run: `cd D:/Project/09_NotiFlow && npx supabase db push --local`
Expected: Migration applied successfully. If `update_updated_at()` function doesn't exist by that name, check migration 00001 for the actual trigger function name and adjust.

- [ ] **Step 3: Verify table exists**

Run: `docker exec supabase_db_supabase psql -U postgres -d postgres -c "\d hospital_products"`
Expected: Table schema with all columns, indexes, and constraints displayed.

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/migrations/00037_hospital_products.sql
git commit -m "feat: add hospital_products table for per-hospital product assignments"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `apps/web/src/lib/types.ts`

- [ ] **Step 1: Add `purchase_price` to `OrderItem` interface**

In `apps/web/src/lib/types.ts`, find the `OrderItem` interface (line 34-43) and add `purchase_price`:

```typescript
export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  supplier_id: number | null;
  quantity: number;
  unit_type: string;
  unit_price: number | null;
  purchase_price: number | null;
  line_total: number | null;
}
```

- [ ] **Step 2: Add `purchase_price` to `OrderItemFlat` interface**

In the same file, find `OrderItemFlat` (line 57-75) and add `purchase_price`:

```typescript
export interface OrderItemFlat {
  id: number;
  order_id: number;
  order_number: string;
  order_date: string;
  delivery_date: string | null;
  hospital_id: number | null;
  hospital_name: string;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_type: string;
  box_quantity: number | null;
  supplier_id: number | null;
  supplier_name: string | null;
  purchase_price: number | null;
  kpis_status: string | null;
  kpis_notes: string | null;
  status: string;
}
```

- [ ] **Step 3: Add `HospitalProduct` interface**

Append to `types.ts`:

```typescript
export interface HospitalProduct {
  id: number;
  hospital_id: number;
  product_id: number;
  product_name: string;
  selling_price: number | null;
  default_quantity: number | null;
  suppliers: Array<{
    supplier_id: number;
    supplier_name: string;
    purchase_price: number | null;
    is_primary: boolean;
  }>;
}

export interface ProductSupplierOption {
  supplier_id: number;
  supplier_name: string;
  purchase_price: number | null;
  is_primary: boolean;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd D:/Project/09_NotiFlow/apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors related to `OrderItem` or `OrderItemFlat` changes. (Existing errors may exist but should not increase.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat: add purchase_price to OrderItem types and HospitalProduct interface"
```

---

### Task 3: Add unit type constants

**Files:**
- Create: `apps/web/src/lib/unit-types.ts`

- [ ] **Step 1: Create unit types file**

```typescript
export const UNIT_OPTIONS = [
  { value: "piece", label: "개" },
  { value: "box", label: "박스" },
  { value: "pack", label: "팩" },
  { value: "set", label: "세트" },
  { value: "bottle", label: "병" },
  { value: "ampoule", label: "앰플" },
  { value: "vial", label: "바이알" },
] as const;

export type UnitType = (typeof UNIT_OPTIONS)[number]["value"];

export const CUSTOM_UNIT_VALUE = "__custom__" as const;

export function getUnitLabel(value: string): string {
  const found = UNIT_OPTIONS.find((o) => o.value === value);
  return found ? found.label : value;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/unit-types.ts
git commit -m "feat: add unit type constants for order item units"
```

---

## Chunk 2: Query Layer & Server Actions

### Task 4: Create hospital-products query module

**Files:**
- Create: `apps/web/src/lib/queries/hospital-products.ts`

- [ ] **Step 1: Write the query functions**

```typescript
import { createClient } from "@/lib/supabase/server";
import type { HospitalProduct, ProductSupplierOption } from "@/lib/types";

/**
 * Get products registered to a hospital with their supplier info.
 */
export async function getHospitalProducts(
  hospitalId: number,
): Promise<HospitalProduct[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("hospital_products")
    .select(
      "id, hospital_id, product_id, selling_price, default_quantity, products(name, official_name, short_name)",
    )
    .eq("hospital_id", hospitalId)
    .order("id");

  if (error) throw error;

  const productIds = (data ?? [])
    .map((d: Record<string, unknown>) => d.product_id as number)
    .filter(Boolean);

  // Fetch suppliers for all products in one query
  let supplierMap: Record<number, ProductSupplierOption[]> = {};
  if (productIds.length > 0) {
    const { data: ps } = await supabase
      .from("product_suppliers")
      .select("product_id, supplier_id, purchase_price, is_primary, suppliers(name)")
      .in("product_id", productIds);

    supplierMap = {};
    for (const row of ps ?? []) {
      const pid = row.product_id as number;
      if (!supplierMap[pid]) supplierMap[pid] = [];
      supplierMap[pid].push({
        supplier_id: row.supplier_id as number,
        supplier_name: (row.suppliers as { name: string } | null)?.name ?? "",
        purchase_price: row.purchase_price as number | null,
        is_primary: row.is_primary as boolean,
      });
    }
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const product = row.products as {
      name: string;
      official_name: string;
      short_name: string | null;
    } | null;
    const pid = row.product_id as number;
    return {
      id: row.id as number,
      hospital_id: row.hospital_id as number,
      product_id: pid,
      product_name:
        product?.official_name ?? product?.short_name ?? product?.name ?? "",
      selling_price: row.selling_price as number | null,
      default_quantity: row.default_quantity as number | null,
      suppliers: supplierMap[pid] ?? [],
    };
  });
}

/**
 * Get products this hospital ordered in the last 6 months (not already in hospital_products).
 */
export async function getHospitalOrderHistory(
  hospitalId: number,
): Promise<
  Array<{
    product_id: number;
    product_name: string;
    order_count: number;
    last_ordered: string;
  }>
> {
  const supabase = await createClient();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const fromDate = sixMonthsAgo.toISOString().split("T")[0];

  // Get existing hospital_product product_ids to exclude
  const { data: existing } = await supabase
    .from("hospital_products")
    .select("product_id")
    .eq("hospital_id", hospitalId);
  const existingIds = new Set(
    (existing ?? []).map((e: { product_id: number }) => e.product_id),
  );

  // Get order items for this hospital in last 6 months
  const { data, error } = await supabase
    .from("order_items")
    .select(
      "product_id, orders!inner(hospital_id, order_date), products(official_name, short_name, name)",
    )
    .eq("orders.hospital_id", hospitalId)
    .gte("orders.order_date", fromDate)
    .not("product_id", "is", null);

  if (error) throw error;

  // Aggregate by product_id
  const agg: Record<
    number,
    { product_name: string; count: number; last: string }
  > = {};
  for (const row of data ?? []) {
    const pid = row.product_id as number;
    if (existingIds.has(pid)) continue;
    const product = row.products as {
      official_name: string;
      short_name: string | null;
      name: string;
    } | null;
    const orderDate = (row.orders as { order_date: string })?.order_date ?? "";
    if (!agg[pid]) {
      agg[pid] = {
        product_name:
          product?.official_name ?? product?.short_name ?? product?.name ?? "",
        count: 0,
        last: orderDate,
      };
    }
    agg[pid].count++;
    if (orderDate > agg[pid].last) agg[pid].last = orderDate;
  }

  return Object.entries(agg)
    .map(([pid, val]) => ({
      product_id: Number(pid),
      product_name: val.product_name,
      order_count: val.count,
      last_ordered: val.last,
    }))
    .sort((a, b) => b.order_count - a.order_count);
}

/**
 * Get products for a specific supplier.
 */
export async function getSupplierProducts(supplierId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_suppliers")
    .select(
      "product_id, purchase_price, is_primary, products(name, official_name, short_name)",
    )
    .eq("supplier_id", supplierId)
    .order("product_id");

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const product = row.products as {
      name: string;
      official_name: string;
      short_name: string | null;
    } | null;
    return {
      product_id: row.product_id as number,
      product_name:
        product?.official_name ?? product?.short_name ?? product?.name ?? "",
      purchase_price: row.purchase_price as number | null,
      is_primary: row.is_primary as boolean,
    };
  });
}

/**
 * Get all suppliers carrying a specific product.
 */
export async function getProductSuppliers(
  productId: number,
): Promise<ProductSupplierOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_suppliers")
    .select("supplier_id, purchase_price, is_primary, suppliers(name)")
    .eq("product_id", productId);

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    supplier_id: row.supplier_id as number,
    supplier_name: (row.suppliers as { name: string } | null)?.name ?? "",
    purchase_price: row.purchase_price as number | null,
    is_primary: row.is_primary as boolean,
  }));
}

/**
 * Resolve a my_drug/my_device/mfds item to a products.id.
 * If no matching product exists, auto-inserts into products table.
 */
export async function resolveProductId(source: {
  type: "my_drug" | "my_device" | "mfds";
  sourceId: number;
  name: string;
  manufacturer?: string;
  standardCode?: string;
}): Promise<number> {
  const supabase = await createClient();

  // 1. Try to find by standard_code
  if (source.standardCode) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("standard_code", source.standardCode)
      .eq("is_active", true)
      .limit(1)
      .single();
    if (existing) return existing.id;
  }

  // 2. Try to find by mfds_item_id (for mfds type)
  if (source.type === "mfds") {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("mfds_item_id", source.sourceId)
      .eq("is_active", true)
      .limit(1)
      .single();
    if (existing) return existing.id;
  }

  // 3. Auto-insert into products
  const { data: newProduct, error } = await supabase
    .from("products")
    .insert({
      name: source.name,
      official_name: source.name,
      manufacturer: source.manufacturer ?? null,
      standard_code: source.standardCode ?? null,
      mfds_item_id: source.type === "mfds" ? source.sourceId : null,
      category: "other",
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw error;
  return newProduct.id;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd D:/Project/09_NotiFlow/apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/queries/hospital-products.ts
git commit -m "feat: add hospital-products query module with supplier and product resolution"
```

---

### Task 5: Add new server actions to orders/actions.ts

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/actions.ts`

- [ ] **Step 1: Add `getHospitalProductsAction`**

Append to `apps/web/src/app/(dashboard)/orders/actions.ts`:

```typescript
export async function getHospitalProductsAction(hospitalId: number) {
  const { getHospitalProducts } = await import("@/lib/queries/hospital-products");
  return getHospitalProducts(hospitalId);
}

export async function getHospitalOrderHistoryAction(hospitalId: number) {
  const { getHospitalOrderHistory } = await import("@/lib/queries/hospital-products");
  return getHospitalOrderHistory(hospitalId);
}

export async function getSupplierProductsAction(supplierId: number) {
  const { getSupplierProducts } = await import("@/lib/queries/hospital-products");
  return getSupplierProducts(supplierId);
}

export async function getProductSuppliersAction(productId: number) {
  const { getProductSuppliers } = await import("@/lib/queries/hospital-products");
  return getProductSuppliers(productId);
}

export async function resolveProductIdAction(source: {
  type: "my_drug" | "my_device" | "mfds";
  sourceId: number;
  name: string;
  manufacturer?: string;
  standardCode?: string;
}) {
  const { resolveProductId } = await import("@/lib/queries/hospital-products");
  return resolveProductId(source);
}
```

- [ ] **Step 2: Add `createOrderWithDetailsAction`**

Append to the same file:

```typescript
export async function createOrderWithDetailsAction(data: {
  hospital_id: number;
  order_date: string;
  delivery_date: string | null;
  delivered_at: string | null;
  notes: string | null;
  source_message_id: string | null;
  items: Array<{
    product_id: number;
    supplier_id: number | null;
    quantity: number;
    unit_type: string;
    purchase_price: number | null;
    unit_price: number | null;
    kpis_reference_number: string | null;
  }>;
}) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // 1. Generate order number
  const { data: orderNumber, error: rpcErr } = await supabase.rpc("generate_order_number");
  if (rpcErr) throw rpcErr;

  // 2. Calculate total
  const totalAmount = data.items.reduce((sum, item) => {
    const lineTotal = (item.unit_price ?? 0) * item.quantity;
    return sum + lineTotal;
  }, 0);

  // 3. Insert order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      order_date: data.order_date,
      hospital_id: data.hospital_id,
      delivery_date: data.delivery_date,
      delivered_at: data.delivered_at,
      notes: data.notes,
      source_message_id: data.source_message_id,
      status: "draft",
      total_items: data.items.length,
      total_amount: totalAmount || null,
    })
    .select("id")
    .single();
  if (orderErr) throw orderErr;

  // 4. Insert order items and get IDs back
  if (data.items.length > 0) {
    const orderItems = data.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      supplier_id: item.supplier_id,
      quantity: item.quantity,
      unit_type: item.unit_type,
      unit_price: item.unit_price,
      purchase_price: item.purchase_price,
      line_total: item.unit_price ? item.unit_price * item.quantity : null,
      match_status: "manual" as const,
    }));

    const { data: insertedItems, error: itemsErr } = await supabase
      .from("order_items")
      .insert(orderItems)
      .select("id");
    if (itemsErr) throw itemsErr;

    // 5. Insert KPIS reports for items with reference numbers
    const kpisInserts: Array<{
      order_item_id: number;
      reference_number: string;
      report_status: string;
    }> = [];

    for (let i = 0; i < data.items.length; i++) {
      const ref = data.items[i].kpis_reference_number;
      if (ref && insertedItems?.[i]) {
        kpisInserts.push({
          order_item_id: insertedItems[i].id,
          reference_number: ref,
          report_status: "pending",
        });
      }
    }

    if (kpisInserts.length > 0) {
      const { error: kpisErr } = await supabase
        .from("kpis_reports")
        .insert(kpisInserts);
      if (kpisErr) throw kpisErr;
    }
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true, orderId: order.id, orderNumber };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd D:/Project/09_NotiFlow/apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/orders/actions.ts
git commit -m "feat: add server actions for order creation with details, hospital products, and product resolution"
```

---

## Chunk 3: Order Creation Page & Form Shell

### Task 6: Create the `/orders/new` page route

**Files:**
- Create: `apps/web/src/app/(dashboard)/orders/new/page.tsx`

- [ ] **Step 1: Write the server component page**

```typescript
import { getOrderDisplayColumns } from "@/lib/queries/settings";
import { OrderCreateForm } from "@/components/order-create-form";

interface Props {
  searchParams: Promise<{
    source_message_id?: string;
  }>;
}

export default async function NewOrderPage({ searchParams }: Props) {
  const params = await searchParams;
  const displayColumns = await getOrderDisplayColumns();

  return (
    <div className="space-y-4">
      <OrderCreateForm
        displayColumns={displayColumns}
        sourceMessageId={params.source_message_id}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/(dashboard)/orders/new/page.tsx
git commit -m "feat: add /orders/new page route"
```

---

### Task 7: Create the main order creation form component

**Files:**
- Create: `apps/web/src/components/order-create-form.tsx`

This is the main client component managing all form state. It renders 4 sections:
1. Header (back link, title, submit/cancel buttons)
2. Basic info (hospital, dates)
3. Item selector (tabs)
4. Item table + summary

- [ ] **Step 1: Write the form shell with state management**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SearchableCombobox } from "@/components/searchable-combobox";
import {
  searchHospitalsAction,
  createOrderWithDetailsAction,
} from "@/app/(dashboard)/orders/actions";
import { OrderCreateItemSelector } from "@/components/order-create-item-selector";
import { OrderCreateItemTable } from "@/components/order-create-item-table";
import type { OrderDisplayColumns } from "@/lib/queries/settings";
import type { ProductSupplierOption } from "@/lib/types";

export interface OrderCreateItem {
  /** Client-side key for React list rendering */
  key: string;
  product_id: number;
  product_name: string;
  supplier_id: number | null;
  supplier_name: string | null;
  quantity: number;
  unit_type: string;
  purchase_price: number | null;
  unit_price: number | null;
  kpis_reference_number: string;
  /** Available suppliers for this product */
  suppliers: ProductSupplierOption[];
  /** Source info for configurable columns */
  source_type: "drug" | "device" | "product";
  raw: Record<string, unknown>;
}

interface OrderCreateFormProps {
  displayColumns: OrderDisplayColumns;
  sourceMessageId?: string;
}

export function OrderCreateForm({
  displayColumns,
  sourceMessageId,
}: OrderCreateFormProps) {
  const router = useRouter();
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [hospitalName, setHospitalName] = useState<string>("");
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderCreateItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleHospitalSelect(id: number, name?: string) {
    setHospitalId(id);
    if (name) setHospitalName(name);
  }

  function addItem(item: OrderCreateItem) {
    if (items.some((i) => i.product_id === item.product_id)) {
      toast.error("이미 추가된 품목입니다");
      return;
    }
    setItems((prev) => [...prev, item]);
  }

  function updateItem(key: string, updates: Partial<OrderCreateItem>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...updates } : item)),
    );
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  // Summary calculations
  const totalPurchase = items.reduce(
    (sum, i) => sum + (i.purchase_price ?? 0) * i.quantity,
    0,
  );
  const totalSelling = items.reduce(
    (sum, i) => sum + (i.unit_price ?? 0) * i.quantity,
    0,
  );
  const totalMargin = totalSelling - totalPurchase;
  const marginRate = totalSelling > 0 ? (totalMargin / totalSelling) * 100 : 0;

  async function handleSubmit() {
    if (!hospitalId) {
      toast.error("거래처를 선택해주세요");
      return;
    }
    if (items.length === 0) {
      toast.error("품목을 추가해주세요");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createOrderWithDetailsAction({
        hospital_id: hospitalId,
        order_date: orderDate,
        delivery_date: deliveryDate || null,
        delivered_at: deliveredAt || null,
        notes: notes || null,
        source_message_id: sourceMessageId ?? null,
        items: items.map((item) => ({
          product_id: item.product_id,
          supplier_id: item.supplier_id,
          quantity: item.quantity,
          unit_type: item.unit_type,
          purchase_price: item.purchase_price,
          unit_price: item.unit_price,
          kpis_reference_number: item.kpis_reference_number || null,
        })),
      });
      toast.success(`주문이 생성되었습니다 (${result.orderNumber})`);
      router.push("/orders");
    } catch (err) {
      toast.error("주문 생성 실패: " + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold md:text-2xl">새 주문 생성</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">취소</Link>
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                생성 중...
              </>
            ) : (
              "주문 생성"
            )}
          </Button>
        </div>
      </div>

      {/* Section 1: Basic Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">기본 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">거래처 *</Label>
              <SearchableCombobox
                value={hospitalId}
                displayName={hospitalName || undefined}
                placeholder="거래처 검색..."
                searchPlaceholder="거래처명 입력..."
                emptyText="거래처 없음"
                onSelect={(id) => {
                  // We need to get the name too — the combobox shows it
                  handleHospitalSelect(id);
                }}
                searchAction={searchHospitalsAction}
                className="w-[220px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">주문일</Label>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">배송예정일</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">실배송일</Label>
              <Input
                type="date"
                value={deliveredAt}
                onChange={(e) => setDeliveredAt(e.target.value)}
                className="w-[160px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Item Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">품목 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderCreateItemSelector
            hospitalId={hospitalId}
            onAddItem={addItem}
            existingProductIds={items.map((i) => i.product_id)}
          />
        </CardContent>
      </Card>

      {/* Section 3: Item Table */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              주문 품목 ({items.length}건)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OrderCreateItemTable
              items={items}
              displayColumns={displayColumns}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
            />
          </CardContent>
        </Card>
      )}

      {/* Section 4: Notes + Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">메모</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="주문 메모..."
                rows={3}
                className="text-sm"
              />
            </div>
            {items.length > 0 && (
              <div className="md:w-[280px] space-y-2 text-sm">
                <Separator className="md:hidden" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">총 매입액</span>
                  <span className="tabular-nums">
                    {totalPurchase.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">총 판매액</span>
                  <span className="tabular-nums font-medium">
                    {totalSelling.toLocaleString()}원
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">총 마진</span>
                  <span
                    className={`tabular-nums font-medium ${totalMargin >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {totalMargin.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">마진율</span>
                  <span className="tabular-nums">
                    {marginRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles** (will have errors for missing child components — expected at this stage)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/order-create-form.tsx
git commit -m "feat: add OrderCreateForm main component with state management and summary"
```

---

### Task 8: Update orders page to link to `/orders/new`

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx:96-101`

- [ ] **Step 1: Replace the inline form button area with a link to `/orders/new`**

In `apps/web/src/app/(dashboard)/orders/page.tsx`, change the header area (around line 94-108):

Replace:
```tsx
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <File className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">내보내기</span>
          </Button>
        </div>
```

With:
```tsx
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <File className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">내보내기</span>
          </Button>
          <Button size="sm" className="h-8 gap-1" asChild>
            <Link href="/orders/new">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">주문 추가</span>
            </Link>
          </Button>
        </div>
```

Add `PlusCircle` to the lucide-react import at line 2:

```typescript
import { File, PlusCircle } from "lucide-react";
```

Keep the existing `OrderInlineForm` as-is for backward compatibility (it's used for `create_from_message` flow).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/(dashboard)/orders/page.tsx
git commit -m "feat: add link to /orders/new from orders list page"
```

---

## Chunk 4: Item Selector Component (4 Tabs)

### Task 9: Create the item selector component

**Files:**
- Create: `apps/web/src/components/order-create-item-selector.tsx`

This component manages 4 tabs for finding and selecting items. Each tab searches a different data source but outputs the same `OrderCreateItem` shape to the parent.

- [ ] **Step 1: Write the item selector**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, Plus, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchableCombobox } from "@/components/searchable-combobox";
import { toast } from "sonner";
import {
  getHospitalProductsAction,
  getHospitalOrderHistoryAction,
  getSupplierProductsAction,
  getProductSuppliersAction,
  searchMyItemsAction,
  searchSuppliersAction,
  resolveProductIdAction,
} from "@/app/(dashboard)/orders/actions";
import type { OrderCreateItem } from "@/components/order-create-form";
import type { HospitalProduct } from "@/lib/types";

interface ItemSelectorProps {
  hospitalId: number | null;
  onAddItem: (item: OrderCreateItem) => void;
  existingProductIds: number[];
}

let keyCounter = 0;
function nextKey() {
  return `item-${Date.now()}-${++keyCounter}`;
}

export function OrderCreateItemSelector({
  hospitalId,
  onAddItem,
  existingProductIds,
}: ItemSelectorProps) {
  const [activeTab, setActiveTab] = useState("hospital");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="hospital">거래처 품목</TabsTrigger>
        <TabsTrigger value="supplier">공급사별 품목</TabsTrigger>
        <TabsTrigger value="my">내 품목</TabsTrigger>
        <TabsTrigger value="mfds">식약처 검색</TabsTrigger>
      </TabsList>

      <TabsContent value="hospital" className="mt-3">
        <HospitalItemsTab
          hospitalId={hospitalId}
          onAddItem={onAddItem}
          existingProductIds={existingProductIds}
        />
      </TabsContent>

      <TabsContent value="supplier" className="mt-3">
        <SupplierItemsTab
          onAddItem={onAddItem}
          existingProductIds={existingProductIds}
        />
      </TabsContent>

      <TabsContent value="my" className="mt-3">
        <MyItemsTab
          onAddItem={onAddItem}
          existingProductIds={existingProductIds}
        />
      </TabsContent>

      <TabsContent value="mfds" className="mt-3">
        <MfdsSearchTab
          onAddItem={onAddItem}
          existingProductIds={existingProductIds}
        />
      </TabsContent>
    </Tabs>
  );
}

// ── Tab 1: Hospital Items ──────────────────────────────────

function HospitalItemsTab({
  hospitalId,
  onAddItem,
  existingProductIds,
}: {
  hospitalId: number | null;
  onAddItem: (item: OrderCreateItem) => void;
  existingProductIds: number[];
}) {
  const [products, setProducts] = useState<HospitalProduct[]>([]);
  const [history, setHistory] = useState<
    Array<{ product_id: number; product_name: string; order_count: number; last_ordered: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hospitalId) {
      setProducts([]);
      setHistory([]);
      return;
    }
    setLoading(true);
    Promise.all([
      getHospitalProductsAction(hospitalId),
      getHospitalOrderHistoryAction(hospitalId),
    ])
      .then(([prods, hist]) => {
        setProducts(prods);
        setHistory(hist);
      })
      .finally(() => setLoading(false));
  }, [hospitalId]);

  if (!hospitalId) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        거래처를 먼저 선택하세요
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function handleAddHospitalProduct(hp: HospitalProduct) {
    if (existingProductIds.includes(hp.product_id)) {
      toast.error("이미 추가된 품목입니다");
      return;
    }
    const primary = hp.suppliers.find((s) => s.is_primary) ?? hp.suppliers[0];
    onAddItem({
      key: nextKey(),
      product_id: hp.product_id,
      product_name: hp.product_name,
      supplier_id: primary?.supplier_id ?? null,
      supplier_name: primary?.supplier_name ?? null,
      quantity: hp.default_quantity ?? 1,
      unit_type: "piece",
      purchase_price: primary?.purchase_price ?? null,
      unit_price: hp.selling_price,
      kpis_reference_number: "",
      suppliers: hp.suppliers,
      source_type: "product",
      raw: {},
    });
  }

  async function handleAddHistoryProduct(p: {
    product_id: number;
    product_name: string;
  }) {
    if (existingProductIds.includes(p.product_id)) {
      toast.error("이미 추가된 품목입니다");
      return;
    }
    const suppliers = await getProductSuppliersAction(p.product_id);
    const primary = suppliers.find((s) => s.is_primary) ?? suppliers[0];
    onAddItem({
      key: nextKey(),
      product_id: p.product_id,
      product_name: p.product_name,
      supplier_id: primary?.supplier_id ?? null,
      supplier_name: primary?.supplier_name ?? null,
      quantity: 1,
      unit_type: "piece",
      purchase_price: primary?.purchase_price ?? null,
      unit_price: null,
      kpis_reference_number: "",
      suppliers,
      source_type: "product",
      raw: {},
    });
  }

  return (
    <div className="space-y-4">
      {products.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">등록 품목</h4>
          <div className="space-y-1">
            {products.map((hp) => (
              <button
                key={hp.id}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent text-left"
                onClick={() => handleAddHospitalProduct(hp)}
                disabled={existingProductIds.includes(hp.product_id)}
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium flex-1">{hp.product_name}</span>
                {hp.selling_price != null && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    판매 {hp.selling_price.toLocaleString()}원
                  </span>
                )}
                {hp.suppliers.length > 0 && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    공급 {hp.suppliers.length}곳
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            과거 주문 이력 (최근 6개월)
          </h4>
          <div className="space-y-1">
            {history.map((h) => (
              <button
                key={h.product_id}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent text-left"
                onClick={() => handleAddHistoryProduct(h)}
                disabled={existingProductIds.includes(h.product_id)}
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium flex-1">{h.product_name}</span>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {h.order_count}회
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {products.length === 0 && history.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          등록된 품목이 없습니다. 다른 탭에서 품목을 검색하세요.
        </p>
      )}
    </div>
  );
}

// ── Tab 2: Supplier Items ──────────────────────────────────

function SupplierItemsTab({
  onAddItem,
  existingProductIds,
}: {
  onAddItem: (item: OrderCreateItem) => void;
  existingProductIds: number[];
}) {
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [products, setProducts] = useState<
    Array<{ product_id: number; product_name: string; purchase_price: number | null; is_primary: boolean }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supplierId) {
      setProducts([]);
      return;
    }
    setLoading(true);
    getSupplierProductsAction(supplierId)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [supplierId]);

  async function handleAdd(p: {
    product_id: number;
    product_name: string;
    purchase_price: number | null;
  }) {
    if (existingProductIds.includes(p.product_id)) {
      toast.error("이미 추가된 품목입니다");
      return;
    }
    const allSuppliers = await getProductSuppliersAction(p.product_id);
    onAddItem({
      key: nextKey(),
      product_id: p.product_id,
      product_name: p.product_name,
      supplier_id: supplierId,
      supplier_name: null,
      quantity: 1,
      unit_type: "piece",
      purchase_price: p.purchase_price,
      unit_price: null,
      kpis_reference_number: "",
      suppliers: allSuppliers,
      source_type: "product",
      raw: {},
    });
  }

  return (
    <div className="space-y-3">
      <SearchableCombobox
        value={supplierId}
        placeholder="공급사 선택..."
        searchPlaceholder="공급사 검색..."
        emptyText="공급사 없음"
        onSelect={setSupplierId}
        searchAction={searchSuppliersAction}
        className="w-[250px]"
      />

      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="space-y-1">
          {products.map((p) => (
            <button
              key={p.product_id}
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent text-left"
              onClick={() => handleAdd(p)}
              disabled={existingProductIds.includes(p.product_id)}
            >
              <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium flex-1">{p.product_name}</span>
              {p.purchase_price != null && (
                <span className="text-xs text-muted-foreground shrink-0">
                  매입 {p.purchase_price.toLocaleString()}원
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!loading && supplierId && products.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          해당 공급사의 취급 품목이 없습니다.
        </p>
      )}
    </div>
  );
}

// ── Tab 3: My Items ────────────────────────────────────────

function MyItemsTab({
  onAddItem,
  existingProductIds,
}: {
  onAddItem: (item: OrderCreateItem) => void;
  existingProductIds: number[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchMyItemsAction>>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchMyItemsAction(query);
        setResults(data);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleAdd(result: (typeof results)[number]) {
    try {
      const productId = await resolveProductIdAction({
        type: result.type === "drug" ? "my_drug" : "my_device",
        sourceId: result.id,
        name: result.name,
        manufacturer: result.manufacturer ?? undefined,
        standardCode: result.code ?? undefined,
      });

      if (existingProductIds.includes(productId)) {
        toast.error("이미 추가된 품목입니다");
        return;
      }

      const suppliers = await getProductSuppliersAction(productId);
      const primary = suppliers.find((s) => s.is_primary) ?? suppliers[0];

      onAddItem({
        key: nextKey(),
        product_id: productId,
        product_name: result.name,
        supplier_id: primary?.supplier_id ?? null,
        supplier_name: primary?.supplier_name ?? null,
        quantity: 1,
        unit_type: "piece",
        purchase_price: primary?.purchase_price ?? null,
        unit_price: result.unit_price,
        kpis_reference_number: "",
        suppliers,
        source_type: result.type === "drug" ? "drug" : "device",
        raw: result.raw,
      });
      setQuery("");
      setResults([]);
    } catch (err) {
      toast.error("품목 추가 실패: " + (err as Error).message);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="품목명, 코드, 업체명으로 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
        {searching && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {results.length > 0 && (
        <div className="border rounded-md max-h-[300px] overflow-y-auto">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent text-left"
              onClick={() => handleAdd(r)}
            >
              <Badge
                variant={r.type === "drug" ? "default" : "secondary"}
                className="text-xs shrink-0"
              >
                {r.type === "drug" ? "의약품" : "의료기기"}
              </Badge>
              <span className="truncate font-medium flex-1">{r.name}</span>
              {r.manufacturer && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {r.manufacturer}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 4: MFDS Search ─────────────────────────────────────

function MfdsSearchTab({
  onAddItem,
  existingProductIds,
}: {
  onAddItem: (item: OrderCreateItem) => void;
  existingProductIds: number[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Array<{ id: number; source_type: string; item_name: string; manufacturer: string | null; standard_code: string | null }>
  >([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const q = `%${query}%`;
        const { data } = await supabase
          .from("mfds_items")
          .select("id, source_type, item_name, manufacturer, standard_code")
          .or(`item_name.ilike.${q},manufacturer.ilike.${q},standard_code.ilike.${q}`)
          .limit(30);
        setResults(data ?? []);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleAdd(item: (typeof results)[number]) {
    try {
      const productId = await resolveProductIdAction({
        type: "mfds",
        sourceId: item.id,
        name: item.item_name,
        manufacturer: item.manufacturer ?? undefined,
        standardCode: item.standard_code ?? undefined,
      });

      if (existingProductIds.includes(productId)) {
        toast.error("이미 추가된 품목입니다");
        return;
      }

      const suppliers = await getProductSuppliersAction(productId);
      const primary = suppliers.find((s) => s.is_primary) ?? suppliers[0];

      onAddItem({
        key: nextKey(),
        product_id: productId,
        product_name: item.item_name,
        supplier_id: primary?.supplier_id ?? null,
        supplier_name: primary?.supplier_name ?? null,
        quantity: 1,
        unit_type: "piece",
        purchase_price: primary?.purchase_price ?? null,
        unit_price: null,
        kpis_reference_number: "",
        suppliers,
        source_type: item.source_type === "drug" ? "drug" : "device",
        raw: {},
      });
      setQuery("");
      setResults([]);
    } catch (err) {
      toast.error("품목 추가 실패: " + (err as Error).message);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="식약처 품목명, 코드, 제조사 검색 (2자 이상)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
        {searching && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {results.length > 0 && (
        <div className="border rounded-md max-h-[300px] overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent text-left"
              onClick={() => handleAdd(r)}
            >
              <Badge
                variant={r.source_type === "drug" ? "default" : "secondary"}
                className="text-xs shrink-0"
              >
                {r.source_type === "drug" ? "의약품" : "의료기기"}
              </Badge>
              <span className="truncate font-medium flex-1">{r.item_name}</span>
              {r.manufacturer && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {r.manufacturer}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd D:/Project/09_NotiFlow/apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/order-create-item-selector.tsx
git commit -m "feat: add OrderCreateItemSelector with 4-tab item picking"
```

---

## Chunk 5: Item Table Component

### Task 10: Create the item table component

**Files:**
- Create: `apps/web/src/components/order-create-item-table.tsx`

This component renders the editable table of selected items with supplier dropdown (showing purchase prices), unit type dropdown (with custom input), margin calculation, configurable columns, and KPIS reference number.

- [ ] **Step 1: Write the item table component**

```typescript
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UNIT_OPTIONS, CUSTOM_UNIT_VALUE, getUnitLabel } from "@/lib/unit-types";
import type { OrderCreateItem } from "@/components/order-create-form";
import type { OrderDisplayColumns } from "@/lib/queries/settings";

// Column label lookup maps (reused from order-inline-form.tsx)
const DRUG_LABELS: Record<string, string> = {
  ITEM_SEQ: "품목기준코드", ITEM_NAME: "품목명", ENTP_NAME: "업체명",
  BAR_CODE: "표준코드", MATERIAL_NAME: "성분", EDI_CODE: "보험코드",
  STORAGE_METHOD: "저장방법", PACK_UNIT: "포장단위", ATC_CODE: "ATC코드",
};

const DEVICE_LABELS: Record<string, string> = {
  PRDLST_NM: "품목명", UDIDI_CD: "UDI-DI코드", MNFT_IPRT_ENTP_NM: "제조수입업체명",
  MDEQ_CLSF_NO: "분류번호", CLSF_NO_GRAD_CD: "등급", FOML_INFO: "모델명",
};

interface ItemTableProps {
  items: OrderCreateItem[];
  displayColumns: OrderDisplayColumns;
  onUpdateItem: (key: string, updates: Partial<OrderCreateItem>) => void;
  onRemoveItem: (key: string) => void;
}

export function OrderCreateItemTable({
  items,
  displayColumns,
  onUpdateItem,
  onRemoveItem,
}: ItemTableProps) {
  const [customUnitKeys, setCustomUnitKeys] = useState<Set<string>>(new Set());

  // Collect display headers from items
  const displayHeaders: Array<{ key: string; label: string }> = [];
  const seenCols = new Set<string>();
  for (const item of items) {
    if (Object.keys(item.raw).length === 0) continue;
    const cols =
      item.source_type === "drug" ? displayColumns.drug : displayColumns.device;
    const labels = item.source_type === "drug" ? DRUG_LABELS : DEVICE_LABELS;
    for (const col of cols) {
      if (!seenCols.has(col)) {
        seenCols.add(col);
        displayHeaders.push({ key: col, label: labels[col] ?? col });
      }
    }
  }

  function getColumnValue(raw: Record<string, unknown>, key: string): string {
    const val = raw[key.toLowerCase()];
    if (val === null || val === undefined) return "";
    return String(val);
  }

  function handleUnitChange(key: string, value: string) {
    if (value === CUSTOM_UNIT_VALUE) {
      setCustomUnitKeys((prev) => new Set([...prev, key]));
      onUpdateItem(key, { unit_type: "" });
    } else {
      setCustomUnitKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      onUpdateItem(key, { unit_type: value });
    }
  }

  function handleSupplierChange(item: OrderCreateItem, supplierId: string) {
    const sid = Number(supplierId);
    const supplier = item.suppliers.find((s) => s.supplier_id === sid);
    onUpdateItem(item.key, {
      supplier_id: sid,
      supplier_name: supplier?.supplier_name ?? null,
      purchase_price: supplier?.purchase_price ?? null,
    });
  }

  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs min-w-[150px]">품목명</TableHead>
            <TableHead className="text-xs min-w-[160px]">공급사</TableHead>
            <TableHead className="text-xs w-[80px]">수량</TableHead>
            <TableHead className="text-xs w-[100px]">단위</TableHead>
            <TableHead className="text-xs w-[100px] text-right">매입가</TableHead>
            <TableHead className="text-xs w-[100px] text-right">판매가</TableHead>
            <TableHead className="text-xs w-[80px] text-right">마진</TableHead>
            <TableHead className="text-xs w-[100px] text-right">총합</TableHead>
            {displayHeaders.map((h) => (
              <TableHead key={h.key} className="text-xs">
                {h.label}
              </TableHead>
            ))}
            <TableHead className="text-xs w-[100px]">KPIS</TableHead>
            <TableHead className="w-[40px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const margin = (item.unit_price ?? 0) - (item.purchase_price ?? 0);
            const lineTotal = (item.unit_price ?? 0) * item.quantity;
            const isCustomUnit = customUnitKeys.has(item.key);

            return (
              <TableRow key={item.key}>
                {/* Product name */}
                <TableCell className="text-sm font-medium">
                  <span className="truncate block max-w-[200px]">
                    {item.product_name}
                  </span>
                </TableCell>

                {/* Supplier dropdown with price */}
                <TableCell>
                  {item.suppliers.length > 0 ? (
                    <Select
                      value={item.supplier_id?.toString() ?? ""}
                      onValueChange={(v) => handleSupplierChange(item, v)}
                    >
                      <SelectTrigger className="h-8 text-xs w-full">
                        <SelectValue placeholder="공급사 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {item.suppliers.map((s) => (
                          <SelectItem
                            key={s.supplier_id}
                            value={s.supplier_id.toString()}
                          >
                            {s.supplier_name}
                            {s.purchase_price != null &&
                              ` — ${s.purchase_price.toLocaleString()}원`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>

                {/* Quantity */}
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdateItem(item.key, {
                        quantity: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="h-8 w-[70px] text-xs text-right"
                  />
                </TableCell>

                {/* Unit type */}
                <TableCell>
                  {isCustomUnit ? (
                    <Input
                      value={item.unit_type}
                      onChange={(e) =>
                        onUpdateItem(item.key, {
                          unit_type: e.target.value.slice(0, 20),
                        })
                      }
                      placeholder="단위 입력"
                      className="h-8 w-[90px] text-xs"
                      autoFocus
                    />
                  ) : (
                    <Select
                      value={item.unit_type || "piece"}
                      onValueChange={(v) => handleUnitChange(item.key, v)}
                    >
                      <SelectTrigger className="h-8 text-xs w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_OPTIONS.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_UNIT_VALUE}>
                          직접입력
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>

                {/* Purchase price */}
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    value={item.purchase_price ?? ""}
                    onChange={(e) =>
                      onUpdateItem(item.key, {
                        purchase_price: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    placeholder="0"
                    className="h-8 w-[90px] text-xs text-right"
                  />
                </TableCell>

                {/* Selling price */}
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    value={item.unit_price ?? ""}
                    onChange={(e) =>
                      onUpdateItem(item.key, {
                        unit_price: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    placeholder="0"
                    className="h-8 w-[90px] text-xs text-right"
                  />
                </TableCell>

                {/* Margin (read-only) */}
                <TableCell className="text-right text-xs tabular-nums">
                  <span
                    className={
                      margin >= 0 ? "text-green-600" : "text-red-600"
                    }
                  >
                    {margin.toLocaleString()}
                  </span>
                </TableCell>

                {/* Line total (read-only) */}
                <TableCell className="text-right text-xs tabular-nums font-medium">
                  {lineTotal.toLocaleString()}
                </TableCell>

                {/* Configurable columns */}
                {displayHeaders.map((h) => (
                  <TableCell
                    key={h.key}
                    className="text-xs max-w-[150px] truncate"
                  >
                    {getColumnValue(item.raw, h.key)}
                  </TableCell>
                ))}

                {/* KPIS reference number */}
                <TableCell>
                  <Input
                    value={item.kpis_reference_number}
                    onChange={(e) =>
                      onUpdateItem(item.key, {
                        kpis_reference_number: e.target.value.slice(0, 100),
                      })
                    }
                    placeholder="신고번호"
                    className="h-8 w-[90px] text-xs"
                  />
                </TableCell>

                {/* Delete */}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onRemoveItem(item.key)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd D:/Project/09_NotiFlow/apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Verify the dev server runs**

Run: `cd D:/Project/09_NotiFlow/apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds. If there are import errors, check paths.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/order-create-item-table.tsx
git commit -m "feat: add OrderCreateItemTable with supplier dropdown, unit selector, margin calc, KPIS input"
```

---

## Chunk 6: Integration & Polish

### Task 11: Final integration verification

- [ ] **Step 1: Run full TypeScript check**

Run: `cd D:/Project/09_NotiFlow/apps/web && npx tsc --noEmit --pretty 2>&1 | tail -30`
Expected: No new errors introduced by this feature.

- [ ] **Step 2: Test the dev server**

Run: `cd D:/Project/09_NotiFlow/apps/web && npx next dev --port 3001 &`
Then verify manually:
- Navigate to `http://localhost:3001/orders/new`
- Verify the page loads with 4 sections
- Verify hospital search works
- Verify item tabs render
- Verify unit dropdown shows 7 options + "직접입력"
- Verify margin calculates correctly
- Verify KPIS input field works
- Verify submit creates an order

- [ ] **Step 3: Verify backward compatibility**

- Navigate to `/orders` — verify the existing inline form still works
- Navigate to `/orders/new` — verify the new form works
- Both should create orders independently

- [ ] **Step 4: Final commit with all remaining changes**

```bash
git add -A
git status
git commit -m "feat: complete order creation page with hospital products, supplier pricing, margin calculation"
```

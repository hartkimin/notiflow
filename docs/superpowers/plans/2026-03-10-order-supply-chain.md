# Order Supply Chain Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect suppliers and hospitals to favorite MFDS items with pricing, enhance order creation from messages with automatic price calculation (supply price → margin → delivery price → discount → final price).

**Architecture:** Replace `products` table with `mfds_items` as single product source. Two junction tables (`supplier_items`, `hospital_items`) link products to suppliers/hospitals with pricing. Enhanced order form calculates prices automatically from these relationships.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL + PostgREST), shadcn/ui, TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-10-order-supply-chain-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `packages/supabase/supabase/migrations/00039_order_supply_chain.sql` | Single migration: drop legacy tables, create junction tables, alter existing tables |
| `apps/web/src/lib/queries/supplier-items.ts` | Query functions for supplier_items table |
| `apps/web/src/lib/queries/hospital-items.ts` | Query functions for hospital_items table |
| `apps/web/src/components/item-picker-modal.tsx` | Reusable modal for picking favorite mfds_items |
| `apps/web/src/components/supplier-detail.tsx` | Client component for supplier detail + items management |
| `apps/web/src/components/hospital-detail.tsx` | Client component for hospital detail + items management |
| `apps/web/src/app/(dashboard)/suppliers/[id]/page.tsx` | Server page wrapper for supplier detail |
| `apps/web/src/app/(dashboard)/hospitals/[id]/page.tsx` | Server page wrapper for hospital detail |

### Modified Files
| File | Changes |
|------|---------|
| `apps/web/src/lib/types.ts` | Add SupplierItem, HospitalItem, HospitalItemWithPricing; update OrderItem, ForecastItem; remove Product, ProductSupplier |
| `apps/web/src/lib/actions.ts` | Add supplier/hospital items CRUD actions, deleteMessages bulk action |
| `apps/web/src/app/(dashboard)/orders/actions.ts` | Extend createOrderAction with discount_rate, final_price, display_columns |
| `apps/web/src/lib/queries/orders.ts` | Change product_id → mfds_item_id in JOINs |
| `apps/web/src/lib/queries/products.ts` | Replace getProductsCatalog() to query mfds_items directly |
| `apps/web/src/lib/queries/forecasts.ts` | Change product_id → mfds_item_id in JOINs |
| `apps/web/src/components/supplier-list.tsx` | Add row click → navigate to /suppliers/[id] |
| `apps/web/src/components/hospital-list.tsx` | Add row click → navigate to /hospitals/[id] |
| `apps/web/src/components/order-inline-form.tsx` | Add favorite item picker, discount rates, price auto-calculation, MFDS column display |
| `apps/web/src/components/order-table.tsx` | Update product_id → mfds_item_id references, show discount/final_price columns |
| `apps/web/src/components/order-detail-client.tsx` | Same as order-table |
| `apps/web/src/components/messages-view.tsx` | Add checkbox selection, bulk delete/order buttons |
| `apps/web/src/components/message-inbox/detail-panel.tsx` | Add delete button |

---

## Chunk 1: Database Migration + Types

### Task 1: Write the migration SQL

**Files:**
- Create: `packages/supabase/supabase/migrations/00039_order_supply_chain.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 00039_order_supply_chain.sql
-- Unify product management around mfds_items, create supplier/hospital item linkages,
-- add pricing columns for the supply chain flow.

BEGIN;

----------------------------------------------------------------------
-- 0. Ensure mfds_items.raw_data exists (may be missing depending on migration order)
----------------------------------------------------------------------
ALTER TABLE mfds_items ADD COLUMN IF NOT EXISTS raw_data JSONB;

----------------------------------------------------------------------
-- 1. Drop legacy objects that depend on 'products' table
----------------------------------------------------------------------

-- 1a. Drop the products_catalog VIEW
DROP VIEW IF EXISTS products_catalog;

-- 1b. Drop order_items.box_spec_id column (FK → product_box_specs)
ALTER TABLE order_items DROP COLUMN IF EXISTS box_spec_id;

-- 1c. Drop child tables of products
DROP TABLE IF EXISTS product_box_specs CASCADE;
DROP TABLE IF EXISTS product_aliases CASCADE;
DROP TABLE IF EXISTS product_suppliers CASCADE;

-- 1d. Migrate forecast_items: drop product_id, add mfds_item_id
ALTER TABLE forecast_items DROP COLUMN IF EXISTS product_id;
ALTER TABLE forecast_items ADD COLUMN IF NOT EXISTS mfds_item_id BIGINT REFERENCES mfds_items(id);

-- 1e. Drop legacy columns from order_items
ALTER TABLE order_items DROP COLUMN IF EXISTS unit_type;
ALTER TABLE order_items DROP COLUMN IF EXISTS calculated_pieces;
ALTER TABLE order_items DROP COLUMN IF EXISTS original_text;
ALTER TABLE order_items DROP COLUMN IF EXISTS match_status;
ALTER TABLE order_items DROP COLUMN IF EXISTS match_confidence;

-- 1f. Rename order_items.product_id → mfds_item_id
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE order_items RENAME COLUMN product_id TO mfds_item_id;
  END IF;
END $$;
ALTER TABLE order_items ALTER COLUMN mfds_item_id TYPE BIGINT USING mfds_item_id::BIGINT;
ALTER TABLE order_items ADD CONSTRAINT order_items_mfds_item_id_fkey
  FOREIGN KEY (mfds_item_id) REFERENCES mfds_items(id);

-- 1g. Drop products table (CASCADE cleans any remaining implicit FKs)
DROP TABLE IF EXISTS products CASCADE;

----------------------------------------------------------------------
-- 2. Add pricing columns to existing tables
----------------------------------------------------------------------

-- 2a. Hospital default margin rate
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS default_margin_rate DECIMAL(5,2) NOT NULL DEFAULT 0;

-- 2b. Order-level discount rate
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0;

-- 2c. Order item pricing columns
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS display_columns JSONB;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS final_price DECIMAL(12,2);

----------------------------------------------------------------------
-- 3. Create new junction tables
----------------------------------------------------------------------

-- 3a. supplier_items — maps suppliers to mfds_items with purchase price
CREATE TABLE IF NOT EXISTS supplier_items (
  id            SERIAL PRIMARY KEY,
  supplier_id   INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  mfds_item_id  BIGINT NOT NULL REFERENCES mfds_items(id) ON DELETE CASCADE,
  purchase_price DECIMAL(12,2),
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, mfds_item_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_items_supplier ON supplier_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_items_mfds_item ON supplier_items(mfds_item_id);

-- 3b. hospital_items — maps hospitals to mfds_items with optional delivery price override
CREATE TABLE IF NOT EXISTS hospital_items (
  id             SERIAL PRIMARY KEY,
  hospital_id    INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  mfds_item_id   BIGINT NOT NULL REFERENCES mfds_items(id) ON DELETE CASCADE,
  delivery_price DECIMAL(12,2),  -- NULL means auto-calc from margin
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, mfds_item_id)
);

CREATE INDEX IF NOT EXISTS idx_hospital_items_hospital ON hospital_items(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_items_mfds_item ON hospital_items(mfds_item_id);

COMMIT;
```

- [ ] **Step 2: Apply the migration to the local Supabase database**

Run: `docker exec -i supabase-db psql -U postgres -d postgres < packages/supabase/supabase/migrations/00039_order_supply_chain.sql`

Expected: `BEGIN`, then multiple `ALTER TABLE` / `DROP` / `CREATE TABLE` lines, ending with `COMMIT`.

If the container name differs, find it with: `docker ps --filter "ancestor=supabase/postgres" --format "{{.Names}}"`

- [ ] **Step 3: Verify the migration**

Run:
```bash
docker exec supabase-db psql -U postgres -d postgres -c "\dt supplier_items; \dt hospital_items; \d order_items;"
```

Expected: Both new tables exist. `order_items` has `mfds_item_id` (bigint), `discount_rate`, `display_columns`, `final_price` columns. No `product_id`, `box_spec_id`, `unit_type`, etc.

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/supabase/migrations/00039_order_supply_chain.sql
git commit -m "feat(db): migration 00039 — drop products table, create supplier/hospital items"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `apps/web/src/lib/types.ts`

- [ ] **Step 1: Read the current types file**

Read `apps/web/src/lib/types.ts` to see exact current content.

- [ ] **Step 2: Remove Product and ProductSupplier types, add new types, update OrderItem**

Add new interfaces after existing `Supplier` interface:

```typescript
export interface SupplierItem {
  id: number;
  supplier_id: number;
  mfds_item_id: number;
  purchase_price: number | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  // joined fields
  item_name?: string;
  manufacturer?: string;
  source_type?: string;
  standard_code?: string;
}

export interface HospitalItem {
  id: number;
  hospital_id: number;
  mfds_item_id: number;
  delivery_price: number | null;
  notes: string | null;
  created_at: string;
  // joined fields
  item_name?: string;
  manufacturer?: string;
  source_type?: string;
  standard_code?: string;
  // computed from supplier_items join
  primary_purchase_price?: number | null;
}

export interface HospitalItemWithPricing extends HospitalItem {
  default_margin_rate: number;
  computed_delivery_price: number | null; // delivery_price ?? purchase_price * (1 + margin/100)
}
```

Update `OrderItem` interface — replace `product_id` with `mfds_item_id`, add new fields:

```typescript
export interface OrderItem {
  id: number;
  order_id: number;
  mfds_item_id: number | null;
  supplier_id: number | null;
  quantity: number;
  unit_price: number | null;     // delivery price snapshot
  purchase_price: number | null; // supply price snapshot
  discount_rate: number;         // item-level discount %
  final_price: number | null;    // computed final unit price
  display_columns: Record<string, string> | null; // MFDS column snapshot
  line_total: number | null;
  created_at?: string;
}
```

Update `OrderItemFlat` — replace `product_id`/`product_name` with `mfds_item_id`/`item_name`:

```typescript
export interface OrderItemFlat {
  id: number;
  order_id: number;
  order_number: string;
  order_date: string;
  delivery_date: string | null;
  hospital_id: number;
  hospital_name: string;
  mfds_item_id: number | null;
  item_name: string | null;
  quantity: number;
  unit_price: number | null;
  purchase_price: number | null;
  discount_rate: number;
  final_price: number | null;
  display_columns: Record<string, string> | null;
  line_total: number | null;
  supplier_id: number | null;
  supplier_name: string | null;
  kpis_status: string | null;
  kpis_notes: string | null;
  status: string;
}
```

Update `Order` interface — add `discount_rate`:

```typescript
// Add to Order interface:
discount_rate: number;
```

Update `ForecastItem` — replace `product_id` with `mfds_item_id`:

```typescript
export interface ForecastItem {
  id: number;
  forecast_id: number;
  mfds_item_id: number | null;
  item_name?: string;
  quantity: number;
  unit_type: string;
  notes: string | null;
}
```

Remove `Product` and `ProductSupplier` interfaces entirely.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`

Expected: Type errors in files that still reference `product_id` or `Product` — these will be fixed in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat(types): update types for mfds_items-based product system"
```

---

## Chunk 2: Supplier Items — Queries, Actions, UI

### Task 3: Create supplier items query functions

**Files:**
- Create: `apps/web/src/lib/queries/supplier-items.ts`

- [ ] **Step 1: Write the query file**

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupplierItem } from "@/lib/types";

export async function getSupplierItems(supplierId: number): Promise<SupplierItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("supplier_items")
    .select(`
      id, supplier_id, mfds_item_id, purchase_price, is_primary, notes, created_at,
      mfds_items!inner(item_name, manufacturer, source_type, standard_code)
    `)
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const item = row.mfds_items as Record<string, unknown> | null;
    return {
      id: row.id as number,
      supplier_id: row.supplier_id as number,
      mfds_item_id: row.mfds_item_id as number,
      purchase_price: row.purchase_price as number | null,
      is_primary: row.is_primary as boolean,
      notes: row.notes as string | null,
      created_at: row.created_at as string,
      item_name: (item?.item_name as string) ?? "",
      manufacturer: (item?.manufacturer as string) ?? "",
      source_type: (item?.source_type as string) ?? "",
      standard_code: (item?.standard_code as string) ?? null,
    };
  });
}

export async function getSupplierItemIds(supplierId: number): Promise<number[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("supplier_items")
    .select("mfds_item_id")
    .eq("supplier_id", supplierId);
  return (data ?? []).map((d) => d.mfds_item_id as number);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/queries/supplier-items.ts
git commit -m "feat(queries): add supplier-items query functions"
```

---

### Task 4: Add supplier items server actions

**Files:**
- Modify: `apps/web/src/lib/actions.ts`

- [ ] **Step 1: Read current actions.ts**

Read `apps/web/src/lib/actions.ts` to find the exact location to add new actions (after existing supplier actions).

- [ ] **Step 2: Add supplier items CRUD actions**

Add after the existing `deleteSuppliers` function:

```typescript
export async function addSupplierItems(supplierId: number, mfdsItemIds: number[]) {
  const admin = createAdminClient();
  const rows = mfdsItemIds.map((mfdsItemId) => ({
    supplier_id: supplierId,
    mfds_item_id: mfdsItemId,
  }));
  const { error } = await admin
    .from("supplier_items")
    .upsert(rows, { onConflict: "supplier_id,mfds_item_id" });
  if (error) throw error;
  revalidatePath(`/suppliers/${supplierId}`);
  return { success: true };
}

export async function updateSupplierItem(
  id: number,
  data: { purchase_price?: number | null; is_primary?: boolean },
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("supplier_items")
    .update(data)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}

export async function removeSupplierItem(id: number) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("supplier_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/suppliers");
  return { success: true };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "feat(actions): add supplier items CRUD actions"
```

---

### Task 5: Create ItemPickerModal component

**Files:**
- Create: `apps/web/src/components/item-picker-modal.tsx`

- [ ] **Step 1: Write the component**

```typescript
"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";

interface FavoriteItem {
  id: number;
  source_type: string;
  item_name: string;
  manufacturer: string | null;
  standard_code: string | null;
}

interface ItemPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (ids: number[]) => void;
  excludeIds: number[];
  searchAction: (query: string) => Promise<FavoriteItem[]>;
}

export function ItemPickerModal({
  open,
  onOpenChange,
  onSelect,
  excludeIds,
  searchAction,
}: ItemPickerModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FavoriteItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "drug" | "device">("all");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(new Set());
      setFilter("all");
      return;
    }
    // Load all favorites on open
    startTransition(async () => {
      const items = await searchAction("");
      setResults(items);
    });
  }, [open, searchAction]);

  function handleSearch() {
    startTransition(async () => {
      const items = await searchAction(query);
      setResults(items);
    });
  }

  function toggleItem(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    onSelect(Array.from(selected));
    onOpenChange(false);
  }

  const filtered = results.filter((r) => {
    if (filter === "all") return true;
    if (filter === "drug") return r.source_type === "drug";
    return r.source_type === "device" || r.source_type === "device_std";
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>즐겨찾기 품목 선택</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="품목명, 제조사, 표준코드 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSearch} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "검색"}
          </Button>
        </div>

        <div className="flex gap-1">
          {(["all", "drug", "device"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "전체" : f === "drug" ? "의약품" : "의료기기"}
            </Button>
          ))}
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="w-10 p-2" />
                <th className="text-left p-2">품목명</th>
                <th className="text-left p-2">제조사</th>
                <th className="text-left p-2">표준코드</th>
                <th className="text-left p-2 w-20">유형</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const excluded = excludeIds.includes(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`border-t ${excluded ? "opacity-40" : "hover:bg-muted/30 cursor-pointer"}`}
                    onClick={() => !excluded && toggleItem(item.id)}
                  >
                    <td className="p-2 text-center">
                      <Checkbox
                        checked={selected.has(item.id)}
                        disabled={excluded}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                    </td>
                    <td className="p-2">{item.item_name}</td>
                    <td className="p-2 text-muted-foreground">{item.manufacturer ?? "-"}</td>
                    <td className="p-2 text-muted-foreground font-mono text-xs">
                      {item.standard_code ?? "-"}
                    </td>
                    <td className="p-2">
                      <Badge variant={item.source_type === "drug" ? "default" : "secondary"}>
                        {item.source_type === "drug" ? "의약품" : "의료기기"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {isPending ? "검색 중..." : "결과가 없습니다"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            {selected.size}개 추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add searchFavoriteItems action to actions.ts**

Add to `apps/web/src/lib/actions.ts`:

```typescript
export async function searchFavoriteItems(query: string) {
  const admin = createAdminClient();
  let q = admin
    .from("mfds_items")
    .select("id, source_type, item_name, manufacturer, standard_code")
    .eq("is_favorite", true)
    .order("item_name")
    .limit(100);

  if (query.trim()) {
    const like = `%${query}%`;
    q = q.or(`item_name.ilike.${like},manufacturer.ilike.${like},standard_code.ilike.${like}`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Array<{
    id: number;
    source_type: string;
    item_name: string;
    manufacturer: string | null;
    standard_code: string | null;
  }>;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/item-picker-modal.tsx apps/web/src/lib/actions.ts
git commit -m "feat: add ItemPickerModal component and searchFavoriteItems action"
```

---

### Task 6: Create supplier detail page and component

**Files:**
- Create: `apps/web/src/app/(dashboard)/suppliers/[id]/page.tsx`
- Create: `apps/web/src/components/supplier-detail.tsx`

- [ ] **Step 1: Write the server page**

```typescript
import { notFound } from "next/navigation";
import { getSupplier } from "@/lib/queries/suppliers";
import { getSupplierItems } from "@/lib/queries/supplier-items";
import { SupplierDetail } from "@/components/supplier-detail";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplierId = Number(id);
  if (isNaN(supplierId)) notFound();

  const [supplier, items] = await Promise.all([
    getSupplier(supplierId),
    getSupplierItems(supplierId),
  ]);

  if (!supplier) notFound();

  return <SupplierDetail supplier={supplier} initialItems={items} />;
}
```

- [ ] **Step 2: Write the client component**

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Supplier, SupplierItem } from "@/lib/types";
import {
  updateSupplier,
  addSupplierItems,
  updateSupplierItem,
  removeSupplierItem,
  searchFavoriteItems,
} from "@/lib/actions";
import { ItemPickerModal } from "./item-picker-modal";

interface SupplierDetailProps {
  supplier: Supplier;
  initialItems: SupplierItem[];
}

export function SupplierDetail({ supplier, initialItems }: SupplierDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Editable supplier fields
  const [name, setName] = useState(supplier.name);
  const [shortName, setShortName] = useState(supplier.short_name ?? "");
  const [phone, setPhone] = useState(supplier.phone ?? "");
  const [businessNumber, setBusinessNumber] = useState(supplier.business_number ?? "");
  const [notes, setNotes] = useState(supplier.notes ?? "");

  function handleSaveInfo() {
    startTransition(async () => {
      try {
        await updateSupplier(supplier.id, {
          name,
          short_name: shortName || null,
          phone: phone || null,
          business_number: businessNumber || null,
          notes: notes || null,
        });
        toast.success("공급사 정보가 저장되었습니다.");
      } catch {
        toast.error("저장에 실패했습니다.");
      }
    });
  }

  function handleAddItems(mfdsItemIds: number[]) {
    startTransition(async () => {
      try {
        await addSupplierItems(supplier.id, mfdsItemIds);
        router.refresh();
        toast.success(`${mfdsItemIds.length}개 품목이 추가되었습니다.`);
      } catch {
        toast.error("품목 추가에 실패했습니다.");
      }
    });
  }

  function handleUpdatePrice(itemId: number, price: string) {
    const val = price === "" ? null : Number(price);
    startTransition(async () => {
      try {
        await updateSupplierItem(itemId, { purchase_price: val });
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, purchase_price: val } : i)),
        );
      } catch {
        toast.error("가격 수정에 실패했습니다.");
      }
    });
  }

  function handleTogglePrimary(itemId: number, current: boolean) {
    startTransition(async () => {
      try {
        await updateSupplierItem(itemId, { is_primary: !current });
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, is_primary: !current } : i)),
        );
      } catch {
        toast.error("수정에 실패했습니다.");
      }
    });
  }

  function handleRemoveItem(itemId: number) {
    startTransition(async () => {
      try {
        await removeSupplierItem(itemId);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        toast.success("품목이 제거되었습니다.");
      } catch {
        toast.error("제거에 실패했습니다.");
      }
    });
  }

  const excludeIds = items.map((i) => i.mfds_item_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/suppliers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{supplier.name}</h1>
        {!supplier.is_active && <Badge variant="secondary">비활성</Badge>}
      </div>

      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>공급사명</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>약칭</Label>
            <Input value={shortName} onChange={(e) => setShortName(e.target.value)} />
          </div>
          <div>
            <Label>전화번호</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>사업자번호</Label>
            <Input value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>비고</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="col-span-2 flex justify-end">
            <Button onClick={handleSaveInfo} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Items Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>취급 품목</CardTitle>
            <CardDescription>{items.length}개 품목</CardDescription>
          </div>
          <Button onClick={() => setPickerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            품목 추가
          </Button>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              즐겨찾기 품목에서 이 공급사의 취급 품목을 추가하세요
            </p>
          ) : (
            <div className="border rounded-md overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">품목명</th>
                    <th className="text-left p-2">제조사</th>
                    <th className="text-left p-2 w-20">유형</th>
                    <th className="text-right p-2 w-32">공급가</th>
                    <th className="text-center p-2 w-24">주공급사</th>
                    <th className="text-center p-2 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-2">{item.item_name}</td>
                      <td className="p-2 text-muted-foreground">{item.manufacturer ?? "-"}</td>
                      <td className="p-2">
                        <Badge variant={item.source_type === "drug" ? "default" : "secondary"}>
                          {item.source_type === "drug" ? "의약품" : "의료기기"}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">
                        <Input
                          type="number"
                          className="w-28 text-right h-8"
                          defaultValue={item.purchase_price ?? ""}
                          placeholder="0"
                          onBlur={(e) => handleUpdatePrice(item.id, e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <Switch
                          checked={item.is_primary}
                          onCheckedChange={() => handleTogglePrimary(item.id, item.is_primary)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>품목 제거</AlertDialogTitle>
                              <AlertDialogDescription>
                                &quot;{item.item_name}&quot;을(를) 취급 품목에서 제거하시겠습니까?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemoveItem(item.id)}>
                                제거
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ItemPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleAddItems}
        excludeIds={excludeIds}
        searchAction={searchFavoriteItems}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify the page loads**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -E "(supplier-detail|supplier.*\[id\])" | head -10`

Fix any import errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/suppliers/\[id\]/page.tsx apps/web/src/components/supplier-detail.tsx
git commit -m "feat: add supplier detail page with items management"
```

---

### Task 7: Add navigation from supplier list to detail page

**Files:**
- Modify: `apps/web/src/components/supplier-list.tsx`

- [ ] **Step 1: Read supplier-list.tsx**

Read full file to find the row rendering code.

- [ ] **Step 2: Add row click handler**

Find the `<tr>` element for each supplier row. Import `useRouter` from `next/navigation`. Add an `onClick` handler:

```typescript
// Add to imports:
import { useRouter } from "next/navigation";

// Add inside SupplierTable component:
const router = useRouter();

// On each data row <tr>, add:
onClick={() => router.push(`/suppliers/${item.id}`)}
className="... cursor-pointer"
```

Make sure to not navigate when clicking the checkbox column or action buttons. Use `e.stopPropagation()` on the checkbox `<td>` onClick or add the click only to the name cell.

A simpler approach: make the supplier name cell a link:

```typescript
// In the name <td>:
import Link from "next/link";

<td className="p-2">
  <Link href={`/suppliers/${item.id}`} className="hover:underline text-primary">
    {item.name}
  </Link>
</td>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/supplier-list.tsx
git commit -m "feat: link supplier list rows to detail page"
```

---

## Chunk 3: Hospital Items — Queries, Actions, UI

### Task 8: Create hospital items query functions

**Files:**
- Create: `apps/web/src/lib/queries/hospital-items.ts`

- [ ] **Step 1: Write the query file**

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import type { HospitalItemWithPricing } from "@/lib/types";

export async function getHospitalItems(
  hospitalId: number,
): Promise<{ items: HospitalItemWithPricing[]; defaultMarginRate: number }> {
  const supabase = createAdminClient();

  // Get hospital margin rate
  const { data: hospital } = await supabase
    .from("hospitals")
    .select("default_margin_rate")
    .eq("id", hospitalId)
    .single();

  const marginRate = (hospital?.default_margin_rate as number) ?? 0;

  // Get hospital items with mfds_items join + primary supplier price
  const { data, error } = await supabase
    .from("hospital_items")
    .select(`
      id, hospital_id, mfds_item_id, delivery_price, notes, created_at,
      mfds_items!inner(item_name, manufacturer, source_type, standard_code)
    `)
    .eq("hospital_id", hospitalId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Get primary supplier prices for these items
  const mfdsItemIds = (data ?? []).map((r) => (r as Record<string, unknown>).mfds_item_id as number);
  const { data: supplierPrices } = await supabase
    .from("supplier_items")
    .select("mfds_item_id, purchase_price")
    .in("mfds_item_id", mfdsItemIds.length > 0 ? mfdsItemIds : [-1])
    .eq("is_primary", true);

  const priceMap = new Map<number, number | null>();
  for (const sp of supplierPrices ?? []) {
    priceMap.set(sp.mfds_item_id as number, sp.purchase_price as number | null);
  }

  const items: HospitalItemWithPricing[] = (data ?? []).map((row: Record<string, unknown>) => {
    const mfds = row.mfds_items as Record<string, unknown> | null;
    const mfdsItemId = row.mfds_item_id as number;
    const deliveryPrice = row.delivery_price as number | null;
    const purchasePrice = priceMap.get(mfdsItemId) ?? null;
    const computedDeliveryPrice =
      deliveryPrice ?? (purchasePrice != null ? purchasePrice * (1 + marginRate / 100) : null);

    return {
      id: row.id as number,
      hospital_id: row.hospital_id as number,
      mfds_item_id: mfdsItemId,
      delivery_price: deliveryPrice,
      notes: row.notes as string | null,
      created_at: row.created_at as string,
      item_name: (mfds?.item_name as string) ?? "",
      manufacturer: (mfds?.manufacturer as string) ?? "",
      source_type: (mfds?.source_type as string) ?? "",
      standard_code: (mfds?.standard_code as string) ?? null,
      primary_purchase_price: purchasePrice,
      default_margin_rate: marginRate,
      computed_delivery_price: computedDeliveryPrice,
    };
  });

  return { items, defaultMarginRate: marginRate };
}

export async function getHospitalItemIds(hospitalId: number): Promise<number[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("hospital_items")
    .select("mfds_item_id")
    .eq("hospital_id", hospitalId);
  return (data ?? []).map((d) => d.mfds_item_id as number);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/queries/hospital-items.ts
git commit -m "feat(queries): add hospital-items query functions with pricing computation"
```

---

### Task 9: Add hospital items server actions

**Files:**
- Modify: `apps/web/src/lib/actions.ts`

- [ ] **Step 1: Add hospital items CRUD actions**

Add after `deleteHospitals` function in `actions.ts`:

```typescript
export async function addHospitalItems(hospitalId: number, mfdsItemIds: number[]) {
  const admin = createAdminClient();
  const rows = mfdsItemIds.map((mfdsItemId) => ({
    hospital_id: hospitalId,
    mfds_item_id: mfdsItemId,
  }));
  const { error } = await admin
    .from("hospital_items")
    .upsert(rows, { onConflict: "hospital_id,mfds_item_id" });
  if (error) throw error;
  revalidatePath(`/hospitals/${hospitalId}`);
  return { success: true };
}

export async function updateHospitalItem(
  id: number,
  data: { delivery_price?: number | null },
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("hospital_items")
    .update(data)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

export async function removeHospitalItem(id: number) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("hospital_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/hospitals");
  return { success: true };
}

export async function updateHospitalMarginRate(hospitalId: number, rate: number) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("hospitals")
    .update({ default_margin_rate: rate })
    .eq("id", hospitalId);
  if (error) throw error;
  revalidatePath(`/hospitals/${hospitalId}`);
  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "feat(actions): add hospital items CRUD + margin rate actions"
```

---

### Task 10: Create hospital detail page and component

**Files:**
- Create: `apps/web/src/app/(dashboard)/hospitals/[id]/page.tsx`
- Create: `apps/web/src/components/hospital-detail.tsx`

- [ ] **Step 1: Write the server page**

```typescript
import { notFound } from "next/navigation";
import { getHospital } from "@/lib/queries/hospitals";
import { getHospitalItems } from "@/lib/queries/hospital-items";
import { HospitalDetail } from "@/components/hospital-detail";

export default async function HospitalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hospitalId = Number(id);
  if (isNaN(hospitalId)) notFound();

  const [hospital, { items, defaultMarginRate }] = await Promise.all([
    getHospital(hospitalId),
    getHospitalItems(hospitalId),
  ]);

  if (!hospital) notFound();

  return (
    <HospitalDetail
      hospital={hospital}
      initialItems={items}
      initialMarginRate={defaultMarginRate}
    />
  );
}
```

- [ ] **Step 2: Write the client component**

The component follows the same pattern as `SupplierDetail` but with delivery price and margin rate logic. Key differences:

- Shows `default_margin_rate` field in the info card
- Items table shows: 품목명 | 제조사 | 유형 | 공급가(읽기전용) | 마진율 | 납품가(편집) | 삭제
- Delivery price column: if `delivery_price` is set, show bold; if null, show computed value in gray with "자동" badge
- Purchase price column: show `primary_purchase_price` from supplier_items (read-only, gray)
- If no primary supplier price, show "공급가 미등록" warning

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Hospital, HospitalItemWithPricing } from "@/lib/types";
import {
  updateHospital,
  addHospitalItems,
  updateHospitalItem,
  removeHospitalItem,
  updateHospitalMarginRate,
  searchFavoriteItems,
} from "@/lib/actions";
import { ItemPickerModal } from "./item-picker-modal";

const TYPE_LABEL: Record<string, string> = {
  hospital: "병원",
  clinic: "의원",
  pharmacy: "약국",
  distributor: "유통사",
  research: "연구소",
  other: "기타",
};

interface HospitalDetailProps {
  hospital: Hospital;
  initialItems: HospitalItemWithPricing[];
  initialMarginRate: number;
}

export function HospitalDetail({
  hospital,
  initialItems,
  initialMarginRate,
}: HospitalDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [marginRate, setMarginRate] = useState(initialMarginRate);

  // Editable fields
  const [name, setName] = useState(hospital.name);
  const [shortName, setShortName] = useState(hospital.short_name ?? "");
  const [phone, setPhone] = useState(hospital.phone ?? "");
  const [address, setAddress] = useState(hospital.address ?? "");
  const [contactPerson, setContactPerson] = useState(hospital.contact_person ?? "");
  const [businessNumber, setBusinessNumber] = useState(hospital.business_number ?? "");
  const [paymentTerms, setPaymentTerms] = useState(hospital.payment_terms ?? "");

  function handleSaveInfo() {
    startTransition(async () => {
      try {
        await updateHospital(hospital.id, {
          name,
          short_name: shortName || null,
          phone: phone || null,
          address: address || null,
          contact_person: contactPerson || null,
          business_number: businessNumber || null,
          payment_terms: paymentTerms || null,
        });
        await updateHospitalMarginRate(hospital.id, marginRate);
        toast.success("거래처 정보가 저장되었습니다.");
      } catch {
        toast.error("저장에 실패했습니다.");
      }
    });
  }

  function handleAddItems(mfdsItemIds: number[]) {
    startTransition(async () => {
      try {
        await addHospitalItems(hospital.id, mfdsItemIds);
        router.refresh();
        toast.success(`${mfdsItemIds.length}개 품목이 추가되었습니다.`);
      } catch {
        toast.error("품목 추가에 실패했습니다.");
      }
    });
  }

  function handleUpdateDeliveryPrice(itemId: number, price: string) {
    const val = price === "" ? null : Number(price);
    startTransition(async () => {
      try {
        await updateHospitalItem(itemId, { delivery_price: val });
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== itemId) return i;
            const newDeliveryPrice = val;
            const computedDeliveryPrice =
              newDeliveryPrice ??
              (i.primary_purchase_price != null
                ? i.primary_purchase_price * (1 + marginRate / 100)
                : null);
            return { ...i, delivery_price: newDeliveryPrice, computed_delivery_price: computedDeliveryPrice };
          }),
        );
      } catch {
        toast.error("가격 수정에 실패했습니다.");
      }
    });
  }

  function handleRemoveItem(itemId: number) {
    startTransition(async () => {
      try {
        await removeHospitalItem(itemId);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        toast.success("품목이 제거되었습니다.");
      } catch {
        toast.error("제거에 실패했습니다.");
      }
    });
  }

  const excludeIds = items.map((i) => i.mfds_item_id);

  function formatPrice(n: number | null | undefined): string {
    if (n == null) return "-";
    return n.toLocaleString("ko-KR");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/hospitals")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{hospital.name}</h1>
        <Badge variant="outline">{TYPE_LABEL[hospital.hospital_type] ?? hospital.hospital_type}</Badge>
        {!hospital.is_active && <Badge variant="secondary">비활성</Badge>}
      </div>

      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>거래처명</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>약칭</Label>
            <Input value={shortName} onChange={(e) => setShortName(e.target.value)} />
          </div>
          <div>
            <Label>전화번호</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>사업자번호</Label>
            <Input value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} />
          </div>
          <div>
            <Label>주소</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <Label>담당자</Label>
            <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>
          <div>
            <Label>결제 조건</Label>
            <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
          </div>
          <div>
            <Label>기본 마진율 (%)</Label>
            <Input
              type="number"
              value={marginRate}
              onChange={(e) => setMarginRate(Number(e.target.value))}
              step={0.1}
              min={0}
              max={100}
            />
          </div>
          <div className="col-span-2 flex justify-end">
            <Button onClick={handleSaveInfo} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Items Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>거래 품목</CardTitle>
            <CardDescription>{items.length}개 품목 · 기본 마진율 {marginRate}%</CardDescription>
          </div>
          <Button onClick={() => setPickerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            품목 추가
          </Button>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              즐겨찾기 품목에서 거래 품목을 추가하세요
            </p>
          ) : (
            <div className="border rounded-md overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">품목명</th>
                    <th className="text-left p-2">제조사</th>
                    <th className="text-left p-2 w-20">유형</th>
                    <th className="text-right p-2 w-28">공급가</th>
                    <th className="text-right p-2 w-20">마진율</th>
                    <th className="text-right p-2 w-36">납품가</th>
                    <th className="text-center p-2 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-2">{item.item_name}</td>
                      <td className="p-2 text-muted-foreground">{item.manufacturer ?? "-"}</td>
                      <td className="p-2">
                        <Badge variant={item.source_type === "drug" ? "default" : "secondary"}>
                          {item.source_type === "drug" ? "의약품" : "의료기기"}
                        </Badge>
                      </td>
                      <td className="p-2 text-right text-muted-foreground">
                        {item.primary_purchase_price != null ? (
                          formatPrice(item.primary_purchase_price)
                        ) : (
                          <span className="flex items-center justify-end gap-1 text-orange-500">
                            <AlertTriangle className="h-3 w-3" />
                            미등록
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right text-muted-foreground">
                        {marginRate}%
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            className="w-28 text-right h-8"
                            defaultValue={item.delivery_price ?? ""}
                            placeholder={
                              item.computed_delivery_price != null
                                ? Math.round(item.computed_delivery_price).toString()
                                : "0"
                            }
                            onBlur={(e) => handleUpdateDeliveryPrice(item.id, e.target.value)}
                          />
                          {item.delivery_price == null && item.computed_delivery_price != null && (
                            <Badge variant="outline" className="text-xs">자동</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>품목 제거</AlertDialogTitle>
                              <AlertDialogDescription>
                                &quot;{item.item_name}&quot;을(를) 거래 품목에서 제거하시겠습니까?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemoveItem(item.id)}>
                                제거
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ItemPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleAddItems}
        excludeIds={excludeIds}
        searchAction={searchFavoriteItems}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/hospitals/\[id\]/page.tsx apps/web/src/components/hospital-detail.tsx
git commit -m "feat: add hospital detail page with items management and pricing"
```

---

### Task 11: Add navigation from hospital list to detail page

**Files:**
- Modify: `apps/web/src/components/hospital-list.tsx`

- [ ] **Step 1: Read hospital-list.tsx**

Read full file to find row rendering.

- [ ] **Step 2: Add name link to detail page**

Same pattern as Task 7 — make the hospital name cell a link:

```typescript
import Link from "next/link";

// In the name <td>:
<td className="p-2">
  <Link href={`/hospitals/${item.id}`} className="hover:underline text-primary">
    {item.name}
  </Link>
</td>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/hospital-list.tsx
git commit -m "feat: link hospital list rows to detail page"
```

---

## Chunk 4: Message Deletion + Query Updates

### Task 12: Add message deletion to UI

**Files:**
- Modify: `apps/web/src/components/message-inbox/detail-panel.tsx`
- Modify: `apps/web/src/components/messages-view.tsx`

- [ ] **Step 1: Read detail-panel.tsx**

Read full file to find the action bar section.

- [ ] **Step 2: Add delete button to detail panel**

The file already has a `handleDelete` function that calls `deleteMessage`. Verify it exists and works. If there's already a delete button in the bottom action bar, this step is done. If not, add a delete button:

```typescript
// In the bottom action bar (the flex row with pin, copy, create order buttons):
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="icon" title="삭제">
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>메시지 삭제</AlertDialogTitle>
      <AlertDialogDescription>
        이 메시지를 삭제하시겠습니까? 모바일에서도 삭제됩니다.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>취소</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 3: Read messages-view.tsx**

Read full file to understand the list rendering.

- [ ] **Step 4: Add bulk delete to messages view**

The messages-view.tsx uses `MessageInbox` component. The bulk selection + delete functionality needs to be added to the message list panel. This involves:

1. Add `selectedIds` state and checkbox toggle in `messages-view.tsx`
2. Add a bulk action bar at the bottom when items are selected
3. Wire up `deleteMessages` action

```typescript
// Add to MessagesView state:
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

// Add toggle function:
function toggleSelect(id: string) {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

// Add bulk delete handler:
async function handleBulkDelete() {
  const ids = Array.from(selectedIds);
  const { deleteMessages } = await import("@/lib/actions");
  await deleteMessages(ids);
  setSelectedIds(new Set());
  router.refresh();
}

// Add BulkActionBar when items selected (import from @/components/bulk-action-bar):
{selectedIds.size > 0 && (
  <BulkActionBar
    count={selectedIds.size}
    onClear={() => setSelectedIds(new Set())}
    onDelete={handleBulkDelete}
    label="메시지"
  />
)}
```

Pass `selectedIds`, `toggleSelect` props down to the message list component.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/message-inbox/detail-panel.tsx apps/web/src/components/messages-view.tsx
git commit -m "feat: add message deletion (single and bulk)"
```

---

### Task 13: Update products query to use mfds_items directly

**Files:**
- Modify: `apps/web/src/lib/queries/products.ts`

- [ ] **Step 1: Read current products.ts**

Read `apps/web/src/lib/queries/products.ts`.

- [ ] **Step 2: Replace getProductsCatalog**

The `products_catalog` VIEW no longer exists. Replace `getProductsCatalog()` with a direct query:

```typescript
export async function getProductsCatalog() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mfds_items")
    .select("id, item_name, manufacturer, standard_code, source_type, is_favorite")
    .eq("is_favorite", true)
    .order("item_name");
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id as number,
    name: d.item_name as string,
    official_name: d.item_name as string,
    short_name: null as string | null,
    is_active: true,
    standard_code: d.standard_code as string | null,
  }));
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/queries/products.ts
git commit -m "fix(queries): replace products_catalog VIEW with direct mfds_items query"
```

---

### Task 14: Update orders query for mfds_item_id

**Files:**
- Modify: `apps/web/src/lib/queries/orders.ts`

- [ ] **Step 1: Read orders.ts**

Read full file.

- [ ] **Step 2: Update getOrderItems select**

Change the nested join from `products(name)` to `mfds_items(item_name)` in the `getOrderItems` function. Update the flattening logic to map `item_name` instead of `product_name`.

In `getOrder`, update the select to use `mfds_items(item_name)` instead of `products(name)`.

Remove any references to `product_box_specs` in joins.

Key changes:
- `products(name, short_name)` → `mfds_items(item_name, manufacturer, source_type)`
- `product_box_specs(...)` → remove entirely
- `product_id` → `mfds_item_id` in all response mappings
- `product_name` → `item_name` in OrderItemFlat mapping
- Remove `box_quantity` calculation logic (product_box_specs no longer exists)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/queries/orders.ts
git commit -m "fix(queries): update orders to use mfds_item_id instead of product_id"
```

---

### Task 15: Update forecasts query for mfds_item_id

**Files:**
- Modify: `apps/web/src/lib/queries/forecasts.ts`

- [ ] **Step 1: Read forecasts.ts**

Read full file.

- [ ] **Step 2: Update forecast_items joins**

Change `product_id` references to `mfds_item_id`. If `getForecast` joins `forecast_items(*, products(name))`, change to `forecast_items(*, mfds_items(item_name))`.

Map `product_name` → `item_name` in response.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/queries/forecasts.ts
git commit -m "fix(queries): update forecasts to use mfds_item_id"
```

---

## Chunk 5: Order Creation Enhancement

### Task 16: Extend createOrderAction

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/actions.ts`

- [ ] **Step 1: Read current createOrderAction**

Read `apps/web/src/app/(dashboard)/orders/actions.ts` to see the full createOrderAction implementation.

- [ ] **Step 2: Update createOrderAction to accept new fields**

Update the function signature and insert logic:

```typescript
export async function createOrderAction(data: {
  hospital_id: number;
  order_date: string;
  delivery_date?: string;
  notes?: string;
  discount_rate?: number;         // NEW: order-level discount
  source_message_ids?: string[];  // NEW: multiple source messages
  items: Array<{
    mfds_item_id: number;         // CHANGED: was product_id
    supplier_id?: number;
    quantity: number;
    unit_price?: number;          // delivery price snapshot
    purchase_price?: number;      // supply price snapshot
    discount_rate?: number;       // NEW: item-level discount
    final_price?: number;         // NEW: computed final price
    display_columns?: Record<string, string>; // NEW: MFDS column snapshot
  }>;
}) {
  // ... existing order number generation ...

  // Insert order with discount_rate
  const orderInsert = {
    order_number: orderNumber,
    hospital_id: data.hospital_id,
    order_date: data.order_date,
    delivery_date: data.delivery_date || null,
    notes: data.notes || null,
    discount_rate: data.discount_rate ?? 0,
    status: "draft",
    total_items: data.items.length,
    // source_message_id: first message if provided
    source_message_id: data.source_message_ids?.[0] ?? null,
  };

  // Insert order items with new fields
  const itemInserts = data.items.map((item) => ({
    order_id: orderId,
    mfds_item_id: item.mfds_item_id,
    supplier_id: item.supplier_id || null,
    quantity: item.quantity,
    unit_price: item.unit_price || null,
    purchase_price: item.purchase_price || null,
    discount_rate: item.discount_rate ?? 0,
    final_price: item.final_price || null,
    display_columns: item.display_columns || null,
    line_total: item.final_price ? item.final_price * item.quantity : null,
  }));
}
```

Also update `searchMyItemsAction` to use `searchFavoriteItems` pattern (it currently imports from products.ts which still works, but verify).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/orders/actions.ts
git commit -m "feat(orders): extend createOrderAction with discount, pricing, MFDS columns"
```

---

### Task 17: Enhance OrderInlineForm

**Files:**
- Modify: `apps/web/src/components/order-inline-form.tsx`

This is the most complex task. The form needs:
1. Order-level discount rate input
2. "Add from favorites" button (replaces or complements current search)
3. Per-item: supplier selector, supply price, delivery price, item discount, final price, MFDS columns
4. Auto price calculation

- [ ] **Step 1: Read order-inline-form.tsx fully**

Read the entire file to understand current state management and UI.

- [ ] **Step 2: Add order discount state**

```typescript
// Add to state:
const [orderDiscountRate, setOrderDiscountRate] = useState(0);
```

Add input field after delivery date:
```tsx
<div>
  <Label>주문 할인율 (%)</Label>
  <Input
    type="number"
    value={orderDiscountRate}
    onChange={(e) => setOrderDiscountRate(Number(e.target.value))}
    step={0.1}
    min={0}
    max={100}
  />
</div>
```

- [ ] **Step 3: Update SelectedItem type and add pricing state**

```typescript
interface SelectedItem {
  mfds_item_id: number;
  type: "drug" | "device";
  name: string;
  code: string | null;
  manufacturer: string | null;
  quantity: number;
  supplier_id: number | null;
  supplier_name: string | null;
  purchase_price: number | null;  // supply price
  unit_price: number | null;      // delivery price
  discount_rate: number;          // item discount %
  final_price: number | null;     // computed
  display_columns: Record<string, string> | null;
  raw: Record<string, unknown>;
}
```

- [ ] **Step 4: Add "Add from favorites" button**

Replace or supplement the current search with an ItemPickerModal. When hospital is selected, filter to hospital_items; otherwise show all favorites.

```typescript
// Add state:
const [favPickerOpen, setFavPickerOpen] = useState(false);

// Add action to load hospital items:
async function handleAddFromFavorites(mfdsItemIds: number[]) {
  // For each ID, fetch item details + pricing
  const { getHospitalItemsForOrder } = await import("@/lib/actions");
  // ... populate selectedItems with pricing data
}
```

- [ ] **Step 5: Add price calculation helper**

```typescript
function calculateFinalPrice(
  unitPrice: number | null,
  orderDiscount: number,
  itemDiscount: number,
): number | null {
  if (unitPrice == null) return null;
  return unitPrice * (1 - orderDiscount / 100) * (1 - itemDiscount / 100);
}
```

Wire this into every price change to auto-recalculate `final_price`.

- [ ] **Step 6: Add MFDS display columns**

Read `order_display_columns` from settings (passed as prop `displayColumns`). When an item is added, extract the relevant fields from its `raw_data` and store in `display_columns`.

- [ ] **Step 7: Update form submission**

Update the `handleSubmit` to call the enhanced `createOrderAction` with all new fields.

- [ ] **Step 8: Verify the form compiles and renders**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/order-inline-form.tsx
git commit -m "feat: enhance order form with favorites, pricing, discounts, MFDS columns"
```

---

### Task 18: Update order table and detail views

**Files:**
- Modify: `apps/web/src/components/order-table.tsx`
- Modify: `apps/web/src/components/order-detail-client.tsx`

- [ ] **Step 1: Read both files**

Read `order-table.tsx` and `order-detail-client.tsx`.

- [ ] **Step 2: Update order-table.tsx**

- Change references from `product_id`/`product_name` to `mfds_item_id`/`item_name`
- Add `discount_rate` and `final_price` columns if desired
- Remove `box_quantity` references
- Update the inline edit to use `mfds_item_id` instead of `product_id`

- [ ] **Step 3: Update order-detail-client.tsx**

- Same column renaming
- Update the item detail display to show discount rate and final price
- Change product search to use mfds_items

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/order-table.tsx apps/web/src/components/order-detail-client.tsx
git commit -m "fix: update order views for mfds_item_id, discount_rate, final_price"
```

---

### Task 19: Add bulk order creation from messages

**Files:**
- Modify: `apps/web/src/components/messages-view.tsx`

- [ ] **Step 1: Add bulk order button to BulkActionBar**

Extend the messages-view bulk actions (from Task 12) with a "주문 생성" button:

```typescript
// When selectedIds.size > 0, show bulk action bar with both delete and create order:
{selectedIds.size > 0 && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-background border rounded-lg shadow-lg p-3">
    <span className="text-sm self-center">{selectedIds.size}개 선택됨</span>
    <Button variant="outline" size="sm" onClick={handleBulkDelete}>
      삭제
    </Button>
    <Button size="sm" onClick={handleBulkCreateOrder}>
      주문 생성
    </Button>
    <Button variant="ghost" size="icon" onClick={() => setSelectedIds(new Set())}>
      <X className="h-4 w-4" />
    </Button>
  </div>
)}
```

The "주문 생성" button opens the OrderInlineForm with `sourceMessageIds` set to the selected message IDs.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/messages-view.tsx
git commit -m "feat: add bulk order creation from selected messages"
```

---

## Chunk 6: Final Cleanup + Verification

### Task 20: Fix remaining TypeScript errors

**Files:**
- Various files that reference `Product`, `ProductSupplier`, `product_id`

- [ ] **Step 1: Run TypeScript compiler**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -50`

- [ ] **Step 2: Fix each error**

Common fixes:
- Replace `Product` type usage with `MfdsItem`
- Replace `product_id` with `mfds_item_id`
- Remove `ProductSupplier` imports
- Update any `products` table references in actions.ts
- Fix KPIS report queries if they join through order_items.product_id

- [ ] **Step 3: Verify clean compilation**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve remaining TypeScript errors from product→mfds_items migration"
```

---

### Task 21: Smoke test the application

- [ ] **Step 1: Rebuild the web container**

Run: `docker compose build web --no-cache && docker compose up -d web`

- [ ] **Step 2: Verify pages load**

Test these URLs in browser:
- `http://localhost:3002/suppliers` — supplier list loads
- `http://localhost:3002/suppliers/1` — supplier detail page (if a supplier exists)
- `http://localhost:3002/hospitals` — hospital list loads
- `http://localhost:3002/hospitals/1` — hospital detail page (if a hospital exists)
- `http://localhost:3002/notifications` — messages page, check for delete buttons
- `http://localhost:3002/orders` — orders page loads without errors

- [ ] **Step 3: Test supplier items flow**

1. Go to supplier detail → click "품목 추가" → search → select items → confirm
2. Verify items appear in the table
3. Edit a supply price → verify it saves
4. Toggle primary supplier → verify it updates

- [ ] **Step 4: Test hospital items flow**

1. Go to hospital detail → set margin rate → save
2. Click "품목 추가" → add items
3. Verify computed delivery price shows (supply price × (1 + margin%))
4. Override delivery price → verify bold style, "자동" badge disappears

- [ ] **Step 5: Test order creation**

1. Go to messages → click a message → "주문 생성"
2. Select hospital → click "즐겨찾기에서 추가"
3. Verify items show with auto-calculated prices
4. Set discounts → verify final price updates
5. Submit order → verify it appears in orders list

- [ ] **Step 6: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: smoke test fixes"
```

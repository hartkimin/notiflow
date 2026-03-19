# Order Form Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve order creation UX with portal-style search, tabbed product sources, resizable persisted columns, and a sales rep field.

**Architecture:** Extract shared `PortalSearchBox` component used by both `PurchaseOrderForm` and `OrderInlineForm`. Add server actions for recent items and MFDS search. Migrate `OrderInlineForm` to shared `LineItem` data model. Store column widths in `settings` table.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (Tabs, Command), Tailwind CSS 4, Supabase PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-20-order-form-improvements-design.md`

**No test framework is configured for the web app.** Skip TDD steps. Verify changes manually via the dev server.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/supabase/migrations/00044_order_items_sales_rep.sql` | Create | Add `sales_rep` column to `order_items` |
| `apps/web/src/lib/chosung.ts` | Create | Korean chosung search utilities (extracted from `purchase-order-form.tsx`) |
| `apps/web/src/components/portal-search-box.tsx` | Create | Reusable portal-style search dropdown |
| `apps/web/src/lib/queries/settings.ts` | Modify | Add `getOrderColumnWidths` |
| `apps/web/src/app/(dashboard)/settings/actions.ts` | Modify | Add `saveColumnWidthsAction`, update `ALLOWED_SETTING_KEYS` |
| `apps/web/src/app/(dashboard)/orders/actions.ts` | Modify | Add recent/search server actions, `sales_rep` in submit |
| `apps/web/src/app/(dashboard)/orders/new/page.tsx` | Modify | Fetch and pass column widths |
| `apps/web/src/app/(dashboard)/orders/page.tsx` | Modify | Remove dead `OrderInlineForm` import, fetch column widths |
| `apps/web/src/components/purchase-order-form.tsx` | Modify | Use PortalSearchBox, tabs, fixed columns, sales_rep |
| `apps/web/src/components/order-inline-form.tsx` | Modify | Migrate data model, same refactor as PurchaseOrderForm |

---

### Task 1: Database Migration — sales_rep column

**Files:**
- Create: `packages/supabase/migrations/00044_order_items_sales_rep.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add sales representative free-text field to order items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sales_rep VARCHAR(100);
```

- [ ] **Step 2: Apply migration locally**

Run: `npm run supabase:reset`
Expected: All migrations apply successfully including 00044.

- [ ] **Step 3: Verify column exists**

Run: `npx supabase db dump --local | grep sales_rep`
Expected: `sales_rep` column visible in `order_items` table definition.

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/migrations/00044_order_items_sales_rep.sql
git commit -m "feat: add sales_rep column to order_items"
```

---

### Task 2: Extract chosung utilities

**Files:**
- Create: `apps/web/src/lib/chosung.ts`
- Modify: `apps/web/src/components/purchase-order-form.tsx` (lines 101-127 — remove inline chosung code, import from new file)

- [ ] **Step 1: Create `apps/web/src/lib/chosung.ts`**

```ts
const CHOSUNG = [
  "ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ",
  "ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ",
];

export function getChosung(char: string): string {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return char;
  return CHOSUNG[Math.floor(code / 588)];
}

export function isChosung(char: string): boolean {
  return CHOSUNG.includes(char);
}

export function matchesChosungSearch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  if (lower.includes(qLower)) return true;
  if (![...qLower].every(isChosung)) return false;
  const textChosung = [...text].map(getChosung).join("");
  return textChosung.includes(qLower);
}
```

- [ ] **Step 2: Update `purchase-order-form.tsx`**

Remove lines 101-127 (the inline `CHOSUNG`, `getChosung`, `isChosung`, `matchesChosungSearch` definitions). Add import at top:

```ts
import { matchesChosungSearch } from "@/lib/chosung";
```

- [ ] **Step 3: Verify build**

Run: `npm run build:web`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/chosung.ts apps/web/src/components/purchase-order-form.tsx
git commit -m "refactor: extract chosung search utilities to shared module"
```

---

### Task 3: Server actions — recent items + MFDS search + sales_rep

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/actions.ts`

- [ ] **Step 1: Add `getRecentHospitalsAction`**

Append to `orders/actions.ts`:

```ts
export async function getRecentHospitalsAction() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("hospital_id, hospitals!inner(id, name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  // Deduplicate by hospital_id, keep order, limit 10
  const seen = new Set<number>();
  const result: Array<{ id: number; name: string }> = [];
  for (const row of data ?? []) {
    const h = row.hospitals as unknown as { id: number; name: string };
    if (!seen.has(h.id)) {
      seen.add(h.id);
      result.push({ id: h.id, name: h.name });
      if (result.length >= 10) break;
    }
  }
  return result;
}
```

- [ ] **Step 2: Add `getRecentPartnerProductsAction`**

```ts
export async function getRecentPartnerProductsAction(hospitalId: number) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  // Get recent product_names from order_items of this hospital's orders
  const { data, error } = await supabase
    .from("order_items")
    .select("product_name, product_id, order_id, orders!inner(hospital_id)")
    .eq("orders.hospital_id", hospitalId)
    .not("product_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  const seen = new Set<string>();
  const result: Array<{ id: number; product_source: "product"; product_id: number; name: string; code: string; unit_price: number | null }> = [];
  for (const row of data ?? []) {
    const key = `${row.product_id ?? row.product_name}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        id: 0,
        product_source: "product",
        product_id: row.product_id ?? 0,
        name: row.product_name ?? "",
        code: "",
        unit_price: null,
      });
      if (result.length >= 10) break;
    }
  }
  return result;
}
```

- [ ] **Step 3: Add `searchMfdsItemsAction` and `getRecentMfdsItemsAction`**

```ts
export async function searchMfdsItemsAction(query: string) {
  if (!query || query.length < 1) return [];
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const q = query.trim();
  const { data, error } = await supabase
    .from("mfds_items")
    .select("id, source_type, item_name, standard_code, manufacturer")
    .or(`item_name.ilike.%${q}%,standard_code.ilike.%${q}%,manufacturer.ilike.%${q}%`)
    .limit(30);
  if (error) return [];
  return (data ?? []).map((item) => ({
    id: item.id,
    name: item.item_name ?? "",
    code: item.standard_code ?? "",
    source_type: item.source_type as "drug" | "device_std",
    manufacturer: item.manufacturer,
  }));
}

export async function getRecentMfdsItemsAction() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  // Get recent mfds items from order_items that have no product_id (i.e., added from mfds)
  const { data, error } = await supabase
    .from("order_items")
    .select("product_name")
    .is("product_id", null)
    .not("product_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  const seen = new Set<string>();
  const result: Array<{ id: number; name: string; code: string; source_type: "drug" | "device_std" }> = [];
  for (const row of data ?? []) {
    if (row.product_name && !seen.has(row.product_name)) {
      seen.add(row.product_name);
      // Note: source_type is unknown from order_items alone; default to "drug".
      // This is acceptable since recent items are just a convenience shortcut.
      result.push({ id: 0, name: row.product_name, code: "", source_type: "drug" });
      if (result.length >= 10) break;
    }
  }
  return result;
}
```

- [ ] **Step 4: Update `createOrderWithDetailsAction` to include `sales_rep`**

In `createOrderWithDetailsAction`, update the items type and insert:

In the function signature's items array type (around line 195-205), add to the item type:
```ts
sales_rep: string | null;
```

In the `orderItems` mapping (around line 235-245), add to the mapped object:
```ts
sales_rep: item.sales_rep,
```

Both changes are required — the type tells TypeScript to accept the field, the mapping ensures it's inserted into the DB.

- [ ] **Step 5: Verify build**

Run: `npm run build:web`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(dashboard)/orders/actions.ts
git commit -m "feat: add server actions for recent items, MFDS search, and sales_rep"
```

---

### Task 4: Settings — column width persistence

**Files:**
- Modify: `apps/web/src/lib/queries/settings.ts` (add `getOrderColumnWidths`)
- Modify: `apps/web/src/app/(dashboard)/settings/actions.ts` (add `saveColumnWidthsAction`)
- Modify: `apps/web/src/app/(dashboard)/orders/new/page.tsx` (fetch column widths)
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx` (fetch column widths)

- [ ] **Step 1: Add `getOrderColumnWidths` to `settings.ts`**

Append to `apps/web/src/lib/queries/settings.ts`:

```ts
export async function getOrderColumnWidths(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "order_column_widths")
    .single();

  if (!data?.value) return {};
  return typeof data.value === "string" ? JSON.parse(data.value) : data.value;
}
```

- [ ] **Step 2: Add `saveColumnWidthsAction` to `settings/actions.ts`**

Add to `ALLOWED_SETTING_KEYS`:
```ts
"order_column_widths",
```

Add new action (no admin check — shared layout preference, not security-sensitive):
```ts
// No requireAdmin() — column widths are a shared layout preference, not a security setting
export async function saveColumnWidthsAction(widths: Record<string, number>) {
  await updateSetting("order_column_widths", widths);
  revalidatePath("/orders");
}
```

- [ ] **Step 3: Update `orders/new/page.tsx` to pass column widths**

```ts
import { getOrderDisplayColumns, getOrderColumnWidths } from "@/lib/queries/settings";

export default async function NewOrderPage({ searchParams }: Props) {
  const params = await searchParams;
  const [displayColumns, columnWidths] = await Promise.all([
    getOrderDisplayColumns(),
    getOrderColumnWidths(),
  ]);

  return (
    <div className="space-y-4">
      <PurchaseOrderForm
        displayColumns={displayColumns}
        columnWidths={columnWidths}
        sourceMessageId={params.source_message_id}
      />
    </div>
  );
}
```

- [ ] **Step 4: Clean up `orders/page.tsx`**

Remove the dead `OrderInlineForm` import (line 8 — it is imported but never rendered in the JSX). No column widths need to be passed here since the inline form is not used on this page.

- [ ] **Step 5: Skip build verification**

Build verification is deferred to Task 6 — the forms don't accept `columnWidths` prop yet.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/queries/settings.ts apps/web/src/app/(dashboard)/settings/actions.ts apps/web/src/app/(dashboard)/orders/new/page.tsx apps/web/src/app/(dashboard)/orders/page.tsx
git commit -m "feat: add column width persistence in settings"
```

---

### Task 5: Create `PortalSearchBox` component

**Files:**
- Create: `apps/web/src/components/portal-search-box.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PortalSearchBoxProps<T extends { id: number; name: string }> {
  placeholder: string;
  onSelect: (item: T) => void;
  fetchRecent: () => Promise<T[]>;
  searchAction: (query: string) => Promise<T[]>;
  renderItem?: (item: T) => React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function PortalSearchBox<T extends { id: number; name: string }>({
  placeholder,
  onSelect,
  fetchRecent,
  searchAction,
  renderItem,
  className,
  disabled,
}: PortalSearchBoxProps<T>) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchRecentRef = useRef(fetchRecent);

  // Reset when fetchRecent identity changes (e.g., hospitalId changes)
  useEffect(() => {
    fetchRecentRef.current = fetchRecent;
    setItems([]);
    setQuery("");
  }, [fetchRecent]);

  // Load recent items on focus
  const handleFocus = useCallback(async () => {
    if (disabled) return;
    setIsOpen(true);
    if (query.length === 0) {
      setIsLoading(true);
      try {
        const recent = await fetchRecentRef.current();
        setItems(recent);
      } finally {
        setIsLoading(false);
      }
    }
  }, [query, disabled]);

  // Search on query change
  useEffect(() => {
    if (!isOpen || query.length === 0) return;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchAction(query);
        setItems(results);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchAction, isOpen]);

  // Show recent when query is cleared
  useEffect(() => {
    if (isOpen && query.length === 0) {
      let cancelled = false;
      setIsLoading(true);
      fetchRecentRef.current().then((data) => {
        if (!cancelled) { setItems(data); setIsLoading(false); }
      });
      return () => { cancelled = true; };
    }
  }, [query, isOpen]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < items.length) {
          onSelect(items[activeIndex]);
          setIsOpen(false);
          setQuery("");
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  }

  function handleSelect(item: T) {
    onSelect(item);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="pl-8"
        />
        {isLoading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
        {query && !isLoading && (
          <button
            type="button"
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-[300px] overflow-y-auto animate-in slide-in-from-top-1 fade-in duration-150">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              {isLoading ? "검색 중..." : query ? "검색 결과 없음" : "최근 항목 없음"}
            </p>
          ) : (
            <>
              {!query && (
                <div className="px-3 py-1.5 border-b bg-muted/30 text-[11px] text-muted-foreground">
                  최근 사용
                </div>
              )}
              {items.map((item, idx) => (
                <button
                  key={`${item.id}-${item.name}-${idx}`}
                  type="button"
                  className={`flex w-full items-center px-3 py-2 text-sm text-left border-b last:border-b-0 transition-colors ${
                    idx === activeIndex ? "bg-accent" : "hover:bg-accent"
                  }`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  {renderItem ? renderItem(item) : item.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build:web`
Expected: Build succeeds (component not yet used).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/portal-search-box.tsx
git commit -m "feat: add PortalSearchBox component with recent items and live search"
```

---

### Task 6: Refactor `PurchaseOrderForm`

**Files:**
- Modify: `apps/web/src/components/purchase-order-form.tsx`

This is the largest task. Apply all four features to the main PO form.

- [ ] **Step 1: Update Props interface**

Add `columnWidths` prop and `sales_rep` to `LineItem`:

```ts
interface Props {
  displayColumns: OrderDisplayColumns;
  columnWidths?: Record<string, number>;
  sourceMessageId?: string;
}
```

Add to `LineItem`:
```ts
sales_rep: string;
```

Add to `OPTIONAL_COLUMNS`:
```ts
{ id: "sales_rep", label: "영업담당자", matchKeys: [] },
```

- [ ] **Step 2: Add imports**

Add at top:
```ts
import { PortalSearchBox } from "@/components/portal-search-box";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { matchesChosungSearch } from "@/lib/chosung";
import {
  getRecentHospitalsAction,
  getRecentPartnerProductsAction,
  getRecentMfdsItemsAction,
  searchMfdsItemsAction,
  searchHospitalsAction,
} from "@/app/(dashboard)/orders/actions";
import { saveColumnWidthsAction } from "@/app/(dashboard)/settings/actions";
```

Remove the inline chosung functions (already done in Task 2).

- [ ] **Step 3: Replace hospital search with `PortalSearchBox`**

Replace the hospital search section (around lines 368-434) with:

```tsx
<div>
  <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">거래처 (납품처)</Label>
  {hospitalId ? (
    <div className="mt-1.5 flex items-center gap-2">
      <Badge variant="secondary" className="text-sm py-1 px-3">
        {hospitalName}
      </Badge>
      <button
        type="button"
        onClick={() => { setHospitalId(null); setHospitalName(""); setPartnerProducts([]); }}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  ) : (
    <div className="mt-1.5">
      <PortalSearchBox
        placeholder="거래처명을 입력하세요..."
        fetchRecent={getRecentHospitalsAction}
        searchAction={searchHospitalsAction}
        onSelect={(h) => { setHospitalId(h.id); setHospitalName(h.name); }}
      />
    </div>
  )}
</div>
```

Remove: `showHospitalList`, `hospitalSearch`, `filteredHospitals` state and related UI. Remove `allHospitals`, `hospitalsLoaded` state and the useEffect that loads them. These are replaced by `PortalSearchBox`.

- [ ] **Step 4: Replace product search with tabs + `PortalSearchBox`**

Replace the "품목 추가" section (around lines 458-621) with tabbed UI:

```tsx
<div className="p-6 border-b bg-muted/20">
  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
    <Plus className="h-4 w-4" />
    품목 추가
  </h3>

  <Tabs defaultValue={hospitalId ? "partner" : "mfds"} className="space-y-3">
    <TabsList>
      <TabsTrigger value="partner" className="text-xs" disabled={!hospitalId}>
        거래처 품목
        {partnerProducts.length > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 ml-1.5">
            {partnerProducts.length}
          </Badge>
        )}
      </TabsTrigger>
      <TabsTrigger value="mfds" className="text-xs">식약처 아이템</TabsTrigger>
    </TabsList>

    <TabsContent value="partner">
      {!hospitalId ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          먼저 거래처를 선택하세요
        </p>
      ) : productsLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <PortalSearchBox
          placeholder="거래처 등록 품목 검색..."
          fetchRecent={fetchRecentPartnerProducts}
          searchAction={searchPartnerProductsLocal}
          onSelect={addPartnerProduct}
          renderItem={renderProductItem}
        />
      )}
    </TabsContent>

    <TabsContent value="mfds">
      <PortalSearchBox
        placeholder="식약처 품목 검색 (품목명, 코드, 업체명)..."
        fetchRecent={getRecentMfdsItemsAction}
        searchAction={searchMfdsItemsAction}
        onSelect={addMfdsItem}
        renderItem={renderMfdsItem}
      />
    </TabsContent>
  </Tabs>
</div>
```

Add helper functions:

```ts
const fetchRecentPartnerProducts = useCallback(
  () => getRecentPartnerProductsAction(hospitalId!),
  [hospitalId]
);

const searchPartnerProductsLocal = useCallback(
  async (query: string) => {
    return partnerProducts.filter((pp) =>
      matchesChosungSearch(pp.name, query) || (pp.code ?? "").toLowerCase().includes(query.toLowerCase())
    );
  },
  [partnerProducts]
);

interface MfdsSearchResult { id: number; name: string; code: string; source_type: "drug" | "device_std"; manufacturer?: string | null; }

function addMfdsItem(item: MfdsSearchResult) {
  const sourceType = item.source_type === "device_std" ? "device" : "drug";
  if (items.some((i) => `${i.source_type}-${i.product_id}` === `${sourceType}-${item.id}`)) {
    toast.error("이미 추가된 품목입니다");
    return;
  }
  setItems((prev) => [...prev, {
    key: nextKey(),
    product_id: item.id,
    product_name: item.name,
    standard_code: item.code || null,
    supplier_id: null,
    supplier_name: null,
    suppliers: [],
    quantity: 1,
    unit_type: "piece",
    custom_unit: false,
    purchase_price: null,
    selling_price: null,
    kpis_number: "",
    source_type: sourceType as "drug" | "device",
    sales_rep: "",
  }]);
}

interface PartnerProductItem { id: number; product_source: string; product_id: number; name: string; code: string; unit_price: number | null; }

function addPartnerProduct(pp: PartnerProductItem) {
  addProduct(pp as PartnerProduct); // existing function, ensure sales_rep: "" is set in addProduct
}

function renderProductItem(item: PartnerProductItem) {
  return (
    <div className="flex items-center gap-2 w-full">
      <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 shrink-0 ${
        item.product_source === "drug" ? "text-blue-600 bg-blue-50 border-blue-200" : "text-emerald-600 bg-emerald-50 border-emerald-200"
      }`}>
        {item.product_source === "drug" ? "약" : "기기"}
      </Badge>
      <span className="font-medium truncate">{item.name}</span>
      {item.unit_price != null && (
        <span className="text-xs text-muted-foreground ml-auto shrink-0">{item.unit_price.toLocaleString()}원</span>
      )}
    </div>
  );
}

function renderMfdsItem(item: MfdsSearchResult) {
  const isDrug = item.source_type !== "device_std";
  return (
    <div className="flex items-center gap-2 w-full">
      <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 shrink-0 ${
        isDrug ? "text-blue-600 bg-blue-50 border-blue-200" : "text-emerald-600 bg-emerald-50 border-emerald-200"
      }`}>
        {isDrug ? "약" : "기기"}
      </Badge>
      <span className="font-medium truncate">{item.name}</span>
      {item.code && <span className="text-xs text-muted-foreground ml-auto shrink-0">{item.code}</span>}
    </div>
  );
}
```

Remove: `showPartnerList`, `hpSearch`, `hpPage`, `productSearch`, `allProducts` state and related filter/pagination logic. These are now handled by `PortalSearchBox`.

- [ ] **Step 5: Fix table layout + add sales_rep column**

Update the table to use `table-fixed` and add sales_rep:

On `<Table>` tag: ensure `className="table-fixed"` is set.

Each `<TableHead>` should use `style={{ width: colWidths[colId] ?? defaultWidth }}` (already present, just ensure initial values come from props).

Initialize `colWidths` from props:
```ts
const [colWidths, setColWidths] = useState<Record<string, number>>(props.columnWidths ?? {});
```

Add `title` attribute to each `<TableCell>` that shows text:
```tsx
<TableCell className="text-sm truncate overflow-hidden" title={item.product_name}>
```

Add sales_rep column rendering (when `visibleCols.has("sales_rep")`):

In `<TableHeader>`:
```tsx
{visibleCols.has("sales_rep") && (
  <TableHead className="text-xs relative" style={{ width: colWidths["sales_rep"] ?? 100 }}>
    영업담당자
    <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("sales_rep", e)} />
  </TableHead>
)}
```

In `<TableBody>` row:
```tsx
{visibleCols.has("sales_rep") && (
  <TableCell>
    <Input
      value={item.sales_rep}
      onChange={(e) => updateItem(item.key, { sales_rep: e.target.value.slice(0, 100) })}
      placeholder="담당자"
      className="h-7 w-full text-xs"
    />
  </TableCell>
)}
```

In totals row, add empty cell:
```tsx
{visibleCols.has("sales_rep") && <TableCell />}
```

- [ ] **Step 6: Persist column widths on resize**

Add a ref to track last-saved widths and debounced save:

```ts
const lastSavedWidths = useRef<Record<string, number>>(props.columnWidths ?? {});

// In the existing mouseup handler, after setting colWidths, add:
const saveTimer = useRef<ReturnType<typeof setTimeout>>();

// Modify the onMouseUp inside handleResizeStart:
const onMouseUp = () => {
  resizingRef.current = null;
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
  // Debounced save
  clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => {
    setColWidths((current) => {
      if (JSON.stringify(current) !== JSON.stringify(lastSavedWidths.current)) {
        lastSavedWidths.current = { ...current };
        saveColumnWidthsAction(current);
      }
      return current;
    });
  }, 500);
};
```

- [ ] **Step 7: Update `addProduct` to include `sales_rep`**

In the existing `addProduct` function, add `sales_rep: ""` to the new item object.

- [ ] **Step 8: Update `handleSubmit` to include `sales_rep`**

In the items mapping inside `handleSubmit`, add:
```ts
sales_rep: i.sales_rep || null,
```

- [ ] **Step 9: Verify build + manual test**

Run: `npm run build:web`
Then: `npm run dev:web` and test at `http://localhost:3000/orders/new`:
- Click hospital search → should show recent 10 hospitals
- Type to filter → results update live
- Select hospital → tabs appear
- 거래처 품목 tab → portal search with recent items
- 식약처 아이템 tab → portal search with MFDS items
- Add items → table has fixed columns, no overflow
- Resize columns → widths persist after page reload
- 영업담당자 column visible via column settings toggle

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/purchase-order-form.tsx
git commit -m "feat: refactor PurchaseOrderForm with portal search, tabs, fixed columns, sales_rep"
```

---

### Task 7: Refactor `OrderInlineForm`

**Files:**
- Modify: `apps/web/src/components/order-inline-form.tsx`

Migrate to `LineItem` data model and apply the same four features.

- [ ] **Step 1: Migrate data model**

Replace `SelectedItem` interface with `LineItem` (same as in `purchase-order-form.tsx`). Replace `searchMyItemsAction` with the tabbed approach. Replace `createOrderAction` with `createOrderWithDetailsAction`.

Update the Props interface:
```ts
interface OrderInlineFormProps {
  displayColumns: { drug: string[]; device: string[] };
  columnWidths?: Record<string, number>;
  initialNotes?: string;
  sourceMessageId?: string;
}
```

- [ ] **Step 2: Replace hospital search with `PortalSearchBox`**

Same pattern as Task 6 Step 3. Replace `SearchableCombobox` with `PortalSearchBox`.

Remove `SearchableCombobox` import.

- [ ] **Step 3: Replace product search with tabs**

Same pattern as Task 6 Step 4. Replace the single search input with tabbed `PortalSearchBox`.

- [ ] **Step 4: Fix table layout + add sales_rep + column resize**

Apply `table-fixed`, add resize handles, add `sales_rep` column, initialize widths from props, persist on resize. Same pattern as Task 6 Steps 5-6.

- [ ] **Step 5: Update submit handler**

Switch from `createOrderAction` to `createOrderWithDetailsAction`. Map items to match the expected payload format including `sales_rep`.

- [ ] **Step 6: Clean up unused state**

Remove: `searchQuery`, `searchResults`, `isSearching`, `SearchableCombobox` import, old DRUG_LABELS/DEVICE_LABELS if no longer needed.

- [ ] **Step 7: Verify build + manual test**

Run: `npm run build:web`
Then: `npm run dev:web` and test from the orders list page (inline form):
- Same verification as Task 6 Step 9 but via the Sheet form.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/order-inline-form.tsx
git commit -m "feat: refactor OrderInlineForm with portal search, tabs, fixed columns, sales_rep"
```

---

### Task 8: Final verification + lint

- [ ] **Step 1: Run lint**

Run: `npm run lint:web`
Expected: No errors.

- [ ] **Step 2: Run production build**

Run: `npm run build:web`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual smoke test**

Start dev server, verify:
1. `/orders/new` — full PO form works end-to-end
2. `/orders` — inline form works end-to-end
3. Column widths persist after page reload
4. Sales rep column toggleable and saves with order

- [ ] **Step 4: Final commit if any lint fixes**

```bash
git add -A
git commit -m "fix: lint and cleanup after order form improvements"
```

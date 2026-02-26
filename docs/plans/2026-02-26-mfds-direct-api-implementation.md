# MFDS 직접 API 검색 전환 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace full MFDS sync with real-time API search. Two tabs (의약품/의료기기), Server Actions, JSONB storage, delete all sync infrastructure.

**Architecture:** Products page becomes MFDS API search tool with 2 tabs. `/products/my` page for saved products CRUD. Shared `MfdsSearchPanel` component used in both products page and order creation. Server Actions call Korean gov APIs directly.

**Tech Stack:** Next.js 16 Server Actions, Supabase (PostgreSQL), shadcn/ui (Tabs, Input, Table, Button, ScrollArea), Korean gov data.go.kr APIs

---

### Task 1: DB Migration — Add JSONB column, drop MFDS tables

**Files:**
- Create: `packages/supabase/migrations/00028_mfds_direct_api.sql`

**Step 1: Write the migration SQL**

```sql
-- 00028_mfds_direct_api.sql
-- Transition from full MFDS sync to direct API search

-- 1. Add new columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS mfds_raw JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mfds_source_type TEXT;

-- 2. Remove FK to mfds_items
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_mfds_item_id_fkey;
ALTER TABLE products DROP COLUMN IF EXISTS mfds_item_id;

-- 3. Drop RPC function
DROP FUNCTION IF EXISTS update_products_from_mfds(TIMESTAMPTZ);

-- 4. Drop mfds_sync_logs
DROP TABLE IF EXISTS mfds_sync_logs CASCADE;

-- 5. Drop mfds_items (and all indexes, triggers)
DROP TABLE IF EXISTS mfds_items CASCADE;

-- 6. Drop enum type (if no longer referenced)
DROP TYPE IF EXISTS mfds_source_type CASCADE;
```

**Step 2: Apply migration locally**

Run: `cd /mnt/d/Project/09_NotiFlow && npx supabase db push --linked`
Expected: Migration applied successfully.

**Step 3: Commit**

```bash
git add packages/supabase/migrations/00028_mfds_direct_api.sql
git commit -m "feat(db): add mfds_raw JSONB column, drop mfds_items and sync infrastructure"
```

---

### Task 2: Delete sync-mfds Edge Function and cron SQL

**Files:**
- Delete: `packages/supabase/functions/sync-mfds/` (entire directory)
- Delete: `docs/plans/00025_mfds_cron_setup.sql`

**Step 1: Delete the files**

```bash
rm -rf packages/supabase/functions/sync-mfds/
rm -f docs/plans/00025_mfds_cron_setup.sql
```

**Step 2: Commit**

```bash
git add -A packages/supabase/functions/sync-mfds/ docs/plans/00025_mfds_cron_setup.sql
git commit -m "chore: remove sync-mfds Edge Function and pg_cron setup SQL"
```

---

### Task 3: Update types — Remove MFDS sync types, add API search types

**Files:**
- Modify: `apps/web/src/lib/types.ts`

**Step 1: Remove old MFDS types**

Delete from `types.ts`:
- `MfdsSourceType` (line ~377)
- `MfdsItem` interface (line ~379-413)
- `MfdsSyncLog` interface (line ~415-435)
- `MfdsSearchResponse` interface (line ~437-442)
- `MfdsSyncStats` interface (line ~444-449)
- `mfds_item_id` field from `Product` interface (line ~130)

**Step 2: Add new types**

Add to `types.ts`:

```typescript
// --- MFDS Direct API Search ---

export type MfdsApiSource = "drug" | "device_std";

/** Raw API response item from 의약품 허가정보 */
export interface MfdsDrugItem {
  ITEM_SEQ: string;
  ITEM_NAME: string;
  ENTP_NAME: string;
  ENTP_NO: string;
  ITEM_PERMIT_DATE: string;
  BAR_CODE: string;
  EDI_CODE: string;
  ATC_CODE: string;
  MAIN_ITEM_INGR: string;
  BIZRNO: string;
  RARE_DRUG_YN: string;
  [key: string]: string;  // API may return additional fields
}

/** Raw API response item from 의료기기 표준코드 */
export interface MfdsDeviceStdItem {
  UDIDI_CD: string;
  PRDLST_NM: string;
  MNFT_IPRT_ENTP_NM: string;
  PERMIT_NO: string;
  PRMSN_YMD: string;
  MDEQ_CLSF_NO: string;
  CLSF_NO_GRAD_CD: string;
  PRDT_NM_INFO: string;
  USE_PURPS_CONT: string;
  FOML_INFO: string;
  HMBD_TRSPT_MDEQ_YN: string;
  DSPSBL_MDEQ_YN: string;
  TRCK_MNG_TRGT_YN: string;
  TOTAL_DEV: string;
  CMBNMD_YN: string;
  USE_BEFORE_STRLZT_NEED_YN: string;
  STERILIZATION_METHOD_NM: string;
  STRG_CND_INFO: string;
  CIRC_CND_INFO: string;
  RCPRSLRY_TRGT_YN: string;
  [key: string]: string;
}

export type MfdsApiItem = MfdsDrugItem | MfdsDeviceStdItem;

export interface MfdsApiSearchResult {
  items: MfdsApiItem[];
  totalCount: number;
  page: number;
}
```

**Step 3: Update Product interface**

Replace `mfds_item_id: number | null;` with:
```typescript
  mfds_raw: Record<string, unknown> | null;
  mfds_source_type: string | null;
```

**Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat(types): replace MFDS sync types with direct API search types"
```

---

### Task 4: Server Actions — MFDS API search + add to products

**Files:**
- Modify: `apps/web/src/lib/actions.ts`

**Step 1: Delete old MFDS actions**

Remove these functions from `actions.ts`:
- `triggerMfdsSync` (lines ~612-675)
- `getMfdsSyncStats` (lines ~677-700)
- `getMfdsSyncLogs` (lines ~702-712)
- `searchMfdsItems` (lines ~714-740)

**Step 2: Add new MFDS search Server Actions**

Add to `actions.ts`:

```typescript
// --- MFDS Direct API Search ---

async function getMfdsApiKey(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "drug_api_service_key")
    .single();
  if (!data?.value) throw new Error("MFDS API 키가 설정되지 않았습니다. 설정 페이지에서 등록해주세요.");
  return data.value;
}

export async function searchMfdsDrug(
  filters: { name?: string; company?: string; code?: string },
  page = 1,
) {
  const serviceKey = await getMfdsApiKey();
  const params = new URLSearchParams({
    serviceKey,
    pageNo: String(page),
    numOfRows: "25",
    type: "json",
  });
  if (filters.name) params.set("ITEM_NAME", filters.name);
  if (filters.company) params.set("ENTP_NAME", filters.company);
  if (filters.code) params.set("ITEM_SEQ", filters.code);

  const url = `https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MFDS API 오류: ${res.status}`);

  const json = await res.json();
  const body = json?.body;
  if (!body) return { items: [], totalCount: 0, page };

  const rawItems = Array.isArray(body.items)
    ? body.items
    : body.items?.item
      ? Array.isArray(body.items.item) ? body.items.item : [body.items.item]
      : [];

  return {
    items: rawItems,
    totalCount: body.totalCount ?? 0,
    page,
  };
}

export async function searchMfdsDevice(
  filters: { name?: string; company?: string; code?: string },
  page = 1,
) {
  const serviceKey = await getMfdsApiKey();
  const params = new URLSearchParams({
    serviceKey,
    pageNo: String(page),
    numOfRows: "25",
    type: "json",
  });
  if (filters.name) params.set("PRDLST_NM", filters.name);
  if (filters.company) params.set("MNFT_IPRT_ENTP_NM", filters.company);
  if (filters.code) params.set("UDIDI_CD", filters.code);

  const url = `https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03/getMdeqStdCdPrdtInfoInq03?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MFDS API 오류: ${res.status}`);

  const json = await res.json();
  const body = json?.body;
  if (!body) return { items: [], totalCount: 0, page };

  const rawItems = Array.isArray(body.items)
    ? body.items
    : body.items?.item
      ? Array.isArray(body.items.item) ? body.items.item : [body.items.item]
      : [];

  return {
    items: rawItems,
    totalCount: body.totalCount ?? 0,
    page,
  };
}

export async function addMfdsItemToProducts(
  item: Record<string, unknown>,
  sourceType: "drug" | "device_std",
) {
  const supabase = await createClient();

  // Map API fields to products columns
  const mapped: Record<string, unknown> = sourceType === "drug"
    ? {
        name: item.ITEM_NAME ?? "",
        official_name: item.ITEM_NAME ?? "",
        manufacturer: item.ENTP_NAME ?? null,
        standard_code: item.BAR_CODE ?? null,
        ingredient: item.MAIN_ITEM_INGR ?? null,
        category: "drug",
      }
    : {
        name: item.PRDLST_NM ?? "",
        official_name: item.PRDLST_NM ?? "",
        manufacturer: item.MNFT_IPRT_ENTP_NM ?? null,
        standard_code: item.UDIDI_CD ?? null,
        efficacy: item.USE_PURPS_CONT ?? null,
        category: "device",
      };

  // Check if already exists by standard_code
  if (mapped.standard_code) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("standard_code", mapped.standard_code as string)
      .maybeSingle();

    if (existing) {
      return { success: true, id: existing.id, alreadyExists: true };
    }
  }

  const { data: row, error } = await supabase
    .from("products")
    .insert({
      ...mapped,
      mfds_raw: item,
      mfds_source_type: sourceType,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/products");
  return { success: true, id: row.id, alreadyExists: false };
}
```

**Step 3: Update createProduct**

Remove `mfds_item_id` from `createProduct` parameter type. Add `mfds_raw` and `mfds_source_type` as optional params:

```typescript
export async function createProduct(data: {
  official_name: string;
  short_name?: string;
  category?: string;
  manufacturer?: string;
  ingredient?: string;
  efficacy?: string;
  standard_code?: string;
  unit?: string;
  unit_price?: number;
  auto_info?: Record<string, unknown>;
  mfds_raw?: Record<string, unknown>;
  mfds_source_type?: string;
}) {
```

**Step 4: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "feat(actions): add MFDS direct API search, remove sync actions"
```

---

### Task 5: Build MfdsSearchPanel shared component

**Files:**
- Create: `apps/web/src/components/mfds-search-panel.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Check, Search } from "lucide-react";
import {
  searchMfdsDrug,
  searchMfdsDevice,
  addMfdsItemToProducts,
} from "@/lib/actions";
import type { MfdsApiSource } from "@/lib/types";

interface MfdsSearchPanelProps {
  mode: "browse" | "pick";
  onSelect?: (productId: number) => void;
  existingStandardCodes?: string[];
}

const DRUG_COLUMNS = [
  { key: "ITEM_SEQ", label: "품목기준코드" },
  { key: "ITEM_NAME", label: "품목명" },
  { key: "ENTP_NAME", label: "업체명" },
  { key: "ITEM_PERMIT_DATE", label: "허가일자" },
  { key: "ENTP_NO", label: "허가번호" },
  { key: "BAR_CODE", label: "바코드" },
  { key: "EDI_CODE", label: "EDI코드" },
  { key: "ATC_CODE", label: "ATC코드" },
  { key: "MAIN_ITEM_INGR", label: "주성분" },
  { key: "BIZRNO", label: "사업자등록번호" },
  { key: "RARE_DRUG_YN", label: "희귀의약품" },
];

const DEVICE_STD_COLUMNS = [
  { key: "UDIDI_CD", label: "UDI코드" },
  { key: "PRDLST_NM", label: "품목명" },
  { key: "MNFT_IPRT_ENTP_NM", label: "제조/수입업체" },
  { key: "PERMIT_NO", label: "허가번호" },
  { key: "PRMSN_YMD", label: "허가일자" },
  { key: "MDEQ_CLSF_NO", label: "분류번호" },
  { key: "CLSF_NO_GRAD_CD", label: "등급" },
  { key: "PRDT_NM_INFO", label: "제품명" },
  { key: "USE_PURPS_CONT", label: "사용목적" },
  { key: "FOML_INFO", label: "규격정보" },
  { key: "HMBD_TRSPT_MDEQ_YN", label: "위해물질수송" },
  { key: "DSPSBL_MDEQ_YN", label: "일회용" },
  { key: "TRCK_MNG_TRGT_YN", label: "추적관리" },
  { key: "TOTAL_DEV", label: "총수량" },
  { key: "CMBNMD_YN", label: "조합" },
  { key: "USE_BEFORE_STRLZT_NEED_YN", label: "사용전멸균" },
  { key: "STERILIZATION_METHOD_NM", label: "멸균방법" },
  { key: "STRG_CND_INFO", label: "보관조건" },
  { key: "CIRC_CND_INFO", label: "유통조건" },
  { key: "RCPRSLRY_TRGT_YN", label: "재사용대상" },
];

export function MfdsSearchPanel({
  mode,
  onSelect,
  existingStandardCodes = [],
}: MfdsSearchPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [tab, setTab] = useState<MfdsApiSource>("drug");
  const [filters, setFilters] = useState({ name: "", company: "", code: "" });
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);

  const columns = tab === "drug" ? DRUG_COLUMNS : DEVICE_STD_COLUMNS;
  const pageSize = 25;
  const totalPages = Math.ceil(totalCount / pageSize);

  function getStandardCode(item: Record<string, unknown>): string {
    return (tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string ?? "";
  }

  function doSearch(targetPage = 1) {
    if (!filters.name && !filters.company && !filters.code) {
      toast.error("검색어를 1개 이상 입력해주세요.");
      return;
    }
    startTransition(async () => {
      try {
        const searchFn = tab === "drug" ? searchMfdsDrug : searchMfdsDevice;
        const result = await searchFn(filters, targetPage);
        setResults(result.items as Record<string, unknown>[]);
        setTotalCount(result.totalCount);
        setPage(targetPage);
        setHasSearched(true);
      } catch (err) {
        toast.error(`검색 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      }
    });
  }

  function handleAdd(item: Record<string, unknown>) {
    const code = getStandardCode(item);
    setAddingId(code);
    startTransition(async () => {
      try {
        const result = await addMfdsItemToProducts(item, tab);
        if (result.alreadyExists) {
          toast.info("이미 내 품목에 등록된 항목입니다.");
        } else {
          toast.success("내 품목에 추가되었습니다.");
        }
        if (mode === "pick" && onSelect) {
          onSelect(result.id);
        }
        router.refresh();
      } catch (err) {
        toast.error(`추가 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      } finally {
        setAddingId(null);
      }
    });
  }

  function handleTabChange(value: string) {
    setTab(value as MfdsApiSource);
    setResults([]);
    setTotalCount(0);
    setPage(1);
    setHasSearched(false);
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="drug">의약품</TabsTrigger>
          <TabsTrigger value="device_std">의료기기</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-4">
          {/* Search Form */}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => { e.preventDefault(); doSearch(1); }}
          >
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">품목명</label>
              <Input
                placeholder={tab === "drug" ? "의약품명 검색..." : "의료기기명 검색..."}
                value={filters.name}
                onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">업체명</label>
              <Input
                placeholder="제조/수입업체..."
                value={filters.company}
                onChange={(e) => setFilters((f) => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">
                {tab === "drug" ? "품목기준코드" : "UDI코드"}
              </label>
              <Input
                placeholder={tab === "drug" ? "ITEM_SEQ..." : "UDIDI_CD..."}
                value={filters.code}
                onChange={(e) => setFilters((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1">검색</span>
            </Button>
          </form>

          {/* Results info */}
          {hasSearched && (
            <p className="text-sm text-muted-foreground">
              총 {totalCount.toLocaleString()}건 (페이지 {page}/{totalPages || 1})
            </p>
          )}

          {/* Scrollable Table */}
          {results.length > 0 && (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-max min-w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left whitespace-nowrap sticky left-0 bg-muted/50 z-10">
                      {mode === "browse" ? "추가" : "선택"}
                    </th>
                    {columns.map((col) => (
                      <th key={col.key} className="px-3 py-2 text-left whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {results.map((item, idx) => {
                    const code = getStandardCode(item);
                    const alreadyAdded = existingStandardCodes.includes(code);

                    return (
                      <tr key={`${code}-${idx}`} className="hover:bg-muted/30">
                        <td className="px-3 py-2 sticky left-0 bg-background z-10">
                          {alreadyAdded ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Check className="h-3 w-3" /> 추가됨
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isPending && addingId === code}
                              onClick={() => handleAdd(item)}
                            >
                              {isPending && addingId === code
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Plus className="h-3 w-3" />}
                            </Button>
                          )}
                        </td>
                        {columns.map((col) => (
                          <td key={col.key} className="px-3 py-2 whitespace-nowrap max-w-[300px] truncate">
                            {(item[col.key] as string) ?? ""}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {hasSearched && results.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              검색 결과가 없습니다.
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isPending}
                onClick={() => doSearch(page - 1)}
              >
                이전
              </Button>
              <span className="text-sm">{page} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isPending}
                onClick={() => doSearch(page + 1)}
              >
                다음
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/mfds-search-panel.tsx
git commit -m "feat: add MfdsSearchPanel shared component for direct API search"
```

---

### Task 6: Replace /products page with MFDS search

**Files:**
- Modify: `apps/web/src/app/(dashboard)/products/page.tsx`

**Step 1: Rewrite the products page**

Replace the entire file with:

```tsx
import { getProducts } from "@/lib/queries/products";
import { MfdsSearchPanel } from "@/components/mfds-search-panel";

export default async function ProductsPage() {
  // Fetch existing standard codes for "already added" badge
  const { products } = await getProducts({ limit: 9999 });
  const existingCodes = products
    .map((p) => p.standard_code)
    .filter((c): c is string => !!c);

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">품목관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          식약처 API에서 의약품/의료기기를 검색하고 내 품목에 추가합니다.
        </p>
      </div>
      <MfdsSearchPanel mode="browse" existingStandardCodes={existingCodes} />
    </>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/(dashboard)/products/page.tsx
git commit -m "feat: replace products page with MFDS direct API search"
```

---

### Task 7: Create /products/my page for saved products CRUD

**Files:**
- Create: `apps/web/src/app/(dashboard)/products/my/page.tsx`

**Step 1: Create the page**

Move existing products CRUD logic into `/products/my`. This page reuses `ProductSearch` and `ProductTable` from `product-list.tsx`:

```tsx
import { getProducts } from "@/lib/queries/products";
import { getHospitals } from "@/lib/queries/hospitals";
import { ProductSearch, ProductTable } from "@/components/product-list";
import { RealtimeListener } from "@/components/realtime-listener";

export default async function MyProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const category = params.category ?? "";
  const pageParam = Number(params.page ?? "1");
  const limit = 25;
  const offset = (pageParam - 1) * limit;

  const [{ products, total }, hospitals] = await Promise.all([
    getProducts({ search, category, limit, offset }).catch(() => ({ products: [], total: 0 })),
    getHospitals().catch(() => []),
  ]);

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">내 품목</h1>
        <p className="text-sm text-muted-foreground mt-1">
          주문에서 선택한 품목을 관리합니다.
        </p>
      </div>
      <ProductSearch search={search} category={category} />
      <ProductTable
        products={products}
        hospitals={hospitals}
        total={total}
        page={pageParam}
        pageSize={limit}
      />
      <RealtimeListener table="products" />
    </>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/(dashboard)/products/my/page.tsx
git commit -m "feat: add /products/my page for saved products CRUD"
```

---

### Task 8: Update sidebar navigation

**Files:**
- Modify: sidebar/navigation component (find the file with "품목" or "products" link)

**Step 1: Find and update navigation**

Search for the sidebar component that links to `/products`. Add a sub-item for `/products/my`:

- `/products` → "품목 검색" (MFDS search)
- `/products/my` → "내 품목" (saved products)

**Step 2: Commit**

```bash
git add <sidebar-file>
git commit -m "feat(nav): add '내 품목' link to sidebar navigation"
```

---

### Task 9: Integrate MFDS search into order creation

**Files:**
- Modify: `apps/web/src/components/order-detail-client.tsx`

**Step 1: Add inline MFDS search for product selection**

In the order detail component, when user clicks "품목 추가" or selects a product for an order item, show the `MfdsSearchPanel` in `mode="pick"`:

```tsx
import { MfdsSearchPanel } from "@/components/mfds-search-panel";

// Inside the component, add state for showing search panel:
const [showMfdsSearch, setShowMfdsSearch] = useState(false);

// When product is selected from MFDS search:
function handleMfdsProductSelect(productId: number) {
  // Add to order items with the selected product ID
  setShowMfdsSearch(false);
  // Refresh products list to include newly added product
  router.refresh();
}

// In the JSX, add a toggle button and the search panel:
{showMfdsSearch && (
  <div className="border rounded-lg p-4 space-y-2">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium">식약처 품목 검색</h3>
      <Button variant="ghost" size="sm" onClick={() => setShowMfdsSearch(false)}>닫기</Button>
    </div>
    <MfdsSearchPanel mode="pick" onSelect={handleMfdsProductSelect} />
  </div>
)}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/order-detail-client.tsx
git commit -m "feat(orders): add inline MFDS search for product selection"
```

---

### Task 10: Clean up Settings page and old components

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx`
- Delete: `apps/web/src/components/mfds-sync-panel.tsx`

**Step 1: Remove MfdsSyncPanel from Settings**

Update `apps/web/src/app/(dashboard)/settings/page.tsx`:

```tsx
import { getSettings } from "@/lib/queries/settings";
import { AISettingsForm } from "@/components/ai-settings";
import { SyncSettingsForm } from "@/components/sync-settings";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">설정</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI 파싱 및 동기화 설정을 관리합니다.
        </p>
      </div>
      <SyncSettingsForm syncInterval={settings.sync_interval_minutes} />
      <AISettingsForm settings={settings} />
    </>
  );
}
```

**Step 2: Delete MfdsSyncPanel component**

```bash
rm -f apps/web/src/components/mfds-sync-panel.tsx
```

**Step 3: Remove any remaining imports of deleted types/functions**

Search across codebase for:
- `MfdsSyncLog`, `MfdsSyncStats`, `MfdsItem`, `MfdsSearchResponse`
- `triggerMfdsSync`, `getMfdsSyncStats`, `getMfdsSyncLogs`, `searchMfdsItems`
- `mfds_item_id`

Remove or update all references.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove MfdsSyncPanel, clean up old MFDS sync references"
```

---

### Task 11: Update ProductFormDialog to remove mfds_item_id

**Files:**
- Modify: `apps/web/src/components/product-list.tsx`

**Step 1: Remove mfds_item_id from ProductFormDialog**

In `product-list.tsx`, find the `ProductFormDialog` component. Remove any reference to `mfds_item_id` in the form data, submit handler, and type definitions. The MFDS search in the dialog (if any) should now use the new `addMfdsItemToProducts` action instead.

**Step 2: Commit**

```bash
git add apps/web/src/components/product-list.tsx
git commit -m "fix: remove mfds_item_id from ProductFormDialog"
```

---

### Task 12: Verify and test

**Step 1: Run TypeScript check**

Run: `cd /mnt/d/Project/09_NotiFlow/apps/web && npx tsc --noEmit`
Expected: No errors

**Step 2: Run dev server**

Run: `cd /mnt/d/Project/09_NotiFlow && npm run dev:web`
Expected: Server starts without errors

**Step 3: Manual verification checklist**

- [ ] `/products` page shows MFDS search with 2 tabs (의약품/의료기기)
- [ ] Search returns results with all columns in horizontal scroll table
- [ ] "추가" button adds item to products table
- [ ] Already added items show "추가됨" badge
- [ ] `/products/my` page shows saved products with full CRUD
- [ ] Settings page no longer shows sync panel
- [ ] Order creation can use inline MFDS search

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: fix any remaining TypeScript errors after MFDS migration"
```

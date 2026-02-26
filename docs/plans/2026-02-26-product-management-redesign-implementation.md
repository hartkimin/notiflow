# Product Management Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the `products` table and management page with MFDS API-aligned `my_drugs`/`my_devices` tables and a unified search+manage UI via MfdsSearchPanel `mode="manage"`.

**Architecture:** Two new tables (my_drugs, my_devices) with columns matching MFDS API 1:1. A `products_catalog` VIEW provides backward compatibility for parse-service and parser. MfdsSearchPanel gains a `mode="manage"` that loads data from DB and shows sync buttons instead of add buttons.

**Tech Stack:** Next.js 16, Supabase PostgreSQL, TanStack React Table, shadcn/ui, Server Actions

---

### Task 1: Database Migration — Create new tables, drop old ones

**Files:**
- Create: `packages/supabase/migrations/00029_my_drugs_devices.sql`

**Step 1: Write the migration SQL**

```sql
-- 00029_my_drugs_devices.sql
-- Replaces: products, product_aliases → my_drugs, my_devices

-- ═══ 1. Create my_drugs (의약품 — 24 API columns + 2 meta) ═══

CREATE TABLE my_drugs (
  id SERIAL PRIMARY KEY,
  item_seq TEXT,
  item_name TEXT,
  item_eng_name TEXT,
  entp_name TEXT,
  entp_no TEXT,
  item_permit_date TEXT,
  cnsgn_manuf TEXT,
  etc_otc_code TEXT,
  chart TEXT,
  bar_code TEXT UNIQUE,
  material_name TEXT,
  ee_doc_id TEXT,
  ud_doc_id TEXT,
  nb_doc_id TEXT,
  storage_method TEXT,
  valid_term TEXT,
  pack_unit TEXT,
  edi_code TEXT,
  permit_kind_name TEXT,
  cancel_date TEXT,
  cancel_name TEXT,
  change_date TEXT,
  atc_code TEXT,
  rare_drug_yn TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ 2. Create my_devices (의료기기 — 20 API columns + 2 meta) ═══

CREATE TABLE my_devices (
  id SERIAL PRIMARY KEY,
  udidi_cd TEXT UNIQUE,
  prdlst_nm TEXT,
  mnft_iprt_entp_nm TEXT,
  mdeq_clsf_no TEXT,
  clsf_no_grad_cd TEXT,
  permit_no TEXT,
  prmsn_ymd TEXT,
  foml_info TEXT,
  prdt_nm_info TEXT,
  hmbd_trspt_mdeq_yn TEXT,
  dspsbl_mdeq_yn TEXT,
  trck_mng_trgt_yn TEXT,
  total_dev TEXT,
  cmbnmd_yn TEXT,
  use_before_strlzt_need_yn TEXT,
  sterilization_method_nm TEXT,
  use_purps_cont TEXT,
  strg_cnd_info TEXT,
  circ_cnd_info TEXT,
  rcprslry_trgt_yn TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ 3. Backward-compat VIEW for parse-service / parser ═══
-- matchProductsBulk queries: id, name, official_name, short_name, is_active
-- parse-service queries: official_name, short_name, is_active

CREATE VIEW products_catalog AS
  SELECT
    id,
    item_name AS name,
    item_name AS official_name,
    NULL::TEXT AS short_name,
    TRUE AS is_active,
    bar_code AS standard_code,
    'drug' AS source_type
  FROM my_drugs
UNION ALL
  SELECT
    1000000 + id,
    prdlst_nm AS name,
    prdlst_nm AS official_name,
    NULL::TEXT AS short_name,
    TRUE AS is_active,
    udidi_cd AS standard_code,
    'device_std' AS source_type
  FROM my_devices;

-- ═══ 4. Drop old tables ═══

DROP TABLE IF EXISTS product_aliases CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- ═══ 5. Enable RLS ═══

ALTER TABLE my_drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_my_drugs" ON my_drugs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_all_my_drugs" ON my_drugs FOR ALL TO authenticated USING (true);
CREATE POLICY "anon_read_my_devices" ON my_devices FOR SELECT TO anon USING (true);
CREATE POLICY "anon_all_my_devices" ON my_devices FOR ALL TO authenticated USING (true);
```

**Step 2: Apply migration locally**

Run: `cd /mnt/d/Project/09_NotiFlow && npx supabase db push --linked`
Expected: Migration applied, tables created

**Step 3: Commit**

```bash
git add packages/supabase/migrations/00029_my_drugs_devices.sql
git commit -m "feat(db): create my_drugs/my_devices tables, products_catalog view, drop products"
```

---

### Task 2: Types — Add MyDrug, MyDevice, SyncDiff types

**Files:**
- Modify: `apps/web/src/lib/types.ts` (lines ~117-165)

**Step 1: Add new types and remove old Product/ProductAlias types**

Replace the `Product` interface (lines 117-132) and `ProductAlias` interface (lines 159-165) with:

```typescript
// --- My Products (MFDS-aligned) ---

export interface MyDrug {
  id: number;
  item_seq: string | null;
  item_name: string | null;
  item_eng_name: string | null;
  entp_name: string | null;
  entp_no: string | null;
  item_permit_date: string | null;
  cnsgn_manuf: string | null;
  etc_otc_code: string | null;
  chart: string | null;
  bar_code: string | null;
  material_name: string | null;
  ee_doc_id: string | null;
  ud_doc_id: string | null;
  nb_doc_id: string | null;
  storage_method: string | null;
  valid_term: string | null;
  pack_unit: string | null;
  edi_code: string | null;
  permit_kind_name: string | null;
  cancel_date: string | null;
  cancel_name: string | null;
  change_date: string | null;
  atc_code: string | null;
  rare_drug_yn: string | null;
  added_at: string;
  synced_at: string;
}

export interface MyDevice {
  id: number;
  udidi_cd: string | null;
  prdlst_nm: string | null;
  mnft_iprt_entp_nm: string | null;
  mdeq_clsf_no: string | null;
  clsf_no_grad_cd: string | null;
  permit_no: string | null;
  prmsn_ymd: string | null;
  foml_info: string | null;
  prdt_nm_info: string | null;
  hmbd_trspt_mdeq_yn: string | null;
  dspsbl_mdeq_yn: string | null;
  trck_mng_trgt_yn: string | null;
  total_dev: string | null;
  cmbnmd_yn: string | null;
  use_before_strlzt_need_yn: string | null;
  sterilization_method_nm: string | null;
  use_purps_cont: string | null;
  strg_cnd_info: string | null;
  circ_cnd_info: string | null;
  rcprslry_trgt_yn: string | null;
  added_at: string;
  synced_at: string;
}

/** Diff entry returned by sync operations */
export interface SyncDiffEntry {
  column: string;
  label: string;
  oldValue: string;
  newValue: string;
}

/** Backward-compat type for parse-service (reads from products_catalog VIEW) */
export interface ProductCatalogRow {
  id: number;
  name: string;
  official_name: string;
  short_name: string | null;
  is_active: boolean;
  standard_code: string | null;
  source_type: string;
}
```

Also keep the old `Product` type but rename it as a deprecated alias or remove it entirely. Check all consumers first (done in later tasks).

**Step 2: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat(types): add MyDrug, MyDevice, SyncDiffEntry types, remove Product"
```

---

### Task 3: Server Actions — Replace product CRUD with my_drugs/my_devices actions

**Files:**
- Modify: `apps/web/src/lib/actions.ts` (lines 1-60, 106-155, 694-744)

**Step 1: Replace product CRUD actions (lines 10-58) with new actions**

Remove these functions:
- `createProduct` (line 12)
- `updateProduct` (line 36)
- `deleteProduct` (line 44)
- `deleteProducts` (line 52)
- `getProductAliases` (line 108)
- `createProductAlias` (line 119)
- `updateProductAlias` (line 132)
- `deleteProductAlias` (line 146)
- `addMfdsItemToProducts` (line 694)

Add these new functions:

```typescript
// --- My Drugs ---

export async function addToMyDrugs(item: Record<string, unknown>) {
  const supabase = await createClient();
  const barCode = (item.BAR_CODE as string) ?? null;

  if (barCode) {
    const { data: existing } = await supabase
      .from("my_drugs")
      .select("id")
      .eq("bar_code", barCode)
      .maybeSingle();
    if (existing) return { success: true, id: existing.id, alreadyExists: true };
  }

  const row: Record<string, unknown> = {};
  const drugKeys = [
    "ITEM_SEQ", "ITEM_NAME", "ITEM_ENG_NAME", "ENTP_NAME", "ENTP_NO",
    "ITEM_PERMIT_DATE", "CNSGN_MANUF", "ETC_OTC_CODE", "CHART", "BAR_CODE",
    "MATERIAL_NAME", "EE_DOC_ID", "UD_DOC_ID", "NB_DOC_ID", "STORAGE_METHOD",
    "VALID_TERM", "PACK_UNIT", "EDI_CODE", "PERMIT_KIND_NAME", "CANCEL_DATE",
    "CANCEL_NAME", "CHANGE_DATE", "ATC_CODE", "RARE_DRUG_YN",
  ];
  for (const key of drugKeys) {
    row[key.toLowerCase()] = (item[key] as string) ?? null;
  }

  const { data, error } = await supabase
    .from("my_drugs")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/products");
  return { success: true, id: data.id, alreadyExists: false };
}

export async function addToMyDevices(item: Record<string, unknown>) {
  const supabase = await createClient();
  const udidiCd = (item.UDIDI_CD as string) ?? null;

  if (udidiCd) {
    const { data: existing } = await supabase
      .from("my_devices")
      .select("id")
      .eq("udidi_cd", udidiCd)
      .maybeSingle();
    if (existing) return { success: true, id: existing.id, alreadyExists: true };
  }

  const row: Record<string, unknown> = {};
  const deviceKeys = [
    "UDIDI_CD", "PRDLST_NM", "MNFT_IPRT_ENTP_NM", "MDEQ_CLSF_NO",
    "CLSF_NO_GRAD_CD", "PERMIT_NO", "PRMSN_YMD", "FOML_INFO", "PRDT_NM_INFO",
    "HMBD_TRSPT_MDEQ_YN", "DSPSBL_MDEQ_YN", "TRCK_MNG_TRGT_YN", "TOTAL_DEV",
    "CMBNMD_YN", "USE_BEFORE_STRLZT_NEED_YN", "STERILIZATION_METHOD_NM",
    "USE_PURPS_CONT", "STRG_CND_INFO", "CIRC_CND_INFO", "RCPRSLRY_TRGT_YN",
  ];
  for (const key of deviceKeys) {
    row[key.toLowerCase()] = (item[key] as string) ?? null;
  }

  const { data, error } = await supabase
    .from("my_devices")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/products");
  return { success: true, id: data.id, alreadyExists: false };
}

export async function getMyDrugs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_drugs")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMyDevices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_devices")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteMyDrug(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("my_drugs").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}

export async function deleteMyDevice(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("my_devices").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}

// --- Sync ---

const DRUG_API_KEYS = [
  "ITEM_SEQ", "ITEM_NAME", "ITEM_ENG_NAME", "ENTP_NAME", "ENTP_NO",
  "ITEM_PERMIT_DATE", "CNSGN_MANUF", "ETC_OTC_CODE", "CHART", "BAR_CODE",
  "MATERIAL_NAME", "EE_DOC_ID", "UD_DOC_ID", "NB_DOC_ID", "STORAGE_METHOD",
  "VALID_TERM", "PACK_UNIT", "EDI_CODE", "PERMIT_KIND_NAME", "CANCEL_DATE",
  "CANCEL_NAME", "CHANGE_DATE", "ATC_CODE", "RARE_DRUG_YN",
];

const DEVICE_API_KEYS = [
  "UDIDI_CD", "PRDLST_NM", "MNFT_IPRT_ENTP_NM", "MDEQ_CLSF_NO",
  "CLSF_NO_GRAD_CD", "PERMIT_NO", "PRMSN_YMD", "FOML_INFO", "PRDT_NM_INFO",
  "HMBD_TRSPT_MDEQ_YN", "DSPSBL_MDEQ_YN", "TRCK_MNG_TRGT_YN", "TOTAL_DEV",
  "CMBNMD_YN", "USE_BEFORE_STRLZT_NEED_YN", "STERILIZATION_METHOD_NM",
  "USE_PURPS_CONT", "STRG_CND_INFO", "CIRC_CND_INFO", "RCPRSLRY_TRGT_YN",
];

/** Column label lookup (Korean names) for diff display */
const DRUG_LABELS: Record<string, string> = {
  item_seq: "품목기준코드", item_name: "품목명", item_eng_name: "영문명",
  entp_name: "업체명", entp_no: "업체허가번호", item_permit_date: "허가일자",
  cnsgn_manuf: "위탁제조업체", etc_otc_code: "전문/일반", chart: "성상",
  bar_code: "표준코드", material_name: "성분", ee_doc_id: "효능효과",
  ud_doc_id: "용법용량", nb_doc_id: "주의사항", storage_method: "저장방법",
  valid_term: "유효기간", pack_unit: "포장단위", edi_code: "보험코드",
  permit_kind_name: "허가구분", cancel_date: "취소일자", cancel_name: "상태",
  change_date: "변경일자", atc_code: "ATC코드", rare_drug_yn: "희귀의약품",
};

const DEVICE_LABELS: Record<string, string> = {
  udidi_cd: "UDI-DI코드", prdlst_nm: "품목명", mnft_iprt_entp_nm: "제조수입업체명",
  mdeq_clsf_no: "분류번호", clsf_no_grad_cd: "등급", permit_no: "품목허가번호",
  prmsn_ymd: "허가일자", foml_info: "모델명", prdt_nm_info: "제품명",
  hmbd_trspt_mdeq_yn: "인체이식형여부", dspsbl_mdeq_yn: "일회용여부",
  trck_mng_trgt_yn: "추적관리대상", total_dev: "한벌구성여부",
  cmbnmd_yn: "조합의료기기", use_before_strlzt_need_yn: "사전멸균필요",
  sterilization_method_nm: "멸균방법", use_purps_cont: "사용목적",
  strg_cnd_info: "저장조건", circ_cnd_info: "유통취급조건",
  rcprslry_trgt_yn: "요양급여대상",
};

export async function syncMyDrug(id: number) {
  const supabase = await createClient();

  const { data: drug, error } = await supabase
    .from("my_drugs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  // Search API by bar_code
  const apiResult = await searchMfdsDrug({ BAR_CODE: drug.bar_code ?? "" });
  if (apiResult.items.length === 0) {
    return { found: false, changes: [] as SyncDiffEntry[] };
  }

  const apiItem = apiResult.items[0] as Record<string, unknown>;
  const changes: SyncDiffEntry[] = [];

  for (const apiKey of DRUG_API_KEYS) {
    const dbKey = apiKey.toLowerCase();
    const oldVal = (drug[dbKey] as string) ?? "";
    const newVal = ((apiItem[apiKey] as string) ?? "");
    if (oldVal !== newVal) {
      changes.push({
        column: dbKey,
        label: DRUG_LABELS[dbKey] ?? dbKey,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  // Update synced_at even if no changes
  await supabase.from("my_drugs").update({ synced_at: new Date().toISOString() }).eq("id", id);

  return { found: true, changes };
}

export async function syncMyDevice(id: number) {
  const supabase = await createClient();

  const { data: device, error } = await supabase
    .from("my_devices")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  const apiResult = await searchMfdsDevice({ UDIDI_CD: device.udidi_cd ?? "" });
  if (apiResult.items.length === 0) {
    return { found: false, changes: [] as SyncDiffEntry[] };
  }

  const apiItem = apiResult.items[0] as Record<string, unknown>;
  const changes: SyncDiffEntry[] = [];

  for (const apiKey of DEVICE_API_KEYS) {
    const dbKey = apiKey.toLowerCase();
    const oldVal = (device[dbKey] as string) ?? "";
    const newVal = ((apiItem[apiKey] as string) ?? "");
    if (oldVal !== newVal) {
      changes.push({
        column: dbKey,
        label: DEVICE_LABELS[dbKey] ?? dbKey,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  await supabase.from("my_devices").update({ synced_at: new Date().toISOString() }).eq("id", id);

  return { found: true, changes };
}

export async function applyDrugSync(id: number, updates: Record<string, string>) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("my_drugs")
    .update({ ...updates, synced_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}

export async function applyDeviceSync(id: number, updates: Record<string, string>) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("my_devices")
    .update({ ...updates, synced_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}
```

Import `SyncDiffEntry` from types at the top of the file.

**Step 2: Remove old Product type import**

Remove `import type { ProductAlias } from "@/lib/types"` at line 5 (no longer needed).

**Step 3: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "feat(actions): replace product CRUD with my_drugs/my_devices + sync actions"
```

---

### Task 4: Update queries — Replace getProducts with getMyProducts

**Files:**
- Modify: `apps/web/src/lib/queries/products.ts`

**Step 1: Rewrite queries/products.ts**

Replace entire file:

```typescript
import { createClient } from "@/lib/supabase/server";
import type { MyDrug, MyDevice } from "@/lib/types";

export async function getMyDrugs(): Promise<MyDrug[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_drugs")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MyDrug[];
}

export async function getMyDevices(): Promise<MyDevice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_devices")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MyDevice[];
}

/** Get all standard codes (for checking duplicates in search) */
export async function getExistingStandardCodes(): Promise<string[]> {
  const supabase = await createClient();
  const [{ data: drugs }, { data: devices }] = await Promise.all([
    supabase.from("my_drugs").select("bar_code"),
    supabase.from("my_devices").select("udidi_cd"),
  ]);
  const codes: string[] = [];
  for (const d of drugs ?? []) if (d.bar_code) codes.push(d.bar_code);
  for (const d of devices ?? []) if (d.udidi_cd) codes.push(d.udidi_cd);
  return codes;
}

/** Backward-compat for parse-service: query products_catalog VIEW */
export async function getProductsCatalog() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products_catalog")
    .select("id, name, official_name, short_name, is_active, standard_code");
  if (error) throw error;
  return data ?? [];
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/queries/products.ts
git commit -m "feat(queries): replace getProducts with getMyDrugs/getMyDevices/getExistingStandardCodes"
```

---

### Task 5: Update MfdsSearchPanel — Add mode="manage" support

**Files:**
- Modify: `apps/web/src/components/mfds-search-panel.tsx`

**Step 1: Update props interface (line 32)**

```typescript
interface MfdsSearchPanelProps {
  mode: "browse" | "pick" | "manage";
  onSelect?: (productId: number) => void;
  existingStandardCodes?: string[];
  /** Pre-loaded data for manage mode */
  myDrugs?: Record<string, unknown>[];
  myDevices?: Record<string, unknown>[];
}
```

**Step 2: Update import — add new server actions (line 17-21)**

```typescript
import {
  searchMfdsDrug,
  searchMfdsDevice,
  addToMyDrugs,
  addToMyDevices,
  syncMyDrug,
  syncMyDevice,
  applyDrugSync,
  applyDeviceSync,
  deleteMyDrug,
  deleteMyDevice,
} from "@/lib/actions";
```

Add import for SyncDiffEntry:
```typescript
import type { MfdsApiSource, SyncDiffEntry } from "@/lib/types";
```

Add new icon imports:
```typescript
import { Plus, Loader2, Check, ChevronDown, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
```

Add Dialog import:
```typescript
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
```

**Step 3: Add manage-mode state (after line 78)**

```typescript
// Sync state (manage mode only)
const [syncingId, setSyncingId] = useState<number | null>(null);
const [syncDiff, setSyncDiff] = useState<{ id: number; changes: SyncDiffEntry[] } | null>(null);
const [deletingId, setDeletingId] = useState<number | null>(null);
```

**Step 4: Update data loading for manage mode**

In manage mode, data comes from props (myDrugs/myDevices) instead of API search. Add after the initialLoaded useEffect (line 289):

```typescript
// ── Manage mode: load data from DB props ──────────────────────────
useEffect(() => {
  if (mode !== "manage") return;
  const data = tab === "drug" ? (myDrugs ?? []) : (myDevices ?? []);
  setResults(data);
  setTotalCount(data.length);
  setHasSearched(true);
}, [mode, tab, myDrugs, myDevices]);
```

**Step 5: Update action column in column definitions (line 101-136)**

Replace the actionCol definition to handle all three modes:

```typescript
const actionCol: ColumnDef<Record<string, unknown>> = {
  id: "_action",
  header: mode === "manage" ? "동기화" : mode === "browse" ? "추가" : "선택",
  size: mode === "manage" ? 110 : 70,
  enableResizing: false,
  enableSorting: false,
  enableGlobalFilter: false,
  cell: ({ row }) => {
    const item = row.original;

    if (mode === "manage") {
      const itemId = item.id as number;
      const isSyncing = syncingId === itemId;
      return (
        <div className="flex gap-1">
          <Button
            size="xs"
            variant="outline"
            disabled={isSyncing}
            onClick={(e) => { e.stopPropagation(); handleSync(item); }}
          >
            {isSyncing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={deletingId === itemId}
            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    // Browse / pick mode (existing logic)
    const code = ((tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string) ?? "";
    const alreadyAdded = existingStandardCodes.includes(code);

    if (alreadyAdded) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="h-3 w-3" /> 추가됨
        </span>
      );
    }
    return (
      <Button
        size="xs"
        variant="outline"
        disabled={isPending && addingId === code}
        onClick={() => handleAdd(item)}
      >
        {isPending && addingId === code ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Plus className="h-3 w-3" />
        )}
      </Button>
    );
  },
};
```

**Step 6: Update column accessorFn for manage mode**

In manage mode, DB columns are lowercase. Update the `col` helper (line 138):

```typescript
const col = (id: string, header: string, size = 120): ColumnDef<Record<string, unknown>> => ({
  id,
  accessorFn: (r) => {
    // manage mode uses lowercase DB columns, browse/pick uses uppercase API columns
    const key = mode === "manage" ? id.toLowerCase() : id;
    return (r[key] as string) ?? "";
  },
  header,
  size,
  minSize: 60,
  enableResizing: true,
});
```

**Step 7: Update handleAdd to use new actions (line 293)**

```typescript
function handleAdd(item: Record<string, unknown>) {
  const code = ((tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string) ?? "";
  setAddingId(code);
  startTransition(async () => {
    try {
      const result = tab === "drug"
        ? await addToMyDrugs(item)
        : await addToMyDevices(item);
      if (result.alreadyExists) {
        toast.info("이미 내 품목에 등록된 항목입니다.");
      } else {
        toast.success("내 품목에 추가되었습니다.", {
          action: {
            label: "내 품목 보기 →",
            onClick: () => router.push("/products/my"),
          },
        });
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
```

**Step 8: Add handleSync and handleDelete functions (after handleAdd)**

```typescript
function handleSync(item: Record<string, unknown>) {
  const itemId = item.id as number;
  setSyncingId(itemId);
  startTransition(async () => {
    try {
      const result = tab === "drug"
        ? await syncMyDrug(itemId)
        : await syncMyDevice(itemId);

      if (!result.found) {
        toast.error("식약처 API에서 해당 품목을 찾을 수 없습니다.");
        return;
      }

      if (result.changes.length === 0) {
        toast.success("최신 상태입니다.");
      } else {
        setSyncDiff({ id: itemId, changes: result.changes });
      }
    } catch (err) {
      toast.error(`동기화 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    } finally {
      setSyncingId(null);
    }
  });
}

function handleApplySync() {
  if (!syncDiff) return;
  startTransition(async () => {
    try {
      const updates: Record<string, string> = {};
      for (const c of syncDiff.changes) {
        updates[c.column] = c.newValue;
      }
      if (tab === "drug") {
        await applyDrugSync(syncDiff.id, updates);
      } else {
        await applyDeviceSync(syncDiff.id, updates);
      }
      toast.success("변경사항이 적용되었습니다.");
      setSyncDiff(null);
      router.refresh();
    } catch (err) {
      toast.error(`적용 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    }
  });
}

function handleDelete(item: Record<string, unknown>) {
  const itemId = item.id as number;
  const name = tab === "drug"
    ? (item.item_name as string) ?? ""
    : (item.prdlst_nm as string) ?? "";

  if (!confirm(`"${name}" 항목을 삭제하시겠습니까?`)) return;

  setDeletingId(itemId);
  startTransition(async () => {
    try {
      if (tab === "drug") {
        await deleteMyDrug(itemId);
      } else {
        await deleteMyDevice(itemId);
      }
      toast.success("삭제되었습니다.");
      router.refresh();
    } catch (err) {
      toast.error(`삭제 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    } finally {
      setDeletingId(null);
    }
  });
}
```

**Step 9: Add Sync Diff Dialog in render (before closing `</div>`, line ~418)**

```tsx
{/* Sync diff dialog */}
{syncDiff && (
  <Dialog open onOpenChange={() => setSyncDiff(null)}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>품목 변경사항 확인</DialogTitle>
      </DialogHeader>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-3 font-medium">항목</th>
              <th className="py-2 pr-3 font-medium">현재값</th>
              <th className="py-2 font-medium">새 값</th>
            </tr>
          </thead>
          <tbody>
            {syncDiff.changes.map((c) => (
              <tr key={c.column} className="border-b">
                <td className="py-2 pr-3 text-muted-foreground">{c.label}</td>
                <td className="py-2 pr-3 line-through text-red-500 break-all">
                  {c.oldValue || "(비어있음)"}
                </td>
                <td className="py-2 text-green-600 break-all">
                  {c.newValue || "(비어있음)"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setSyncDiff(null)}>
          취소
        </Button>
        <Button onClick={handleApplySync} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          적용
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)}
```

**Step 10: Disable search bar in manage mode (or switch to client filter)**

In manage mode, the search bar should filter DB data locally instead of calling API. Update the `doSearch` function: only call API in browse/pick mode. In manage mode, just update globalFilter.

In the MfdsSearchBar `onSearch` prop (line 372):
```typescript
onSearch={() => {
  if (mode === "manage") {
    // In manage mode, search = client-side filter
    setGlobalFilter(query);
  } else {
    doSearch(1);
  }
}}
```

**Step 11: Commit**

```bash
git add apps/web/src/components/mfds-search-panel.tsx
git commit -m "feat(mfds): add mode=manage with sync/delete actions and diff dialog"
```

---

### Task 6: Update Pages

**Files:**
- Modify: `apps/web/src/app/(dashboard)/products/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/products/my/page.tsx`

**Step 1: Update /products page (search)**

```typescript
import { getExistingStandardCodes } from "@/lib/queries/products";
import { MfdsSearchPanel } from "@/components/mfds-search-panel";

export default async function ProductsPage() {
  const existingCodes = await getExistingStandardCodes();

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">품목 검색</h1>
        <p className="text-sm text-muted-foreground mt-1">
          식약처 API에서 의약품/의료기기를 검색하고 내 품목에 추가합니다.
        </p>
      </div>
      <MfdsSearchPanel mode="browse" existingStandardCodes={existingCodes} />
    </>
  );
}
```

**Step 2: Update /products/my page (manage)**

```typescript
import { getMyDrugs, getMyDevices } from "@/lib/queries/products";
import { MfdsSearchPanel } from "@/components/mfds-search-panel";

export default async function MyProductsPage() {
  const [drugs, devices] = await Promise.all([
    getMyDrugs().catch(() => []),
    getMyDevices().catch(() => []),
  ]);

  // Convert to Record<string, unknown>[] for MfdsSearchPanel
  // and add uppercase keys for column compatibility
  const mapToUpperCase = (items: Record<string, unknown>[], keys: string[]) =>
    items.map((item) => {
      const mapped = { ...item };
      for (const key of keys) {
        mapped[key.toUpperCase()] = item[key];
      }
      return mapped;
    });

  const drugKeys = [
    "item_seq", "item_name", "item_eng_name", "entp_name", "entp_no",
    "item_permit_date", "cnsgn_manuf", "etc_otc_code", "chart", "bar_code",
    "material_name", "ee_doc_id", "ud_doc_id", "nb_doc_id", "storage_method",
    "valid_term", "pack_unit", "edi_code", "permit_kind_name", "cancel_date",
    "cancel_name", "change_date", "atc_code", "rare_drug_yn",
  ];

  const deviceKeys = [
    "udidi_cd", "prdlst_nm", "mnft_iprt_entp_nm", "mdeq_clsf_no",
    "clsf_no_grad_cd", "permit_no", "prmsn_ymd", "foml_info", "prdt_nm_info",
    "hmbd_trspt_mdeq_yn", "dspsbl_mdeq_yn", "trck_mng_trgt_yn", "total_dev",
    "cmbnmd_yn", "use_before_strlzt_need_yn", "sterilization_method_nm",
    "use_purps_cont", "strg_cnd_info", "circ_cnd_info", "rcprslry_trgt_yn",
  ];

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">내 품목</h1>
        <p className="text-sm text-muted-foreground mt-1">
          등록된 품목을 관리하고 식약처 API와 동기화합니다.
        </p>
      </div>
      <MfdsSearchPanel
        mode="manage"
        myDrugs={mapToUpperCase(drugs as Record<string, unknown>[], drugKeys)}
        myDevices={mapToUpperCase(devices as Record<string, unknown>[], deviceKeys)}
      />
    </>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/products/page.tsx apps/web/src/app/(dashboard)/products/my/page.tsx
git commit -m "feat(pages): update products pages for new my_drugs/my_devices schema"
```

---

### Task 7: Update Parse Service — Use products_catalog VIEW

**Files:**
- Modify: `apps/web/src/lib/parse-service.ts` (lines ~300-310)
- Modify: `apps/web/src/lib/actions.ts` (lines ~278-288)
- Modify: `apps/web/src/lib/parser.ts` (lines ~378-382)
- Modify: `apps/web/src/app/api/test-parse/route.ts`
- Modify: `apps/web/src/app/api/parse/route.ts`

**Step 1: Update parse-service.ts**

Change `from("products")` to `from("products_catalog")` at line ~301:

```typescript
const { data: productRows } = await supabase
  .from("products_catalog")
  .select("official_name, short_name")
  .eq("is_active", true);
```

**Step 2: Update actions.ts parse section**

Change `from("products")` to `from("products_catalog")` at line ~279:

```typescript
const { data: productRows } = await supabase
  .from("products_catalog")
  .select("official_name, short_name")
  .eq("is_active", true);
```

**Step 3: Update parser.ts matchProductsBulk**

Change `from("products")` to `from("products_catalog")` at line ~379:

```typescript
const { data: products } = await supabase
  .from("products_catalog")
  .select("id, name, official_name, short_name")
  .eq("is_active", true);
```

Remove the product_aliases query (lines 383-393) since aliases no longer exist. Also remove all alias-related matching logic (hospitalAliasMap, globalAliasMap). The matching will work on product names only.

**Step 4: Update test-parse/route.ts**

Change `from("products")` to `from("products_catalog")`.

**Step 5: Update parse/route.ts**

Change `from("products")` to `from("products_catalog")`.

**Step 6: Commit**

```bash
git add apps/web/src/lib/parse-service.ts apps/web/src/lib/actions.ts apps/web/src/lib/parser.ts apps/web/src/app/api/test-parse/route.ts apps/web/src/app/api/parse/route.ts
git commit -m "refactor(parse): use products_catalog view instead of products table"
```

---

### Task 8: Update Consumers — Orders, Messages, Forecasts

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/orders/[id]/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/messages/page.tsx`
- Modify: `apps/web/src/components/forecast-dialog.tsx`
- Modify: `apps/web/src/components/forecast-batch-dialog.tsx`
- Modify: `apps/web/src/components/manual-parse-form.tsx`

**Step 1: Update orders/page.tsx**

Replace `getProducts` import with `getProductsCatalog`:

```typescript
import { getProductsCatalog } from "@/lib/queries/products";
```

Replace `getProducts(...)` call with `getProductsCatalog()`. Map results to whatever the order page needs (likely `{ id, name, official_name }`). The VIEW provides these fields.

**Step 2: Update orders/[id]/page.tsx, messages/page.tsx similarly**

Same pattern: replace `getProducts` → `getProductsCatalog`.

**Step 3: Update forecast-dialog.tsx and forecast-batch-dialog.tsx**

Replace `Product` type import with `ProductCatalogRow`:

```typescript
import type { ProductCatalogRow } from "@/lib/types";
```

Update props that accept `Product[]` to accept `ProductCatalogRow[]`.

**Step 4: Update manual-parse-form.tsx**

Remove `ProductFormDialog` import (line 26). Replace `Product` type with `ProductCatalogRow`. Remove any product creation dialog usage.

**Step 5: Commit**

```bash
git add apps/web/src/app/(dashboard)/orders/ apps/web/src/app/(dashboard)/messages/ apps/web/src/components/forecast-dialog.tsx apps/web/src/components/forecast-batch-dialog.tsx apps/web/src/components/manual-parse-form.tsx
git commit -m "refactor(consumers): migrate from Product to ProductCatalogRow across orders, messages, forecasts"
```

---

### Task 9: Cleanup — Remove dead code

**Files:**
- Delete: `apps/web/src/components/product-list.tsx` (762 lines — no longer needed)
- Modify: `apps/web/src/components/realtime-listener.tsx` (remove "products" table reference if applicable)
- Remove unused imports throughout

**Step 1: Delete product-list.tsx**

```bash
rm apps/web/src/components/product-list.tsx
```

**Step 2: Search for any remaining references**

Run: `grep -rn "product-list\|ProductTable\|ProductSearch\|ProductFormDialog\|addMfdsItemToProducts\|getProducts\b" apps/web/src/`

Fix any remaining references.

**Step 3: Remove unused imports in actions.ts**

Remove `import type { ProductAlias } from "@/lib/types"` if still present.
Remove `matchProductsBulk, type ProductCatalogEntry` import from `@/lib/parser` if the parse actions now handle this differently.

**Step 4: Verify build**

Run: `cd /mnt/d/Project/09_NotiFlow/apps/web && npm run build`
Expected: Clean build with no errors

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove dead product-list component and unused imports"
```

---

### Task 10: Verify and Test

**Step 1: Start dev server**

Run: `cd /mnt/d/Project/09_NotiFlow && npm run dev:web`

**Step 2: Test /products page**

1. Navigate to `/products`
2. Search for "아스피린" in drug tab
3. Click "추가" button → should insert into `my_drugs`
4. Switch to device tab, search "혈액투석기"
5. Click "추가" → should insert into `my_devices`
6. Verify "추가됨" badge shows for already-added items

**Step 3: Test /products/my page**

1. Navigate to `/products/my`
2. Drug tab should show items added in step 2
3. Click "동기화" button on an item
4. If no changes: toast "최신 상태입니다"
5. If changes: diff dialog shows with old/new values
6. Click "적용" → changes saved
7. Click delete button → confirm → item removed
8. Switch to device tab → verify same functionality

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete product management redesign with MFDS-aligned tables and sync"
```

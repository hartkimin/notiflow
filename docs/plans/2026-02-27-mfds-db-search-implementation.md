# MFDS DB Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace direct MFDS API search with Supabase DB-backed search using pg_trgm indexes, UPSERT sync, and unified debounce search bar.

**Architecture:** Revive `mfds_items` table with JSONB `raw_data` column for full API response preservation. Search queries hit Supabase with pg_trgm ILIKE instead of Korean gov API. Edge Function `sync-mfds` performs caller-driven UPSERT chunking. UI removes globalFilter in favor of debounced server-side search.

**Tech Stack:** Supabase (PostgreSQL + pg_trgm), Next.js Server Actions, TanStack React Table, Deno Edge Functions

---

### Task 1: Create migration — mfds_items and mfds_sync_logs tables

**Files:**
- Create: `packages/supabase/migrations/00034_mfds_db_search.sql`

**Step 1: Write the migration SQL**

```sql
-- 00034_mfds_db_search.sql
-- Revive mfds_items table for DB-backed search with pg_trgm

-- 1. Ensure pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Main search table
CREATE TABLE IF NOT EXISTS mfds_items (
  id              BIGSERIAL PRIMARY KEY,
  source_type     TEXT NOT NULL,         -- 'drug' | 'device_std'
  source_key      TEXT NOT NULL,         -- ITEM_SEQ or UDIDI_CD
  item_name       TEXT NOT NULL,         -- 품목명 (normalized for search)
  manufacturer    TEXT,                  -- 업체명 (normalized for search)
  standard_code   TEXT,                  -- BAR_CODE or UDIDI_CD
  permit_date     TEXT,                  -- 허가일자
  raw_data        JSONB NOT NULL,        -- Full API response preserved
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_type, source_key)
);

-- 3. Indexes for search
CREATE INDEX IF NOT EXISTS idx_mfds_items_name_trgm
  ON mfds_items USING gin (item_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mfds_items_mfr_trgm
  ON mfds_items USING gin (manufacturer gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mfds_items_source_type
  ON mfds_items (source_type);
CREATE INDEX IF NOT EXISTS idx_mfds_items_standard_code
  ON mfds_items (standard_code) WHERE standard_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mfds_items_raw_data
  ON mfds_items USING gin (raw_data jsonb_path_ops);

-- 4. Auto-update updated_at trigger
CREATE TRIGGER update_mfds_items_updated_at
  BEFORE UPDATE ON mfds_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Sync logs table
CREATE TABLE IF NOT EXISTS mfds_sync_logs (
  id              BIGSERIAL PRIMARY KEY,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'running',  -- running | completed | error
  trigger_type    TEXT NOT NULL,                     -- 'cron' | 'manual'
  source_type     TEXT,                              -- 'drug' | 'device_std' | null (all)
  total_fetched   INT NOT NULL DEFAULT 0,
  total_upserted  INT NOT NULL DEFAULT 0,
  error_message   TEXT,
  duration_ms     INT
);

-- 6. RLS policies
ALTER TABLE mfds_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select mfds_items"
  ON mfds_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage mfds_items"
  ON mfds_items FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE mfds_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can select mfds_sync_logs"
  ON mfds_sync_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage mfds_sync_logs"
  ON mfds_sync_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
```

**Step 2: Apply migration to remote Supabase**

Run: `cd packages/supabase && supabase db push`
Expected: Migration applied successfully. Tables `mfds_items` and `mfds_sync_logs` created.

**Step 3: Verify tables exist**

Run: `cd packages/supabase && supabase db dump --schema public | grep mfds_items`
Expected: Table definition appears in output.

**Step 4: Commit**

```bash
git add packages/supabase/migrations/00034_mfds_db_search.sql
git commit -m "feat: add mfds_items and mfds_sync_logs tables for DB search"
```

---

### Task 2: Create sync-mfds Edge Function

**Files:**
- Create: `packages/supabase/functions/sync-mfds/index.ts`

**Step 1: Write the Edge Function**

```typescript
// packages/supabase/functions/sync-mfds/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100; // Korean gov API max 500, use 100 for memory safety
const MAX_PAGES = 20; // 2,000 items per invocation

interface ApiConfig {
  url: string;
  sourceKeyField: string;
  itemNameField: string;
  manufacturerField: string;
  standardCodeField: string;
  permitDateField: string;
}

const API_CONFIGS: Record<string, ApiConfig> = {
  drug: {
    url: "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06",
    sourceKeyField: "ITEM_SEQ",
    itemNameField: "ITEM_NAME",
    manufacturerField: "ENTP_NAME",
    standardCodeField: "BAR_CODE",
    permitDateField: "ITEM_PERMIT_DATE",
  },
  device_std: {
    url: "https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03/getMdeqStdCdPrdtInfoInq03",
    sourceKeyField: "UDIDI_CD",
    itemNameField: "PRDLST_NM",
    manufacturerField: "MNFT_IPRT_ENTP_NM",
    standardCodeField: "UDIDI_CD",
    permitDateField: "PRMSN_YMD",
  },
};

function parseMfdsApiItems(
  body: Record<string, unknown>,
): Record<string, unknown>[] {
  if (!body) return [];
  const items = body.items;
  if (!items) return [];
  if (Array.isArray(items))
    return items as Record<string, unknown>[];
  const obj = items as Record<string, unknown>;
  const item = obj.item;
  if (!item) return [];
  if (Array.isArray(item))
    return item as Record<string, unknown>[];
  return [item as Record<string, unknown>];
}

async function fetchPage(
  config: ApiConfig,
  apiKey: string,
  page: number,
): Promise<{ items: Record<string, unknown>[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: String(page),
    numOfRows: String(PAGE_SIZE),
    type: "json",
  });

  const res = await fetch(`${config.url}?${params}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const body = json?.body;

  return {
    items: parseMfdsApiItems(body),
    totalCount: (body?.totalCount as number) ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Verify caller identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Missing Authorization header", 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return errorResponse("Invalid or expired token", 401);
    }

    // 2. Parse request
    const body = await req.json();
    const sourceType: string = body.sourceType; // 'drug' | 'device_std'
    const startPage: number = body.page ?? 1;
    const apiKey: string = body.apiKey;

    if (!sourceType || !apiKey) {
      return errorResponse("sourceType and apiKey are required");
    }

    const config = API_CONFIGS[sourceType];
    if (!config) {
      return errorResponse(`Unknown sourceType: ${sourceType}`);
    }

    // 3. Fetch pages and UPSERT
    let totalFetched = 0;
    let totalUpserted = 0;
    let currentPage = startPage;
    let hasMore = false;

    for (let i = 0; i < MAX_PAGES; i++) {
      const { items, totalCount } = await fetchPage(
        config,
        apiKey,
        currentPage,
      );

      if (items.length === 0) break;
      totalFetched += items.length;

      // Batch UPSERT (build array, single call)
      const rows = items
        .map((item) => {
          const sourceKey = String(
            item[config.sourceKeyField] ?? "",
          );
          if (!sourceKey) return null;
          return {
            source_type: sourceType,
            source_key: sourceKey,
            item_name: String(item[config.itemNameField] ?? ""),
            manufacturer: String(
              item[config.manufacturerField] ?? "",
            ),
            standard_code: String(
              item[config.standardCodeField] ?? "",
            ),
            permit_date: String(
              item[config.permitDateField] ?? "",
            ),
            raw_data: item,
            synced_at: new Date().toISOString(),
          };
        })
        .filter(Boolean);

      if (rows.length > 0) {
        const { error, count } = await supabase
          .from("mfds_items")
          .upsert(rows, {
            onConflict: "source_type,source_key",
            count: "exact",
          });

        if (error) {
          console.error("UPSERT error:", error.message);
        } else {
          totalUpserted += count ?? rows.length;
        }
      }

      // Check if more pages remain
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      currentPage++;
      if (currentPage > totalPages) break;
      hasMore = currentPage <= totalPages;
    }

    return jsonResponse({
      success: true,
      totalFetched,
      totalUpserted,
      nextPage: hasMore ? currentPage : null,
      hasMore,
    });
  } catch (err) {
    console.error("sync-mfds error:", err);
    return errorResponse(
      `Internal error: ${(err as Error).message}`,
      500,
    );
  }
});
```

**Step 2: Deploy Edge Function**

Run: `cd packages/supabase && supabase functions deploy sync-mfds --no-verify-jwt`
Expected: Function deployed successfully.

**Step 3: Commit**

```bash
git add packages/supabase/functions/sync-mfds/index.ts
git commit -m "feat: add sync-mfds Edge Function for UPSERT sync"
```

---

### Task 3: Add server actions — searchMfdsItems and triggerMfdsSync

**Files:**
- Modify: `apps/web/src/lib/actions.ts` (lines 315-396 — MFDS search section)

**Step 1: Add new MfdsItem type to types.ts**

File: `apps/web/src/lib/types.ts`

Add after the existing `MfdsApiSource` type (around line 407):

```typescript
export interface MfdsItem {
  id: number;
  source_type: MfdsApiSource;
  source_key: string;
  item_name: string;
  manufacturer: string | null;
  standard_code: string | null;
  permit_date: string | null;
  raw_data: Record<string, unknown>;
  synced_at: string;
}
```

**Step 2: Add searchMfdsItems server action**

File: `apps/web/src/lib/actions.ts`

Add a new unified search function AFTER the existing `parseMfdsApiItems` function (after line 338). Keep `getMfdsApiKey` and `parseMfdsApiItems` as-is — they are still used by sync and manage mode.

```typescript
// --- MFDS DB Search (replaces direct API search) ---

export async function searchMfdsItems(params: {
  query: string;
  sourceType: MfdsApiSource;
  searchField?: string;
  page?: number;
  pageSize?: number;
  filters?: FilterChip[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<{
  items: Record<string, unknown>[];
  totalCount: number;
  page: number;
}> {
  const {
    query,
    sourceType,
    searchField = "_all",
    page = 1,
    pageSize = 25,
    filters = [],
    sortBy,
    sortOrder = "asc",
  } = params;

  const supabase = await createClient();
  const q = query.trim();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build base query
  let dbQuery = supabase
    .from("mfds_items")
    .select("*", { count: "exact" })
    .eq("source_type", sourceType);

  // Apply text search
  if (q) {
    if (searchField === "_all") {
      // Search across all primary fields using OR
      dbQuery = dbQuery.or(
        `item_name.ilike.%${q}%,manufacturer.ilike.%${q}%,standard_code.ilike.%${q}%`,
      );
    } else {
      // Map API field name to DB column for primary fields
      const fieldMap: Record<string, string> = {
        // Drug fields
        ITEM_NAME: "item_name",
        ENTP_NAME: "manufacturer",
        BAR_CODE: "standard_code",
        ITEM_SEQ: "source_key",
        // Device fields
        PRDLST_NM: "item_name",
        MNFT_IPRT_ENTP_NM: "manufacturer",
        UDIDI_CD: "standard_code",
      };

      const dbCol = fieldMap[searchField];
      if (dbCol) {
        dbQuery = dbQuery.ilike(dbCol, `%${q}%`);
      } else {
        // Search in raw_data JSONB for non-primary fields
        // Use text search on raw_data cast
        dbQuery = dbQuery.filter(
          `raw_data->>${searchField}`,
          "ilike",
          `%${q}%`,
        );
      }
    }
  }

  // Apply filter chips (JSONB field-level filters)
  for (const chip of filters) {
    const fieldPath = `raw_data->>${chip.field}`;
    switch (chip.operator) {
      case "contains":
        dbQuery = dbQuery.filter(fieldPath, "ilike", `%${chip.value}%`);
        break;
      case "equals":
        dbQuery = dbQuery.filter(fieldPath, "eq", chip.value);
        break;
      case "startsWith":
        dbQuery = dbQuery.filter(fieldPath, "ilike", `${chip.value}%`);
        break;
      case "notContains":
        dbQuery = dbQuery.not(fieldPath as never, "ilike" as never, `%${chip.value}%` as never);
        break;
      case "before":
        dbQuery = dbQuery.filter(fieldPath, "lt", chip.value);
        break;
      case "after":
        dbQuery = dbQuery.filter(fieldPath, "gt", chip.value);
        break;
      case "between":
        dbQuery = dbQuery.filter(fieldPath, "gte", chip.value);
        if (chip.valueTo) {
          dbQuery = dbQuery.filter(fieldPath, "lte", chip.valueTo);
        }
        break;
    }
  }

  // Sorting
  if (sortBy) {
    const fieldMap: Record<string, string> = {
      ITEM_NAME: "item_name",
      ENTP_NAME: "manufacturer",
      PRDLST_NM: "item_name",
      MNFT_IPRT_ENTP_NM: "manufacturer",
    };
    const dbCol = fieldMap[sortBy] ?? "item_name";
    dbQuery = dbQuery.order(dbCol, { ascending: sortOrder === "asc" });
  } else {
    dbQuery = dbQuery.order("item_name", { ascending: true });
  }

  // Pagination
  dbQuery = dbQuery.range(from, to);

  const { data, count, error } = await dbQuery;

  if (error) throw new Error(`DB 검색 오류: ${error.message}`);

  // Extract raw_data from each row (this is what the UI expects)
  const items = (data ?? []).map(
    (row: { raw_data: Record<string, unknown> }) => row.raw_data,
  );

  return {
    items,
    totalCount: count ?? 0,
    page,
  };
}
```

**Step 3: Add triggerMfdsSync server action**

Same file, add after `searchMfdsItems`:

```typescript
export async function triggerMfdsSync(sourceType: MfdsApiSource): Promise<{
  totalFetched: number;
  totalUpserted: number;
  error?: string;
}> {
  const apiKey = await getMfdsApiKey();
  const supabase = await createClient();

  // Get user session token for Edge Function auth
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("인증이 필요합니다.");

  let totalFetched = 0;
  let totalUpserted = 0;
  let page = 1;
  let hasMore = true;

  // Create sync log entry
  const startTime = Date.now();
  const { data: logEntry } = await supabase
    .from("mfds_sync_logs")
    .insert({
      trigger_type: "manual",
      source_type: sourceType,
      status: "running",
    })
    .select("id")
    .single();

  try {
    // Caller-driven chunking loop
    while (hasMore) {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-mfds`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ sourceType, page, apiKey }),
        },
      );

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`동기화 실패: ${errBody}`);
      }

      const result = await res.json();
      totalFetched += result.totalFetched ?? 0;
      totalUpserted += result.totalUpserted ?? 0;
      hasMore = result.hasMore === true;
      page = result.nextPage ?? page + 1;
    }

    // Update sync log — completed
    if (logEntry?.id) {
      await supabase
        .from("mfds_sync_logs")
        .update({
          status: "completed",
          finished_at: new Date().toISOString(),
          total_fetched: totalFetched,
          total_upserted: totalUpserted,
          duration_ms: Date.now() - startTime,
        })
        .eq("id", logEntry.id);
    }

    revalidatePath("/products");
    return { totalFetched, totalUpserted };
  } catch (err) {
    // Update sync log — error
    if (logEntry?.id) {
      await supabase
        .from("mfds_sync_logs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          error_message: (err as Error).message,
          duration_ms: Date.now() - startTime,
        })
        .eq("id", logEntry.id);
    }
    throw err;
  }
}

export async function getMfdsSyncStatus(): Promise<{
  lastSync: string | null;
  drugCount: number;
  deviceCount: number;
}> {
  const supabase = await createClient();

  const [lastSyncResult, drugCountResult, deviceCountResult] =
    await Promise.all([
      supabase
        .from("mfds_sync_logs")
        .select("finished_at")
        .eq("status", "completed")
        .order("finished_at", { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from("mfds_items")
        .select("id", { count: "exact", head: true })
        .eq("source_type", "drug"),
      supabase
        .from("mfds_items")
        .select("id", { count: "exact", head: true })
        .eq("source_type", "device_std"),
    ]);

  return {
    lastSync: lastSyncResult.data?.finished_at ?? null,
    drugCount: drugCountResult.count ?? 0,
    deviceCount: deviceCountResult.count ?? 0,
  };
}
```

**Step 4: Add necessary imports to actions.ts**

At the top of `actions.ts`, ensure these imports exist:

```typescript
import type { MfdsApiSource, MfdsItem } from "@/lib/types";
import type { FilterChip } from "@/lib/mfds-search-utils";
```

**Step 5: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

**Step 6: Commit**

```bash
git add apps/web/src/lib/actions.ts apps/web/src/lib/types.ts
git commit -m "feat: add searchMfdsItems and triggerMfdsSync server actions"
```

---

### Task 4: Update MfdsSearchPanel — debounce search + remove globalFilter dependency

**Files:**
- Modify: `apps/web/src/components/mfds-search-panel.tsx` (main panel)
- Modify: `apps/web/src/components/mfds/mfds-result-toolbar.tsx` (remove globalFilter input)

**Step 1: Update imports in mfds-search-panel.tsx**

File: `apps/web/src/components/mfds-search-panel.tsx`

Replace the import block (lines 25-37):

```typescript
// Old:
import {
  searchMfdsDrug,
  searchMfdsDevice,
  addToMyDrugs,
  ...
} from "@/lib/actions";
import { getFallbackFields, type FilterChip } from "@/lib/mfds-search-utils";

// New:
import {
  searchMfdsItems,
  searchMfdsDrug,        // Keep for manage mode sync
  searchMfdsDevice,      // Keep for manage mode sync
  addToMyDrugs,
  addToMyDevices,
  syncMyDrug,
  syncMyDevice,
  applyDrugSync,
  applyDeviceSync,
  deleteMyDrug,
  deleteMyDevice,
  updateMyDrugPrice,
  updateMyDevicePrice,
} from "@/lib/actions";
import { type FilterChip } from "@/lib/mfds-search-utils";
```

**Step 2: Add debounce timer ref and AbortController**

After the existing refs (around line 102), add:

```typescript
const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const abortControllerRef = useRef<AbortController | null>(null);
```

**Step 3: Replace doSearch callback (lines 338-399)**

Replace the entire `doSearch` callback with:

```typescript
const doSearch = useCallback(
  (targetPage = 1) => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    startTransition(async () => {
      setIsLoading(true);
      try {
        const q = query.trim();

        const result = await searchMfdsItems({
          query: q,
          sourceType: tab,
          searchField,
          page: targetPage,
          pageSize,
          filters: activeFilters,
        });

        // Only update if not aborted
        if (!abortControllerRef.current?.signal.aborted) {
          setResults(result.items as Record<string, unknown>[]);
          setTotalCount(result.totalCount);
          setPage(targetPage);
          setHasSearched(true);
          setExpandedRowId(null);

          if (q) {
            recentSearches.add(q, tab);
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        toast.error(
          `검색 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
          {
            action: {
              label: "재시도",
              onClick: () => doSearch(targetPage),
            },
          },
        );
      } finally {
        setIsLoading(false);
      }
    });
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [query, activeFilters, tab, searchField],
);
```

**Step 4: Add debounce effect for auto-search on query change**

After the `doSearch` callback, add a new effect:

```typescript
// ── Debounced auto-search on query change ─────────────────────────
useEffect(() => {
  if (mode === "manage") return; // manage mode uses client-side filter
  if (!hasSearched && !query.trim()) return; // Don't search on initial empty

  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
  }
  debounceTimerRef.current = setTimeout(() => {
    doSearch(1);
  }, 300);

  return () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [query, activeFilters]);
```

**Step 5: Update MfdsSearchBar onSearch prop (line 609-615)**

Change the onSearch handler to no longer set globalFilter in manage mode for browse/pick modes:

```typescript
// Old:
onSearch={() => {
  if (mode === "manage") {
    setGlobalFilter(query);
  } else {
    doSearch(1);
  }
}}

// New:
onSearch={() => {
  if (mode === "manage") {
    setGlobalFilter(query);
  } else {
    // Clear debounce timer and search immediately
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    doSearch(1);
  }
}}
```

**Step 6: Remove globalFilter from MfdsResultToolbar**

File: `apps/web/src/components/mfds/mfds-result-toolbar.tsx`

Replace the entire component to remove the globalFilter input (lines 17-103):

```typescript
interface MfdsResultToolbarProps {
  totalCount: number;
  page: number;
  totalPages: number;
  table: Table<Record<string, unknown>>;
}

export function MfdsResultToolbar({
  totalCount,
  page,
  totalPages,
  table,
}: MfdsResultToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      {/* Left side — result summary */}
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground whitespace-nowrap">
          총 {totalCount.toLocaleString()}건 (페이지 {page}/{totalPages || 1})
        </p>
      </div>

      {/* Right side — column visibility toggle */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Settings2 className="h-3 w-3 mr-1" />
            표시 항목
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 max-h-80 overflow-y-auto"
        >
          <DropdownMenuLabel>표시할 항목</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {table
            .getAllLeafColumns()
            .filter((col) => col.id !== "_action" && col.id !== "_expand")
            .map((col) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={col.getIsVisible()}
                onCheckedChange={(v: boolean) => col.toggleVisibility(v)}
              >
                {typeof col.columnDef.header === "string"
                  ? col.columnDef.header
                  : col.id}
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

Also remove unused imports: `Filter`, `X`, `Input` from the toolbar imports. Keep `Settings2`, `Button`, `DropdownMenu*`.

**Step 7: Update MfdsResultToolbar usage in mfds-search-panel.tsx (lines 622-633)**

```typescript
// Old:
<MfdsResultToolbar
  totalCount={totalCount}
  page={page}
  totalPages={totalPages}
  globalFilter={globalFilter}
  onGlobalFilterChange={setGlobalFilter}
  filteredCount={table.getFilteredRowModel().rows.length}
  table={table}
/>

// New:
<MfdsResultToolbar
  totalCount={totalCount}
  page={page}
  totalPages={totalPages}
  table={table}
/>
```

**Step 8: Update MfdsResultTable props (lines 636-651)**

Remove globalFilter-related props that are no longer needed:

```typescript
// Old:
<MfdsResultTable
  table={table}
  tab={tab}
  expandedRowId={expandedRowId}
  onExpandToggle={...}
  existingStandardCodes={existingStandardCodes}
  addingId={addingId}
  onAdd={handleAdd}
  isPending={isPending}
  isLoading={isLoading}
  hasSearched={hasSearched}
  globalFilter={globalFilter}
  onGlobalFilterReset={() => setGlobalFilter("")}
/>

// New:
<MfdsResultTable
  table={table}
  tab={tab}
  expandedRowId={expandedRowId}
  onExpandToggle={...}
  existingStandardCodes={existingStandardCodes}
  addingId={addingId}
  onAdd={handleAdd}
  isPending={isPending}
  isLoading={isLoading}
  hasSearched={hasSearched}
/>
```

**Step 9: Update MfdsResultTable component props**

File: `apps/web/src/components/mfds/mfds-result-table.tsx`

Remove `globalFilter` and `onGlobalFilterReset` from the component's props interface and the "no results from filter" empty state that references them. The empty state for no search results remains.

Find and remove any code like:
```typescript
if (filteredRows.length === 0 && globalFilter) {
  // ... filter-specific empty state
}
```

Replace with a simple no-results state if already searched.

**Step 10: Remove getFilteredRowModel from table config if not needed by manage mode**

In `mfds-search-panel.tsx`, the `useReactTable` config (around line 326-334):

Note: Keep `getFilteredRowModel` because manage mode still uses the `globalFilter` state for client-side filtering of myDrugs/myDevices. The `globalFilter` state variable can stay for manage mode only.

**Step 11: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

**Step 12: Commit**

```bash
git add apps/web/src/components/mfds-search-panel.tsx apps/web/src/components/mfds/mfds-result-toolbar.tsx apps/web/src/components/mfds/mfds-result-table.tsx
git commit -m "feat: switch to DB search with debounce, remove browse-mode globalFilter"
```

---

### Task 5: Add sync UI — sync status banner and manual sync button

**Files:**
- Modify: `apps/web/src/app/(dashboard)/products/page.tsx`
- Modify: `apps/web/src/components/mfds-search-panel.tsx` (add sync status)

**Step 1: Fetch sync status in products page**

File: `apps/web/src/app/(dashboard)/products/page.tsx`

Add data fetching for sync status:

```typescript
import { getMfdsSyncStatus } from "@/lib/actions";

export default async function ProductsPage() {
  const [existingCodes, syncStatus] = await Promise.all([
    getExistingStandardCodes(),
    getMfdsSyncStatus(),
  ]);

  return (
    <MfdsSearchPanel
      mode="browse"
      existingStandardCodes={existingCodes}
      syncStatus={syncStatus}
    />
  );
}
```

**Step 2: Add syncStatus prop to MfdsSearchPanel**

File: `apps/web/src/components/mfds-search-panel.tsx`

Add to props interface:

```typescript
interface MfdsSearchPanelProps {
  mode: "browse" | "pick" | "manage";
  onSelect?: (productId: number) => void;
  existingStandardCodes?: string[];
  myDrugs?: Record<string, unknown>[];
  myDevices?: Record<string, unknown>[];
  syncStatus?: {
    lastSync: string | null;
    drugCount: number;
    deviceCount: number;
  };
}
```

**Step 3: Add sync banner before search bar**

In the render section, before `<MfdsSearchBar>`, add:

```typescript
{/* Sync status banner */}
{mode === "browse" && syncStatus && (
  <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2 text-sm">
    <div className="flex items-center gap-4 text-muted-foreground">
      <span>
        의약품: {syncStatus.drugCount.toLocaleString()}건
      </span>
      <span>
        의료기기: {syncStatus.deviceCount.toLocaleString()}건
      </span>
      {syncStatus.lastSync && (
        <span>
          마지막 동기화:{" "}
          {new Date(syncStatus.lastSync).toLocaleDateString("ko-KR")}
        </span>
      )}
      {!syncStatus.lastSync && (
        <span className="text-amber-600">동기화 필요</span>
      )}
    </div>
    <Button
      variant="outline"
      size="sm"
      disabled={isSyncing}
      onClick={handleMfdsSync}
    >
      {isSyncing ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <RefreshCw className="h-3 w-3 mr-1" />
      )}
      동기화
    </Button>
  </div>
)}
```

**Step 4: Add sync handler and state**

In the component, add:

```typescript
const [isSyncing, setIsSyncing] = useState(false);

async function handleMfdsSync() {
  setIsSyncing(true);
  try {
    const result = await triggerMfdsSync(tab);
    toast.success(
      `동기화 완료: ${result.totalFetched.toLocaleString()}건 확인, ${result.totalUpserted.toLocaleString()}건 반영`,
    );
    // Refresh search results
    doSearch(1);
  } catch (err) {
    toast.error(
      `동기화 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
    );
  } finally {
    setIsSyncing(false);
  }
}
```

Add `triggerMfdsSync` to the imports from actions.

**Step 5: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

**Step 6: Commit**

```bash
git add apps/web/src/app/(dashboard)/products/page.tsx apps/web/src/components/mfds-search-panel.tsx
git commit -m "feat: add sync status banner and manual sync button"
```

---

### Task 6: Keep existing API search functions for manage mode backward compatibility

**Files:**
- Verify: `apps/web/src/lib/actions.ts` — ensure `searchMfdsDrug` and `searchMfdsDevice` still exist

**Step 1: Verify backward compatibility**

The existing `searchMfdsDrug` and `searchMfdsDevice` functions are still used by:
- `syncMyDrug()` (line 565) — to fetch latest API data for comparison
- `syncMyDevice()` (line 604) — same
- Manage mode doesn't use them for search, but the sync flow needs them

Verify these functions are NOT removed. They should remain untouched.

**Step 2: Verify manage mode still works**

The manage mode (products/my/page.tsx) loads `myDrugs` and `myDevices` from DB and passes them as props. The `MfdsSearchPanel` in manage mode sets `results` from these props and uses `globalFilter` for client-side filtering. This path is unchanged.

**Step 3: Commit (if any changes needed)**

No commit needed if no changes were made.

---

### Task 7: Manual testing and initial data sync

**Step 1: Run initial sync via the web UI**

1. Open the Products page in the web app
2. Click the "동기화" button for drug tab
3. Wait for completion (may take several minutes for full drug dataset)
4. Switch to device_std tab and click "동기화" again
5. Verify counts in the sync status banner

**Step 2: Test search functionality**

1. Type a drug name (e.g., "타이레놀") in the search bar
2. Verify results appear after ~300ms debounce
3. Navigate to page 2, 3 — verify pagination works with server-side data
4. Try specific field search (change dropdown from "전체" to "업체명")
5. Add a filter chip and verify it narrows results

**Step 3: Test manage mode**

1. Navigate to /products/my
2. Verify existing my drugs/devices still load
3. Test sync button on individual items
4. Verify prices can still be edited

**Step 4: Verify no TypeScript errors**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

---

### Task 8: Clean up unused code

**Files:**
- Modify: `apps/web/src/lib/mfds-search-utils.ts` — remove `getFallbackFields` if no longer used
- Modify: `apps/web/src/components/mfds-search-panel.tsx` — remove `getFallbackFields` import

**Step 1: Remove getFallbackFields usage**

Since the new `searchMfdsItems` handles `_all` search by using `OR` across multiple DB columns, the `getFallbackFields` sequential retry logic is no longer needed for browse mode.

Check if `getFallbackFields` is used anywhere else:

Run: `grep -r "getFallbackFields" apps/web/src/`

If only used in `mfds-search-panel.tsx` (which we already replaced), remove the import.

**Step 2: Remove unused imports from mfds-search-panel.tsx**

Remove `getFallbackFields` from import of `@/lib/mfds-search-utils`.

If `searchMfdsDrug` and `searchMfdsDevice` are no longer imported in `mfds-search-panel.tsx` (since we use `searchMfdsItems` now), remove those imports too. But verify first — they might still be used for sync.

Check: `syncMyDrug` and `syncMyDevice` are in `actions.ts` (server-side), not in the component. So the component may no longer need `searchMfdsDrug`/`searchMfdsDevice` imports.

**Step 3: Verify and commit**

Run: `cd apps/web && npx tsc --noEmit`

```bash
git add apps/web/src/components/mfds-search-panel.tsx apps/web/src/lib/mfds-search-utils.ts
git commit -m "refactor: remove unused fallback search imports"
```

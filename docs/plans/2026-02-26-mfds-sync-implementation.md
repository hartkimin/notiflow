# MFDS API Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sync all 3 MFDS APIs (drug, device, UDI) into a unified `mfds_items` table, link to `products` via FK, replace real-time API search with local DB search, and add manual + scheduled (daily 5AM KST) sync.

**Architecture:** Supabase Edge Function (`sync-mfds`) fetches all pages from each API and UPSERTs into `mfds_items`. Linked `products` are auto-updated. `DrugSearchDialog` switches from API calls to `mfds_items` table queries. Settings page gets a sync management panel.

**Tech Stack:** Supabase (PostgreSQL, Edge Functions, pg_cron), Next.js 16, shadcn/ui, TypeScript

**Design Doc:** `docs/plans/2026-02-26-mfds-sync-design.md`

---

## Task 1: DB Migration — Create mfds_items, mfds_sync_logs, alter products

**Files:**
- Create: `packages/supabase/migrations/00022_mfds_items.sql`

**Step 1: Write the migration SQL**

```sql
-- ============================================================
-- 22. MFDS Items (식약처 통합 데이터) & Sync Logs
-- ============================================================

-- Enable pg_trgm for Korean text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Source type enum
CREATE TYPE mfds_source_type AS ENUM ('drug', 'device', 'device_std');

-- Unified MFDS items table
CREATE TABLE mfds_items (
  id                  BIGSERIAL PRIMARY KEY,
  source_type         mfds_source_type NOT NULL,
  source_key          VARCHAR(100) NOT NULL,

  -- 공통 컬럼 (2+ APIs share)
  item_name           VARCHAR(500) NOT NULL,
  manufacturer        VARCHAR(255),
  permit_no           VARCHAR(100),
  permit_date         VARCHAR(20),
  standard_code       VARCHAR(100),
  classification_no   VARCHAR(100),
  classification_grade VARCHAR(10),
  product_name        VARCHAR(500),
  use_purpose         TEXT,

  -- 의약품(drug) 전용
  edi_code            VARCHAR(50),
  atc_code            VARCHAR(50),
  main_item_ingr      TEXT,
  bizrno              VARCHAR(20),
  rare_drug_yn        VARCHAR(5),

  -- 의료기기 품목(device) 전용
  mnsc_nm             VARCHAR(255),
  mnsc_natn_cd        VARCHAR(50),
  prmsn_dclr_divs_nm  VARCHAR(50),

  -- 의료기기 표준코드(device_std) 전용
  foml_info           VARCHAR(500),
  hmbd_trspt_mdeq_yn  VARCHAR(5),
  dspsbl_mdeq_yn      VARCHAR(5),
  trck_mng_trgt_yn    VARCHAR(5),
  total_dev           VARCHAR(5),
  cmbnmd_yn           VARCHAR(5),
  use_before_strlzt_need_yn VARCHAR(5),
  sterilization_method VARCHAR(255),
  strg_cnd_info       VARCHAR(255),
  circ_cnd_info       VARCHAR(255),
  rcprslry_trgt_yn    VARCHAR(5),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(source_type, source_key)
);

-- Indexes
CREATE INDEX idx_mfds_items_name ON mfds_items USING gin (item_name gin_trgm_ops);
CREATE INDEX idx_mfds_items_manufacturer ON mfds_items USING gin (manufacturer gin_trgm_ops);
CREATE INDEX idx_mfds_items_source_type ON mfds_items (source_type);
CREATE INDEX idx_mfds_items_standard_code ON mfds_items (standard_code) WHERE standard_code IS NOT NULL;
CREATE INDEX idx_mfds_items_product_name ON mfds_items USING gin (product_name gin_trgm_ops) WHERE product_name IS NOT NULL;

-- updated_at trigger
CREATE TRIGGER update_mfds_items_updated_at
  BEFORE UPDATE ON mfds_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sync logs table
CREATE TABLE mfds_sync_logs (
  id              BIGSERIAL PRIMARY KEY,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  trigger_type    VARCHAR(20) NOT NULL,
  triggered_by    UUID REFERENCES auth.users(id),
  source_filter   VARCHAR(20),

  drug_total      INT DEFAULT 0,
  drug_added      INT DEFAULT 0,
  drug_updated    INT DEFAULT 0,
  device_total    INT DEFAULT 0,
  device_added    INT DEFAULT 0,
  device_updated  INT DEFAULT 0,
  device_std_total INT DEFAULT 0,
  device_std_added INT DEFAULT 0,
  device_std_updated INT DEFAULT 0,
  products_updated INT DEFAULT 0,

  error_message   TEXT,
  duration_ms     INT
);

CREATE INDEX idx_mfds_sync_logs_status ON mfds_sync_logs (status);
CREATE INDEX idx_mfds_sync_logs_started ON mfds_sync_logs (started_at DESC);

-- Add mfds_item FK to products
ALTER TABLE products ADD COLUMN mfds_item_id BIGINT REFERENCES mfds_items(id) ON DELETE SET NULL;
CREATE INDEX idx_products_mfds_item ON products (mfds_item_id) WHERE mfds_item_id IS NOT NULL;

-- RLS policies for mfds_items (read for authenticated, write for service role only)
ALTER TABLE mfds_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read mfds_items"
  ON mfds_items FOR SELECT TO authenticated USING (true);

ALTER TABLE mfds_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read mfds_sync_logs"
  ON mfds_sync_logs FOR SELECT TO authenticated USING (true);
```

**Step 2: Apply migration**

Run in Supabase SQL Editor or via CLI:
```bash
cd /mnt/d/Project/09_NotiFlow
npx supabase db push
```

Verify: Check Supabase Dashboard → Table Editor → `mfds_items` and `mfds_sync_logs` tables exist. Check `products` has `mfds_item_id` column.

**Step 3: Commit**

```bash
git add packages/supabase/migrations/00022_mfds_items.sql
git commit -m "feat(db): add mfds_items and mfds_sync_logs tables, add mfds_item_id FK to products"
```

---

## Task 2: TypeScript Types — MfdsItem, MfdsSyncLog

**Files:**
- Modify: `apps/web/src/lib/types.ts` (append after line ~451)

**Step 1: Add MfdsItem and MfdsSyncLog types**

Append to end of `apps/web/src/lib/types.ts`:

```typescript
// --- MFDS Unified Items (식약처 통합 데이터) ---

export type MfdsSourceType = "drug" | "device" | "device_std";

export interface MfdsItem {
  id: number;
  source_type: MfdsSourceType;
  source_key: string;

  // 공통
  item_name: string;
  manufacturer: string | null;
  permit_no: string | null;
  permit_date: string | null;
  standard_code: string | null;
  classification_no: string | null;
  classification_grade: string | null;
  product_name: string | null;
  use_purpose: string | null;

  // drug 전용
  edi_code: string | null;
  atc_code: string | null;
  main_item_ingr: string | null;
  bizrno: string | null;
  rare_drug_yn: string | null;

  // device 전용
  mnsc_nm: string | null;
  mnsc_natn_cd: string | null;
  prmsn_dclr_divs_nm: string | null;

  // device_std 전용
  foml_info: string | null;
  hmbd_trspt_mdeq_yn: string | null;
  dspsbl_mdeq_yn: string | null;
  trck_mng_trgt_yn: string | null;
  total_dev: string | null;
  cmbnmd_yn: string | null;
  use_before_strlzt_need_yn: string | null;
  sterilization_method: string | null;
  strg_cnd_info: string | null;
  circ_cnd_info: string | null;
  rcprslry_trgt_yn: string | null;

  created_at: string;
  updated_at: string;
}

export interface MfdsSyncLog {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "failed";
  trigger_type: "manual" | "scheduled";
  triggered_by: string | null;
  source_filter: string | null;

  drug_total: number;
  drug_added: number;
  drug_updated: number;
  device_total: number;
  device_added: number;
  device_updated: number;
  device_std_total: number;
  device_std_added: number;
  device_std_updated: number;
  products_updated: number;

  error_message: string | null;
  duration_ms: number | null;
}

export interface MfdsSearchResponse {
  items: MfdsItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface MfdsSyncStats {
  drug_count: number;
  device_count: number;
  device_std_count: number;
  last_sync: MfdsSyncLog | null;
}
```

**Step 2: Update Product type to include mfds_item_id**

In `apps/web/src/lib/types.ts`, find the `Product` interface (around line 117-130) and add:

```typescript
  mfds_item_id: number | null;
```

after `is_active: boolean;`.

**Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat(types): add MfdsItem, MfdsSyncLog types and mfds_item_id to Product"
```

---

## Task 3: Edge Function — sync-mfds

**Files:**
- Create: `packages/supabase/functions/sync-mfds/index.ts`

**Step 1: Create the Edge Function**

This function handles one source at a time (drug, device, or device_std) per invocation. pg_cron calls it 3 times with 5-minute gaps.

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// --- API configs ---

const API_CONFIGS = {
  drug: {
    baseUrl:
      "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06",
    mapItem: (r: Record<string, unknown>) => ({
      source_type: "drug" as const,
      source_key: gf(r, "ITEM_SEQ", "item_seq") ?? "",
      item_name: gf(r, "ITEM_NAME", "item_name") ?? "",
      manufacturer: gf(r, "ENTP_NAME", "entp_name"),
      permit_no: gf(r, "ENTP_NO", "entp_no"),
      permit_date: gf(r, "ITEM_PERMIT_DATE", "item_permit_date"),
      standard_code: gf(r, "BAR_CODE", "bar_code"),
      classification_no: null,
      classification_grade: null,
      product_name: null,
      use_purpose: null,
      // drug specific
      edi_code: gf(r, "EDI_CODE", "edi_code"),
      atc_code: gf(r, "ATC_CODE", "atc_code"),
      main_item_ingr: gf(r, "MAIN_ITEM_INGR", "main_item_ingr"),
      bizrno: gf(r, "BIZRNO", "bizrno"),
      rare_drug_yn: gf(r, "RARE_DRUG_YN", "rare_drug_yn"),
      // device fields null
      mnsc_nm: null,
      mnsc_natn_cd: null,
      prmsn_dclr_divs_nm: null,
      // device_std fields null
      foml_info: null,
      hmbd_trspt_mdeq_yn: null,
      dspsbl_mdeq_yn: null,
      trck_mng_trgt_yn: null,
      total_dev: null,
      cmbnmd_yn: null,
      use_before_strlzt_need_yn: null,
      sterilization_method: null,
      strg_cnd_info: null,
      circ_cnd_info: null,
      rcprslry_trgt_yn: null,
    }),
  },
  device: {
    baseUrl:
      "https://apis.data.go.kr/1471000/MdeqPrdlstInfoService02/getMdeqPrdlstInfoInq02",
    mapItem: (r: Record<string, unknown>) => ({
      source_type: "device" as const,
      source_key: gf(r, "MDEQ_PRDLST_SN", "mdeq_prdlst_sn") ?? "",
      item_name: gf(r, "PRDLST_NM", "prdlst_nm") ?? "",
      manufacturer: gf(r, "MNFT_CLNT_NM", "mnft_clnt_nm"),
      permit_no: gf(r, "MEDDEV_ITEM_NO", "meddev_item_no"),
      permit_date: gf(r, "PRMSN_YMD", "prmsn_ymd"),
      standard_code: null,
      classification_no: gf(r, "MDEQ_CLSF_NO", "mdeq_clsf_no"),
      classification_grade: gf(r, "CLSF_NO_GRAD_CD", "clsf_no_grad_cd"),
      product_name: gf(r, "PRDT_NM_INFO", "prdt_nm_info"),
      use_purpose: gf(r, "USE_PURPS_CONT", "use_purps_cont"),
      // drug fields null
      edi_code: null,
      atc_code: null,
      main_item_ingr: null,
      bizrno: null,
      rare_drug_yn: null,
      // device specific
      mnsc_nm: gf(r, "MNSC_NM", "mnsc_nm"),
      mnsc_natn_cd: gf(r, "MNSC_NATN_CD", "mnsc_natn_cd"),
      prmsn_dclr_divs_nm: gf(r, "PRMSN_DCLR_DIVS_NM", "prmsn_dclr_divs_nm"),
      // device_std fields null
      foml_info: null,
      hmbd_trspt_mdeq_yn: null,
      dspsbl_mdeq_yn: null,
      trck_mng_trgt_yn: null,
      total_dev: null,
      cmbnmd_yn: null,
      use_before_strlzt_need_yn: null,
      sterilization_method: null,
      strg_cnd_info: null,
      circ_cnd_info: null,
      rcprslry_trgt_yn: null,
    }),
  },
  device_std: {
    baseUrl:
      "https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03/getMdeqStdCdPrdtInfoInq03",
    mapItem: (r: Record<string, unknown>) => ({
      source_type: "device_std" as const,
      source_key: gf(r, "UDIDI_CD", "udidi_cd") ?? "",
      item_name: gf(r, "PRDLST_NM", "prdlst_nm") ?? "",
      manufacturer: gf(r, "MNFT_IPRT_ENTP_NM", "mnft_iprt_entp_nm"),
      permit_no: gf(r, "PERMIT_NO", "permit_no"),
      permit_date: gf(r, "PRMSN_YMD", "prmsn_ymd"),
      standard_code: gf(r, "UDIDI_CD", "udidi_cd"),
      classification_no: gf(r, "MDEQ_CLSF_NO", "mdeq_clsf_no"),
      classification_grade: gf(r, "CLSF_NO_GRAD_CD", "clsf_no_grad_cd"),
      product_name: gf(r, "PRDT_NM_INFO", "prdt_nm_info"),
      use_purpose: gf(r, "USE_PURPS_CONT", "use_purps_cont"),
      // drug fields null
      edi_code: null,
      atc_code: null,
      main_item_ingr: null,
      bizrno: null,
      rare_drug_yn: null,
      // device fields null
      mnsc_nm: null,
      mnsc_natn_cd: null,
      prmsn_dclr_divs_nm: null,
      // device_std specific
      foml_info: gf(r, "FOML_INFO", "foml_info"),
      hmbd_trspt_mdeq_yn: gf(r, "HMBD_TRSPT_MDEQ_YN", "hmbd_trspt_mdeq_yn"),
      dspsbl_mdeq_yn: gf(r, "DSPSBL_MDEQ_YN", "dspsbl_mdeq_yn"),
      trck_mng_trgt_yn: gf(r, "TRCK_MNG_TRGT_YN", "trck_mng_trgt_yn"),
      total_dev: gf(r, "TOTAL_DEV", "total_dev"),
      cmbnmd_yn: gf(r, "CMBNMD_YN", "cmbnmd_yn"),
      use_before_strlzt_need_yn: gf(
        r,
        "USE_BEFORE_STRLZT_NEED_YN",
        "use_before_strlzt_need_yn",
      ),
      sterilization_method: gf(
        r,
        "STERILIZATION_METHOD_NM",
        "sterilization_method_nm",
      ),
      strg_cnd_info: gf(r, "STRG_CND_INFO", "strg_cnd_info"),
      circ_cnd_info: gf(r, "CIRC_CND_INFO", "circ_cnd_info"),
      rcprslry_trgt_yn: gf(r, "RCPRSLRY_TRGT_YN", "rcprslry_trgt_yn"),
    }),
  },
} as const;

type SourceType = keyof typeof API_CONFIGS;

// --- Helpers ---

/** Get field value from API response, trying multiple key casings */
function gf(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    if (r[k] != null && String(r[k]).trim() !== "" && String(r[k]).trim() !== "별첨") {
      return String(r[k]);
    }
  }
  return null;
}

/** Parse variable MFDS API response structures */
function parseApiItems(body: Record<string, unknown>): unknown[] {
  if (!body) return [];
  const items = body.items as unknown;
  if (Array.isArray(items)) {
    return items.map((wrapper: Record<string, unknown>) => wrapper.item ?? wrapper);
  }
  if (items && typeof items === "object") {
    const obj = items as Record<string, unknown>;
    if (obj.item) {
      return Array.isArray(obj.item) ? obj.item : [obj.item];
    }
  }
  return [];
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Parse request
    const body = await req.json().catch(() => ({}));
    const trigger: string = body.trigger ?? "manual";
    const sourceFilter: SourceType | "all" = body.source ?? "all";
    const userId: string | null = body.user_id ?? null;

    // Check for already-running sync
    const { data: running } = await supabase
      .from("mfds_sync_logs")
      .select("id")
      .eq("status", "running")
      .limit(1);

    if (running && running.length > 0) {
      return errorResponse("이미 동기화가 진행 중입니다.", 409);
    }

    // Get API key
    const { data: settingRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "drug_api_service_key")
      .single();

    const serviceKey =
      typeof settingRow?.value === "string" && settingRow.value.length > 0
        ? settingRow.value
        : null;

    if (!serviceKey) {
      return errorResponse("API 키가 설정되지 않았습니다.", 422);
    }

    // Create sync log
    const { data: logRow, error: logError } = await supabase
      .from("mfds_sync_logs")
      .insert({
        trigger_type: trigger,
        triggered_by: userId,
        source_filter: sourceFilter,
        status: "running",
      })
      .select("id, started_at")
      .single();

    if (logError || !logRow) {
      return errorResponse("동기화 로그 생성 실패", 500);
    }

    const logId = logRow.id;
    const syncStartedAt = logRow.started_at;
    const startTime = Date.now();

    const stats = {
      drug_total: 0, drug_added: 0, drug_updated: 0,
      device_total: 0, device_added: 0, device_updated: 0,
      device_std_total: 0, device_std_added: 0, device_std_updated: 0,
      products_updated: 0,
    };

    const sources: SourceType[] =
      sourceFilter === "all"
        ? ["drug", "device", "device_std"]
        : [sourceFilter];

    const errors: string[] = [];

    // Sync each source
    for (const source of sources) {
      try {
        const config = API_CONFIGS[source];
        let page = 1;
        const numOfRows = 100;
        let totalCount = 0;
        let added = 0;
        let updated = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const params = new URLSearchParams({
            serviceKey,
            pageNo: String(page),
            numOfRows: String(numOfRows),
            type: "json",
          });

          const res = await fetch(`${config.baseUrl}?${params.toString()}`);
          if (!res.ok) {
            errors.push(`${source} API HTTP ${res.status} at page ${page}`);
            break;
          }

          const data = await res.json();
          const apiBody = data.body;
          if (!apiBody) break;

          if (page === 1) {
            totalCount = apiBody.totalCount ?? 0;
          }

          const rawItems = parseApiItems(apiBody);
          if (rawItems.length === 0) break;

          // Map and upsert in batches
          const mapped = rawItems
            .map((raw) => config.mapItem(raw as Record<string, unknown>))
            .filter((item) => item.source_key !== "");

          // Upsert batch
          const { data: upserted, error: upsertError } = await supabase
            .from("mfds_items")
            .upsert(mapped, {
              onConflict: "source_type,source_key",
              ignoreDuplicates: false,
            })
            .select("id, created_at, updated_at");

          if (upsertError) {
            errors.push(`${source} upsert error page ${page}: ${upsertError.message}`);
            break;
          }

          // Count added vs updated
          for (const row of upserted ?? []) {
            if (row.created_at === row.updated_at) {
              added++;
            } else {
              updated++;
            }
          }

          if (page * numOfRows >= totalCount) break;
          page++;
        }

        // Store stats
        const prefix = source === "device_std" ? "device_std" : source;
        stats[`${prefix}_total` as keyof typeof stats] = totalCount;
        stats[`${prefix}_added` as keyof typeof stats] = added;
        stats[`${prefix}_updated` as keyof typeof stats] = updated;
      } catch (err) {
        errors.push(`${source}: ${(err as Error).message}`);
      }
    }

    // Auto-update linked products
    const { count: productsUpdated } = await supabase.rpc(
      "update_products_from_mfds",
      { sync_started: syncStartedAt },
    );
    stats.products_updated = productsUpdated ?? 0;

    // Finalize sync log
    const finalStatus = errors.length > 0 ? "failed" : "success";
    await supabase
      .from("mfds_sync_logs")
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error_message: errors.length > 0 ? errors.join("; ") : null,
        ...stats,
      })
      .eq("id", logId);

    return jsonResponse({
      success: errors.length === 0,
      log_id: logId,
      stats,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("sync-mfds unexpected error:", err);
    return errorResponse(
      `Internal server error: ${(err as Error).message}`,
      500,
    );
  }
});
```

**Step 2: Add the RPC function for auto-updating products**

Append to the migration `00022_mfds_items.sql`:

```sql
-- RPC function: auto-update products linked to changed mfds_items
CREATE OR REPLACE FUNCTION update_products_from_mfds(sync_started TIMESTAMPTZ)
RETURNS INT AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE products p SET
    official_name = m.item_name,
    manufacturer  = m.manufacturer,
    ingredient    = COALESCE(m.main_item_ingr, m.use_purpose),
    efficacy      = m.use_purpose,
    standard_code = m.standard_code
  FROM mfds_items m
  WHERE p.mfds_item_id = m.id
    AND m.updated_at >= sync_started;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 3: Verify Edge Function structure**

```bash
ls packages/supabase/functions/sync-mfds/
```
Expected: `index.ts` exists.

**Step 4: Commit**

```bash
git add packages/supabase/functions/sync-mfds/index.ts packages/supabase/migrations/00022_mfds_items.sql
git commit -m "feat(sync): add sync-mfds Edge Function and update_products_from_mfds RPC"
```

---

## Task 4: Server Actions — MFDS sync trigger and mfds_items queries

**Files:**
- Modify: `apps/web/src/lib/actions.ts` (add new actions at end of file)

**Step 1: Add MFDS server actions**

Append to `apps/web/src/lib/actions.ts`:

```typescript
// --- MFDS Sync Actions ---

export async function triggerMfdsSync(source: "all" | "drug" | "device" | "device_std" = "all") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.functions.invoke("sync-mfds", {
    body: { trigger: "manual", source, user_id: user?.id },
  });

  if (error) {
    return { success: false, error: data?.error ?? error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/products");
  return data as { success: boolean; log_id: number; stats: Record<string, number>; errors?: string[] };
}

export async function getMfdsSyncStats() {
  const supabase = await createClient();

  // Get counts by source_type
  const { data: counts } = await supabase
    .from("mfds_items")
    .select("source_type")
    .then(({ data }) => {
      const drug = data?.filter(r => r.source_type === "drug").length ?? 0;
      const device = data?.filter(r => r.source_type === "device").length ?? 0;
      const device_std = data?.filter(r => r.source_type === "device_std").length ?? 0;
      return { data: { drug, device, device_std } };
    });

  // Get last successful sync
  const { data: lastSync } = await supabase
    .from("mfds_sync_logs")
    .select("*")
    .eq("status", "success")
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  return {
    drug_count: counts?.drug ?? 0,
    device_count: counts?.device ?? 0,
    device_std_count: counts?.device_std ?? 0,
    last_sync: lastSync ?? null,
  };
}

export async function getMfdsSyncLogs(limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mfds_sync_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function searchMfdsItems(
  sourceType: "drug" | "device" | "device_std",
  query: string,
  page = 1,
  pageSize = 10,
) {
  const supabase = await createClient();
  const offset = (page - 1) * pageSize;
  const pattern = `%${query}%`;

  const { data, error, count } = await supabase
    .from("mfds_items")
    .select("*", { count: "exact" })
    .eq("source_type", sourceType)
    .or(`item_name.ilike.${pattern},manufacturer.ilike.${pattern},product_name.ilike.${pattern}`)
    .order("item_name")
    .range(offset, offset + pageSize - 1);

  if (error) throw error;

  return {
    items: data ?? [],
    totalCount: count ?? 0,
    page,
    pageSize,
  };
}
```

**Step 2: Update createProduct to accept mfds_item_id**

Find the `createProduct` function in `actions.ts` and ensure the data parameter can include `mfds_item_id`. Since it already uses `Record<string, unknown>` or a similar flexible type, verify it passes through. If `createProduct` explicitly picks fields, add `mfds_item_id` to the picked fields.

**Step 3: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "feat(actions): add MFDS sync trigger, stats, logs, and search actions"
```

---

## Task 5: MFDS Sync Panel Component — Settings Page

**Files:**
- Create: `apps/web/src/components/mfds-sync-panel.tsx`
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx`

**Step 1: Create MfdsSyncPanel component**

Create `apps/web/src/components/mfds-sync-panel.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, History, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { triggerMfdsSync } from "@/lib/actions";
import type { MfdsSyncLog, MfdsSyncStats } from "@/lib/types";

interface MfdsSyncPanelProps {
  stats: MfdsSyncStats;
  logs: MfdsSyncLog[];
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(ms: number | null) {
  if (!ms) return "—";
  if (ms < 60_000) return `${Math.round(ms / 1000)}초`;
  return `${Math.round(ms / 60_000)}분`;
}

export function MfdsSyncPanel({ stats, logs }: MfdsSyncPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [showLogs, setShowLogs] = useState(false);
  const router = useRouter();

  function handleSync() {
    startTransition(async () => {
      try {
        const result = await triggerMfdsSync("all");
        if (result.success) {
          toast.success(
            `동기화 완료: 의약품 +${result.stats.drug_added}, 의료기기 +${result.stats.device_added}, UDI +${result.stats.device_std_added}`,
          );
        } else {
          toast.error(result.error ?? "동기화 실패");
        }
        router.refresh();
      } catch {
        toast.error("동기화 요청에 실패했습니다.");
      }
    });
  }

  const statusIcon = {
    success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    running: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>식약처 데이터 동기화</CardTitle>
        <CardDescription>
          3개 API(의약품·의료기기 품목·의료기기 UDI)의 전체 데이터를 동기화합니다.
          매일 새벽 5시에 자동 실행됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status + Actions */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            마지막 동기화:{" "}
            <strong>{formatDate(stats.last_sync?.finished_at ?? null)}</strong>
            {stats.last_sync && (
              <Badge variant="outline" className="ml-2">
                {stats.last_sync.status === "success" ? "성공" : "실패"}
              </Badge>
            )}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogs(!showLogs)}
            >
              <History className="h-4 w-4 mr-1" />
              이력
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  {isPending ? "동기화 중..." : "동기화"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>전체 동기화를 시작하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>
                    식약처 3개 API에서 전체 데이터를 가져옵니다. 10~20분 소요될 수 있습니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSync}>시작</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Data counts */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "의약품", count: stats.drug_count },
            { label: "의료기기(품목)", count: stats.device_count },
            { label: "의료기기(UDI)", count: stats.device_std_count },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border p-3 text-center"
            >
              <div className="text-2xl font-bold tabular-nums">
                {item.count.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Sync logs */}
        {showLogs && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>시작 시간</TableHead>
                <TableHead>유형</TableHead>
                <TableHead className="text-right">추가</TableHead>
                <TableHead className="text-right">갱신</TableHead>
                <TableHead className="text-right">소요</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{formatDate(log.started_at)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {log.trigger_type === "manual" ? "수동" : "자동"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {log.drug_added + log.device_added + log.device_std_added}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {log.drug_updated + log.device_updated + log.device_std_updated}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {formatDuration(log.duration_ms)}
                  </TableCell>
                  <TableCell>{statusIcon[log.status]}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    동기화 이력이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Integrate into Settings page**

In `apps/web/src/app/(dashboard)/settings/page.tsx`, add:

1. Import at top:
```typescript
import { getMfdsSyncStats, getMfdsSyncLogs } from "@/lib/actions";
import { MfdsSyncPanel } from "@/components/mfds-sync-panel";
```

2. Fetch data in the server component:
```typescript
const [settings, syncStats, syncLogs] = await Promise.all([
  getSettings(),
  getMfdsSyncStats(),
  getMfdsSyncLogs(),
]);
```

3. Render the panel (after existing settings sections):
```tsx
<MfdsSyncPanel stats={syncStats} logs={syncLogs} />
```

**Step 3: Verify**

Run `npm run dev:web`, navigate to Settings page. The sync panel should render (with 0 counts and no logs).

**Step 4: Commit**

```bash
git add apps/web/src/components/mfds-sync-panel.tsx apps/web/src/app/(dashboard)/settings/page.tsx
git commit -m "feat(ui): add MFDS sync management panel to settings page"
```

---

## Task 6: DrugSearchDialog — Switch to Local DB Search

**Files:**
- Modify: `apps/web/src/components/drug-search-dialog.tsx`

**Step 1: Replace API fetch calls with searchMfdsItems action**

Key changes to `drug-search-dialog.tsx`:

1. Replace API endpoint imports with:
```typescript
import { searchMfdsItems } from "@/lib/actions";
import type { MfdsItem, MfdsSourceType } from "@/lib/types";
```

2. Change tab type:
```typescript
type SearchTab = "drug" | "device" | "device_std";
```

3. Replace the `search` function. Instead of calling `/api/drug-search`, `/api/device-search`, or `/api/device-std-search`, call:
```typescript
const result = await searchMfdsItems(tab, query, page, pageSize);
setResults(result.items);
setTotalCount(result.totalCount);
```

4. Update result rendering to use `MfdsItem` fields instead of `DrugSearchResult`/`DeviceSearchResult`/`DeviceStdSearchResult`. Since `MfdsItem` has unified field names, the rendering maps directly:
   - `item.item_name` (was `drug.item_name`, `device.prdlst_nm`, etc.)
   - `item.manufacturer` (was `drug.entp_name`, `device.mnft_clnt_nm`, etc.)
   - `item.rare_drug_yn` for drug badge
   - `item.classification_grade` for device grade badge

5. Update the "select" handler to use `MfdsItem` and set `mfds_item_id`:
```typescript
// mode === "fill"
onSelect?.({
  official_name: item.item_name,
  manufacturer: item.manufacturer,
  ingredient: item.main_item_ingr,
  standard_code: item.standard_code,
  mfds_item_id: item.id,
});

// mode === "create"
await createProduct({
  official_name: item.item_name,
  name: item.item_name,
  manufacturer: item.manufacturer,
  ingredient: item.main_item_ingr ?? item.use_purpose,
  efficacy: item.use_purpose,
  standard_code: item.standard_code,
  mfds_item_id: item.id,
  category: item.source_type === "drug" ? "medication" : "equipment",
});
```

6. Add sync status footer:
```tsx
<p className="text-xs text-muted-foreground text-center mt-2">
  ⓘ 로컬 DB 검색 · 마지막 동기화: {lastSyncDate}
</p>
```

7. Update `MedicalProductFill` interface to include `mfds_item_id`:
```typescript
interface MedicalProductFill {
  official_name: string;
  manufacturer: string | null;
  ingredient: string | null;
  standard_code: string | null;
  mfds_item_id: number;  // NEW
}
```

**Step 2: Update ProductFormDialog to handle mfds_item_id from fill**

In `product-list.tsx`, find the `onSelect` handler for `DrugSearchDialog` (around lines 544-558) and add:

```typescript
onSelect={(data: MedicalProductFill) => {
  setOfficialName(data.official_name);
  if (data.manufacturer) setManufacturer(data.manufacturer);
  if (data.ingredient) setIngredient(data.ingredient);
  if (data.standard_code) setStandardCode(data.standard_code);
  setMfdsItemId(data.mfds_item_id);  // NEW - store for submission
  toast.success("식약처 정보가 입력되었습니다.");
}}
```

Add `mfdsItemId` state to `ProductFormDialog`:
```typescript
const [mfdsItemId, setMfdsItemId] = useState<number | null>(product?.mfds_item_id ?? null);
```

Include in form submission data:
```typescript
const data = {
  // ... existing fields ...
  mfds_item_id: mfdsItemId,
};
```

**Step 3: Verify**

Run `npm run dev:web`, go to Products → click "식약처" button. Should search from local DB (fast, no network delay). Selecting an item should populate form + set `mfds_item_id`.

**Step 4: Commit**

```bash
git add apps/web/src/components/drug-search-dialog.tsx apps/web/src/components/product-list.tsx
git commit -m "feat(search): switch DrugSearchDialog from API to local mfds_items DB search"
```

---

## Task 7: Migration of Existing Data — auto_info → mfds_item_id

**Files:**
- Create: `packages/supabase/migrations/00023_mfds_backfill.sql`

**Step 1: Write the backfill migration**

```sql
-- Backfill: link existing products (created via MFDS API) to mfds_items
-- Run AFTER initial sync has populated mfds_items

-- Drug products
UPDATE products p SET mfds_item_id = m.id
FROM mfds_items m
WHERE p.auto_info->>'source' = 'mfds_drug_api'
  AND m.source_type = 'drug'
  AND m.source_key = p.auto_info->>'item_seq'
  AND p.mfds_item_id IS NULL;

-- Device products
UPDATE products p SET mfds_item_id = m.id
FROM mfds_items m
WHERE p.auto_info->>'source' = 'mfds_device_api'
  AND m.source_type = 'device'
  AND m.source_key = p.auto_info->>'prdlst_sn'
  AND p.mfds_item_id IS NULL;

-- Device Std products
UPDATE products p SET mfds_item_id = m.id
FROM mfds_items m
WHERE p.auto_info->>'source' = 'mfds_device_std_api'
  AND m.source_type = 'device_std'
  AND m.source_key = p.auto_info->>'udidi_cd'
  AND p.mfds_item_id IS NULL;
```

**Step 2: Apply after initial sync**

This migration should be run manually AFTER Task 3's Edge Function has been deployed and a full sync has completed. Do NOT apply it before mfds_items has data.

**Step 3: Commit**

```bash
git add packages/supabase/migrations/00023_mfds_backfill.sql
git commit -m "feat(db): add backfill migration to link existing products to mfds_items"
```

---

## Task 8: Cleanup — Remove Old API Routes

**Files:**
- Delete: `apps/web/src/app/api/drug-search/route.ts`
- Delete: `apps/web/src/app/api/device-search/route.ts`
- Delete: `apps/web/src/app/api/device-std-search/route.ts`

**Step 1: Verify no remaining references**

Search for imports/usage of these routes:
```bash
grep -r "drug-search\|device-search\|device-std-search" apps/web/src/ --include="*.ts" --include="*.tsx"
```

Expected: Only the route files themselves and possibly the old DrugSearchDialog (which was already updated in Task 6).

**Step 2: Remove the files**

```bash
rm apps/web/src/app/api/drug-search/route.ts
rm apps/web/src/app/api/device-search/route.ts
rm apps/web/src/app/api/device-std-search/route.ts
```

**Step 3: Remove unused type imports**

In `apps/web/src/lib/types.ts`, the old `DrugSearchResult`, `DrugSearchResponse`, `DeviceSearchResult`, `DeviceSearchResponse`, `DeviceStdSearchResult`, `DeviceStdSearchResponse` interfaces (lines 374-451) are no longer needed. Remove them.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove old MFDS API routes, replaced by local DB search"
```

---

## Task 9: pg_cron Setup — Daily Automatic Sync

**Files:**
- No code files — SQL executed in Supabase Dashboard

**Step 1: Set up pg_cron schedules**

Run in Supabase SQL Editor:

```sql
-- Enable extensions (if not already)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule: drug sync at KST 05:00 (UTC 20:00)
SELECT cron.schedule(
  'sync-mfds-drug',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-mfds',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"trigger":"scheduled","source":"drug"}'::jsonb
  );
  $$
);

-- Schedule: device sync at KST 05:05 (UTC 20:05)
SELECT cron.schedule(
  'sync-mfds-device',
  '5 20 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-mfds',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"trigger":"scheduled","source":"device"}'::jsonb
  );
  $$
);

-- Schedule: device_std sync at KST 05:10 (UTC 20:10)
SELECT cron.schedule(
  'sync-mfds-device-std',
  '10 20 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-mfds',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"trigger":"scheduled","source":"device_std"}'::jsonb
  );
  $$
);
```

**Step 2: Verify schedules**

```sql
SELECT * FROM cron.job WHERE jobname LIKE 'sync-mfds%';
```

Expected: 3 rows with correct schedules.

**Step 3: Document in design doc**

Note: pg_cron uses `current_setting()` which requires the Supabase URL and service role key to be set as custom PostgreSQL settings. Alternative: hardcode the URL and key directly in the cron SQL (less portable but simpler).

---

## Execution Order Summary

| Task | Dependency | Description |
|------|-----------|-------------|
| 1 | — | DB migration: mfds_items, mfds_sync_logs, products FK |
| 2 | — | TypeScript types |
| 3 | 1 | Edge Function: sync-mfds |
| 4 | 2 | Server actions: sync trigger, search |
| 5 | 4 | Settings page sync panel UI |
| 6 | 4 | DrugSearchDialog → local DB search |
| 7 | 3 (after first sync) | Backfill existing products |
| 8 | 6 | Remove old API routes |
| 9 | 3 | pg_cron setup |

Tasks 1 and 2 can run in parallel. Tasks 5 and 6 can run in parallel after Task 4.

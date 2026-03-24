# Search Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken search across all tables (my_drugs, my_devices, mfds_drugs, mfds_devices, hospitals, suppliers) by adding GIN trigram indexes and PostgreSQL RPC search functions with multi-column fuzzy matching.

**Architecture:** Create a single SQL migration that adds GIN trigram indexes to all searchable tables and creates RPC functions for each search domain. Client-side code switches from `.or(ilike)` to `.rpc()` calls. RPC functions combine `ILIKE` substring matching with `similarity()` scoring for ranked results.

**Tech Stack:** PostgreSQL pg_trgm extension, Supabase RPC, Next.js Server Actions

---

### Task 1: SQL Migration — Indexes + RPC Functions

**Files:**
- Create: `packages/supabase/migrations/00065_search_enhancement.sql`

- [ ] **Step 1: Create migration file with pg_trgm indexes for my_drugs**

```sql
-- 00065_search_enhancement.sql
-- Add GIN trigram indexes and search RPC functions for all searchable tables

-- ============================================================
-- 1. GIN trigram indexes for my_drugs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_my_drugs_item_name_trgm
  ON my_drugs USING gin (item_name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_my_drugs_entp_name_trgm
  ON my_drugs USING gin (entp_name extensions.gin_trgm_ops)
  WHERE entp_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_my_drugs_bar_code
  ON my_drugs (bar_code)
  WHERE bar_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_my_drugs_edi_code
  ON my_drugs (edi_code)
  WHERE edi_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_my_drugs_material_name_trgm
  ON my_drugs USING gin (material_name extensions.gin_trgm_ops)
  WHERE material_name IS NOT NULL;
```

- [ ] **Step 2: Add GIN trigram indexes for my_devices**

```sql
-- ============================================================
-- 2. GIN trigram indexes for my_devices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_my_devices_prdlst_nm_trgm
  ON my_devices USING gin (prdlst_nm extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_my_devices_entp_nm_trgm
  ON my_devices USING gin (mnft_iprt_entp_nm extensions.gin_trgm_ops)
  WHERE mnft_iprt_entp_nm IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_my_devices_udidi_cd
  ON my_devices (udidi_cd)
  WHERE udidi_cd IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_my_devices_foml_info_trgm
  ON my_devices USING gin (foml_info extensions.gin_trgm_ops)
  WHERE foml_info IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_my_devices_prdt_nm_info_trgm
  ON my_devices USING gin (prdt_nm_info extensions.gin_trgm_ops)
  WHERE prdt_nm_info IS NOT NULL;
```

- [ ] **Step 3: Add GIN trigram indexes for hospitals**

```sql
-- ============================================================
-- 3. GIN trigram indexes for hospitals
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_hospitals_name_trgm
  ON hospitals USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_hospitals_short_name_trgm
  ON hospitals USING gin (short_name extensions.gin_trgm_ops)
  WHERE short_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hospitals_address_trgm
  ON hospitals USING gin (address extensions.gin_trgm_ops)
  WHERE address IS NOT NULL;
```

- [ ] **Step 4: Add GIN trigram indexes for suppliers**

```sql
-- ============================================================
-- 4. GIN trigram indexes for suppliers
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm
  ON suppliers USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_suppliers_short_name_trgm
  ON suppliers USING gin (short_name extensions.gin_trgm_ops)
  WHERE short_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_business_category_trgm
  ON suppliers USING gin (business_category extensions.gin_trgm_ops)
  WHERE business_category IS NOT NULL;
```

- [ ] **Step 5: Create search_my_items RPC function**

This function searches both my_drugs and my_devices, returning unified results ranked by relevance.

```sql
-- ============================================================
-- 5. RPC: search_my_items(query, source_type, result_limit)
-- ============================================================
CREATE OR REPLACE FUNCTION search_my_items(
  query TEXT,
  source_type TEXT DEFAULT 'all',
  result_limit INT DEFAULT 30
)
RETURNS TABLE (
  id INT,
  item_type TEXT,
  name TEXT,
  code TEXT,
  manufacturer TEXT,
  unit_price NUMERIC,
  rank REAL,
  raw_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  q TEXT := trim(query);
  like_q TEXT := '%' || q || '%';
BEGIN
  IF q = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH drug_matches AS (
    SELECT
      d.id,
      'drug'::TEXT AS item_type,
      d.item_name AS name,
      COALESCE(d.bar_code, d.edi_code) AS code,
      d.entp_name AS manufacturer,
      d.unit_price,
      GREATEST(
        extensions.similarity(COALESCE(d.item_name, ''), q),
        extensions.similarity(COALESCE(d.entp_name, ''), q),
        extensions.similarity(COALESCE(d.bar_code, ''), q),
        extensions.similarity(COALESCE(d.edi_code, ''), q),
        extensions.similarity(COALESCE(d.material_name, ''), q)
      ) AS sim_score,
      CASE
        WHEN d.item_name ILIKE like_q THEN 1
        WHEN d.bar_code ILIKE like_q OR d.edi_code ILIKE like_q THEN 1
        WHEN d.entp_name ILIKE like_q THEN 1
        WHEN d.material_name ILIKE like_q THEN 1
        WHEN d.pack_unit ILIKE like_q THEN 1
        ELSE 0
      END AS ilike_match,
      to_jsonb(d) AS raw_data
    FROM my_drugs d
    WHERE source_type IN ('all', 'drug')
      AND (
        d.item_name ILIKE like_q
        OR d.entp_name ILIKE like_q
        OR d.bar_code ILIKE like_q
        OR d.edi_code ILIKE like_q
        OR d.material_name ILIKE like_q
        OR d.pack_unit ILIKE like_q
        OR extensions.similarity(d.item_name, q) > 0.15
        OR extensions.similarity(d.entp_name, q) > 0.15
      )
  ),
  device_matches AS (
    SELECT
      d.id,
      'device'::TEXT AS item_type,
      d.prdlst_nm AS name,
      d.udidi_cd AS code,
      d.mnft_iprt_entp_nm AS manufacturer,
      d.unit_price,
      GREATEST(
        extensions.similarity(COALESCE(d.prdlst_nm, ''), q),
        extensions.similarity(COALESCE(d.mnft_iprt_entp_nm, ''), q),
        extensions.similarity(COALESCE(d.udidi_cd, ''), q),
        extensions.similarity(COALESCE(d.foml_info, ''), q),
        extensions.similarity(COALESCE(d.prdt_nm_info, ''), q)
      ) AS sim_score,
      CASE
        WHEN d.prdlst_nm ILIKE like_q THEN 1
        WHEN d.udidi_cd ILIKE like_q OR d.permit_no ILIKE like_q THEN 1
        WHEN d.mnft_iprt_entp_nm ILIKE like_q THEN 1
        WHEN d.foml_info ILIKE like_q THEN 1
        WHEN d.prdt_nm_info ILIKE like_q THEN 1
        ELSE 0
      END AS ilike_match,
      to_jsonb(d) AS raw_data
    FROM my_devices d
    WHERE source_type IN ('all', 'device')
      AND (
        d.prdlst_nm ILIKE like_q
        OR d.mnft_iprt_entp_nm ILIKE like_q
        OR d.udidi_cd ILIKE like_q
        OR d.foml_info ILIKE like_q
        OR d.prdt_nm_info ILIKE like_q
        OR d.permit_no ILIKE like_q
        OR extensions.similarity(d.prdlst_nm, q) > 0.15
        OR extensions.similarity(d.mnft_iprt_entp_nm, q) > 0.15
      )
  )
  SELECT m.id, m.item_type, m.name, m.code, m.manufacturer, m.unit_price,
         (m.ilike_match::REAL + m.sim_score) AS rank,
         m.raw_data
  FROM (
    SELECT * FROM drug_matches
    UNION ALL
    SELECT * FROM device_matches
  ) m
  ORDER BY m.ilike_match DESC, m.sim_score DESC
  LIMIT result_limit;
END;
$$;
```

- [ ] **Step 6: Create search_mfds_items RPC function**

```sql
-- ============================================================
-- 6. RPC: search_mfds_items(query, source_type, result_limit, page_num, page_size)
-- ============================================================
CREATE OR REPLACE FUNCTION search_mfds_items(
  query TEXT,
  source_type TEXT DEFAULT 'drug',
  result_limit INT DEFAULT 30,
  page_num INT DEFAULT 1,
  page_size INT DEFAULT 30
)
RETURNS TABLE (
  id BIGINT,
  item_type TEXT,
  name TEXT,
  code TEXT,
  manufacturer TEXT,
  rank REAL,
  raw_data JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  q TEXT := trim(query);
  like_q TEXT := '%' || q || '%';
  off_set INT := (page_num - 1) * page_size;
BEGIN
  IF q = '' THEN
    -- Return all items paginated when no query
    IF source_type = 'drug' THEN
      RETURN QUERY
      SELECT d.id, 'drug'::TEXT, d.item_name, d.bar_code, d.entp_name,
             0::REAL, to_jsonb(d), count(*) OVER()
      FROM mfds_drugs d
      ORDER BY d.item_name
      LIMIT page_size OFFSET off_set;
    ELSE
      RETURN QUERY
      SELECT d.id, 'device'::TEXT, d.prdlst_nm, d.udidi_cd, d.mnft_iprt_entp_nm,
             0::REAL, to_jsonb(d), count(*) OVER()
      FROM mfds_devices d
      ORDER BY d.prdlst_nm
      LIMIT page_size OFFSET off_set;
    END IF;
    RETURN;
  END IF;

  IF source_type = 'drug' THEN
    RETURN QUERY
    SELECT d.id, 'drug'::TEXT, d.item_name, d.bar_code, d.entp_name,
           GREATEST(
             extensions.similarity(COALESCE(d.item_name, ''), q),
             extensions.similarity(COALESCE(d.entp_name, ''), q),
             extensions.similarity(COALESCE(d.bar_code, ''), q)
           ) AS rank,
           to_jsonb(d),
           count(*) OVER()
    FROM mfds_drugs d
    WHERE d.item_name ILIKE like_q
       OR d.entp_name ILIKE like_q
       OR d.bar_code ILIKE like_q
       OR d.edi_code ILIKE like_q
       OR d.atc_code ILIKE like_q
       OR d.material_name ILIKE like_q
       OR d.main_item_ingr ILIKE like_q
       OR extensions.similarity(d.item_name, q) > 0.15
       OR extensions.similarity(d.entp_name, q) > 0.15
    ORDER BY
      CASE WHEN d.item_name ILIKE like_q THEN 0 ELSE 1 END,
      extensions.similarity(COALESCE(d.item_name, ''), q) DESC
    LIMIT page_size OFFSET off_set;
  ELSE
    RETURN QUERY
    SELECT d.id, 'device'::TEXT, d.prdlst_nm, d.udidi_cd, d.mnft_iprt_entp_nm,
           GREATEST(
             extensions.similarity(COALESCE(d.prdlst_nm, ''), q),
             extensions.similarity(COALESCE(d.mnft_iprt_entp_nm, ''), q),
             extensions.similarity(COALESCE(d.udidi_cd, ''), q)
           ) AS rank,
           to_jsonb(d),
           count(*) OVER()
    FROM mfds_devices d
    WHERE d.prdlst_nm ILIKE like_q
       OR d.mnft_iprt_entp_nm ILIKE like_q
       OR d.udidi_cd ILIKE like_q
       OR d.permit_no ILIKE like_q
       OR d.foml_info ILIKE like_q
       OR d.prdt_nm_info ILIKE like_q
       OR d.use_purps_cont ILIKE like_q
       OR extensions.similarity(d.prdlst_nm, q) > 0.15
       OR extensions.similarity(d.mnft_iprt_entp_nm, q) > 0.15
    ORDER BY
      CASE WHEN d.prdlst_nm ILIKE like_q THEN 0 ELSE 1 END,
      extensions.similarity(COALESCE(d.prdlst_nm, ''), q) DESC
    LIMIT page_size OFFSET off_set;
  END IF;
END;
$$;
```

- [ ] **Step 7: Create search_hospitals RPC function**

```sql
-- ============================================================
-- 7. RPC: search_hospitals(query, result_limit)
-- ============================================================
CREATE OR REPLACE FUNCTION search_hospitals(
  query TEXT,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id INT,
  name VARCHAR,
  short_name VARCHAR,
  address TEXT,
  contact_person VARCHAR,
  phone VARCHAR,
  hospital_type TEXT,
  rank REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  q TEXT := trim(query);
  like_q TEXT := '%' || q || '%';
BEGIN
  IF q = '' THEN
    RETURN QUERY
    SELECT h.id, h.name, h.short_name, h.address, h.contact_person,
           h.phone, h.hospital_type::TEXT, 0::REAL
    FROM hospitals h
    WHERE h.is_active = true
    ORDER BY h.name
    LIMIT result_limit;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT h.id, h.name, h.short_name, h.address, h.contact_person,
         h.phone, h.hospital_type::TEXT,
         GREATEST(
           extensions.similarity(COALESCE(h.name::TEXT, ''), q),
           extensions.similarity(COALESCE(h.short_name::TEXT, ''), q),
           extensions.similarity(COALESCE(h.address, ''), q),
           extensions.similarity(COALESCE(h.contact_person::TEXT, ''), q)
         ) AS rank
  FROM hospitals h
  WHERE h.is_active = true
    AND (
      h.name ILIKE like_q
      OR h.short_name ILIKE like_q
      OR h.address ILIKE like_q
      OR h.contact_person ILIKE like_q
      OR h.business_number ILIKE like_q
      OR extensions.similarity(h.name::TEXT, q) > 0.15
      OR extensions.similarity(COALESCE(h.short_name::TEXT, ''), q) > 0.15
    )
  ORDER BY
    CASE WHEN h.name ILIKE like_q THEN 0 ELSE 1 END,
    GREATEST(
      extensions.similarity(COALESCE(h.name::TEXT, ''), q),
      extensions.similarity(COALESCE(h.short_name::TEXT, ''), q)
    ) DESC
  LIMIT result_limit;
END;
$$;
```

- [ ] **Step 8: Create search_suppliers RPC function**

```sql
-- ============================================================
-- 8. RPC: search_suppliers(query, result_limit)
-- ============================================================
CREATE OR REPLACE FUNCTION search_suppliers(
  query TEXT,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id INT,
  name VARCHAR,
  short_name VARCHAR,
  phone VARCHAR,
  ceo_name VARCHAR,
  business_category VARCHAR,
  rank REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  q TEXT := trim(query);
  like_q TEXT := '%' || q || '%';
BEGIN
  IF q = '' THEN
    RETURN QUERY
    SELECT s.id, s.name, s.short_name, s.phone, s.ceo_name,
           s.business_category, 0::REAL
    FROM suppliers s
    WHERE s.is_active = true
    ORDER BY s.name
    LIMIT result_limit;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.id, s.name, s.short_name, s.phone, s.ceo_name,
         s.business_category,
         GREATEST(
           extensions.similarity(COALESCE(s.name::TEXT, ''), q),
           extensions.similarity(COALESCE(s.short_name::TEXT, ''), q),
           extensions.similarity(COALESCE(s.ceo_name::TEXT, ''), q),
           extensions.similarity(COALESCE(s.business_category::TEXT, ''), q)
         ) AS rank
  FROM suppliers s
  WHERE s.is_active = true
    AND (
      s.name ILIKE like_q
      OR s.short_name ILIKE like_q
      OR s.ceo_name ILIKE like_q
      OR s.business_category ILIKE like_q
      OR s.business_number ILIKE like_q
      OR extensions.similarity(s.name::TEXT, q) > 0.15
      OR extensions.similarity(COALESCE(s.short_name::TEXT, ''), q) > 0.15
    )
  ORDER BY
    CASE WHEN s.name ILIKE like_q THEN 0 ELSE 1 END,
    GREATEST(
      extensions.similarity(COALESCE(s.name::TEXT, ''), q),
      extensions.similarity(COALESCE(s.short_name::TEXT, ''), q)
    ) DESC
  LIMIT result_limit;
END;
$$;
```

- [ ] **Step 9: Grant RPC execute permissions**

```sql
-- ============================================================
-- 9. Permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION search_my_items(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_mfds_items(TEXT, TEXT, INT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_hospitals(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_suppliers(TEXT, INT) TO authenticated;
```

- [ ] **Step 10: Apply migration locally**

Run: `cd /Users/hartmacm4/Documents/Notiflow && npx supabase migration up --local`
Expected: Migration applied successfully

- [ ] **Step 11: Commit**

```bash
git add packages/supabase/migrations/00065_search_enhancement.sql
git commit -m "feat: add GIN trigram indexes and search RPC functions for all tables"
```

---

### Task 2: Update queries/products.ts — searchMyItems

**Files:**
- Modify: `apps/web/src/lib/queries/products.ts`

- [ ] **Step 1: Replace searchMyItems with RPC call**

Replace the existing `searchMyItems` function (lines 37-95) with:

```typescript
export async function searchMyItems(query: string): Promise<Array<{
  id: number;
  type: "drug" | "device";
  name: string;
  code: string | null;
  manufacturer: string | null;
  unit_price: number | null;
  raw: Record<string, unknown>;
}>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_my_items", {
    query,
    source_type: "all",
    result_limit: 30,
  });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as number,
    type: row.item_type as "drug" | "device",
    name: (row.name as string) ?? "",
    code: (row.code as string) ?? null,
    manufacturer: (row.manufacturer as string) ?? null,
    unit_price: row.unit_price as number | null,
    raw: (row.raw_data as Record<string, unknown>) ?? {},
  }));
}
```

- [ ] **Step 2: Verify the web app builds**

Run: `cd /Users/hartmacm4/Documents/Notiflow && npm run lint:web`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/queries/products.ts
git commit -m "refactor: use search_my_items RPC in products query"
```

---

### Task 3: Update queries/hospitals.ts — getHospitals search

**Files:**
- Modify: `apps/web/src/lib/queries/hospitals.ts`

- [ ] **Step 1: Add searchHospitals function using RPC**

Add this function after the existing `getHospital` function. Do NOT remove `getHospitals` — it's still used for listing without search.

```typescript
export async function searchHospitalsRpc(query: string, limit: number = 20): Promise<Array<{
  id: number;
  name: string;
  short_name: string | null;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  hospital_type: string;
}>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_hospitals", {
    query,
    result_limit: limit,
  });

  if (error) throw error;
  return (data ?? []) as Array<{
    id: number;
    name: string;
    short_name: string | null;
    address: string | null;
    contact_person: string | null;
    phone: string | null;
    hospital_type: string;
  }>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/queries/hospitals.ts
git commit -m "feat: add searchHospitalsRpc using trigram search"
```

---

### Task 4: Update queries/suppliers.ts — getSuppliers search

**Files:**
- Modify: `apps/web/src/lib/queries/suppliers.ts`

- [ ] **Step 1: Add searchSuppliersRpc function using RPC**

Add this function after the existing `getSupplier` function:

```typescript
export async function searchSuppliersRpc(query: string, limit: number = 20): Promise<Array<{
  id: number;
  name: string;
  short_name: string | null;
  phone: string | null;
  ceo_name: string | null;
  business_category: string | null;
}>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_suppliers", {
    query,
    result_limit: limit,
  });

  if (error) throw error;
  return (data ?? []) as Array<{
    id: number;
    name: string;
    short_name: string | null;
    phone: string | null;
    ceo_name: string | null;
    business_category: string | null;
  }>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/queries/suppliers.ts
git commit -m "feat: add searchSuppliersRpc using trigram search"
```

---

### Task 5: Update actions.ts — searchMyItems and searchMfdsItems

**Files:**
- Modify: `apps/web/src/lib/actions.ts`

- [ ] **Step 1: Update searchMyItems server action (line 713)**

Replace the `searchMyItems` function in actions.ts with:

```typescript
export async function searchMyItems(params: { query: string; sourceType: string; page?: number; pageSize?: number; filters?: { field: string; operator: string; value: string }[]; sortBy?: string; sortOrder?: string; searchField?: string }) {
  const { query, sourceType, page = 1, pageSize = 30, filters = [] } = params;
  const supabase = await createClient();
  const q = query.trim();

  // Use RPC for the main search
  const { data, error } = await supabase.rpc("search_my_items", {
    query: q,
    source_type: sourceType === "drug" ? "drug" : "device",
    result_limit: pageSize * page, // fetch enough for pagination
  });

  if (error) throw error;

  let items = (data ?? []).map((row: Record<string, unknown>) => {
    const raw = (row.raw_data as Record<string, unknown>) ?? {};
    const mapped: Record<string, unknown> = { ...raw };
    Object.entries(raw).forEach(([k, v]) => {
      if (!["id", "unit_price", "added_at", "synced_at"].includes(k)) mapped[k.toUpperCase()] = v;
    });
    return mapped;
  });

  // Apply additional client-side filters
  for (const chip of filters) {
    const dbCol = chip.field.toLowerCase();
    items = items.filter((item) => {
      const val = String(item[dbCol] ?? "");
      if (chip.operator === "contains") return val.toLowerCase().includes(chip.value.toLowerCase());
      if (chip.operator === "equals") return val === chip.value;
      return true;
    });
  }

  const totalCount = items.length;
  const from = (page - 1) * pageSize;
  const paged = items.slice(from, from + pageSize);

  return { items: paged, totalCount, page };
}
```

- [ ] **Step 2: Update searchMfdsItems server action (line 744)**

Replace the `searchMfdsItems` function in actions.ts with:

```typescript
export async function searchMfdsItems(params: { query: string; sourceType: string; page?: number; pageSize?: number; filters?: { field: string; value: string }[]; sortOrder?: string; searchField?: string }) {
  const { query, sourceType, page = 1, pageSize = 30, filters = [] } = params;
  const supabase = await createClient();
  const q = query.trim();

  const { data, error } = await supabase.rpc("search_mfds_items", {
    query: q,
    source_type: sourceType === "drug" ? "drug" : "device",
    result_limit: pageSize,
    page_num: page,
    page_size: pageSize,
  });

  if (error) throw error;

  const totalCount = (data?.[0] as Record<string, unknown>)?.total_count as number ?? 0;

  let items = (data ?? []).map((row: Record<string, unknown>) => {
    const raw = (row.raw_data as Record<string, unknown>) ?? {};
    return { ...raw, _type: sourceType };
  });

  // Apply additional chip filters client-side
  for (const chip of filters) {
    items = items.filter((item) => {
      const val = String(item[chip.field.toLowerCase()] ?? "");
      return val.toLowerCase().includes(chip.value.toLowerCase());
    });
  }

  return { items, totalCount: Number(totalCount), page };
}
```

- [ ] **Step 3: Verify lint passes**

Run: `cd /Users/hartmacm4/Documents/Notiflow && npm run lint:web`
Expected: No errors

- [ ] **Step 4: Remove unused escapeFilterValue import if no longer used**

Check if `escapeFilterValue` and `escapeLikeValue` are still used elsewhere in actions.ts. If not, remove the import. But they are likely still used in other functions — only remove if truly unused.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "refactor: use search RPC functions in searchMyItems and searchMfdsItems"
```

---

### Task 6: Update orders/actions.ts — Search Actions for Order Creation

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/actions.ts`

- [ ] **Step 1: Update searchMyItemsAction to use RPC**

Replace `searchMyItemsAction` (line 72):

```typescript
export async function searchMyItemsAction(query: string) {
  if (!query || query.length < 1) return [];
  const { searchMyItems } = await import("@/lib/queries/products");
  return searchMyItems(query);
}
```

No change needed — this already delegates to `queries/products.ts` which was updated in Task 2.

- [ ] **Step 2: Update searchHospitalsAction to use RPC**

Replace `searchHospitalsAction` (line 78):

```typescript
export async function searchHospitalsAction(query: string) {
  if (!query || query.length < 1) return [];
  const { searchHospitalsRpc } = await import("@/lib/queries/hospitals");
  const results = await searchHospitalsRpc(query, 20);
  return results.map((h) => ({ id: h.id, name: h.name, contact_person: h.contact_person ?? null }));
}
```

- [ ] **Step 3: Update searchSuppliersAction to use RPC**

Replace `searchSuppliersAction` (line 85):

```typescript
export async function searchSuppliersAction(query: string) {
  if (!query || query.length < 1) return [];
  const { searchSuppliersRpc } = await import("@/lib/queries/suppliers");
  const results = await searchSuppliersRpc(query, 20);
  return results.map((s) => ({ id: s.id, name: s.name }));
}
```

- [ ] **Step 4: Update searchMfdsItemsAction to use RPC**

Replace `searchMfdsItemsAction` (line 326):

```typescript
export async function searchMfdsItemsAction(query: string) {
  if (!query || query.length < 1) return [];
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_mfds_items", {
    query: query.trim(),
    source_type: "drug",
    result_limit: 30,
    page_num: 1,
    page_size: 30,
  });
  if (error) return [];

  const { data: devData } = await supabase.rpc("search_mfds_items", {
    query: query.trim(),
    source_type: "device",
    result_limit: 15,
    page_num: 1,
    page_size: 15,
  });

  const results = [
    ...(data ?? []).map((d: Record<string, unknown>) => ({
      id: d.id as number, name: d.name as string, code: (d.code as string) ?? "",
      source_type: "drug" as const, manufacturer: d.manufacturer as string,
    })),
    ...(devData ?? []).map((d: Record<string, unknown>) => ({
      id: d.id as number, name: d.name as string, code: (d.code as string) ?? "",
      source_type: "device_std" as const, manufacturer: d.manufacturer as string,
    })),
  ];
  return results.slice(0, 30);
}
```

- [ ] **Step 5: Verify lint passes**

Run: `cd /Users/hartmacm4/Documents/Notiflow && npm run lint:web`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(dashboard)/orders/actions.ts
git commit -m "refactor: use search RPC functions in order creation actions"
```

---

### Task 7: Verify & Test

- [ ] **Step 1: Start local Supabase and apply migration**

Run: `cd /Users/hartmacm4/Documents/Notiflow && npx supabase migration up --local`

- [ ] **Step 2: Start web dev server**

Run: `npm run dev:web`

- [ ] **Step 3: Manual verification checklist**

Test each search function via the web UI:
1. Orders → New Order → Hospital search: type partial name (e.g., "서울") → should return hospitals with "서울" in name, short_name, or address
2. Orders → New Order → Product search: type product name (e.g., "투석") → should return matching drugs and devices
3. Products → MFDS tab → search drugs and devices by name, code, manufacturer
4. Products → My Items tab → search by partial name, code
5. Suppliers list → search by name, short_name, CEO name

- [ ] **Step 4: Verify build passes**

Run: `npm run build:web`
Expected: Build succeeds

- [ ] **Step 5: Final commit if any fixes needed**

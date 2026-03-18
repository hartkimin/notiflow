# Partner Product Aliases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-company aliases to partner products (취급품목 별칭) for search matching in both supplier and hospital tabs.

**Architecture:** New `partner_product_aliases` table with FK to `partner_products`. Server actions for CRUD. Client-side alias display as inline Badge chips in `PartnerProductManager` with optimistic delete. Client-side search filtering extended to include aliases.

**Tech Stack:** PostgreSQL (Supabase migrations), Next.js Server Actions, React (shadcn/ui Badge, sonner toast), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-18-partner-product-aliases-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `packages/supabase/migrations/00042_partner_product_aliases.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 00042_partner_product_aliases.sql
-- Per-partner-product aliases for search matching

-- 1. Normalization function: strips whitespace, punctuation, lowercases
CREATE OR REPLACE FUNCTION normalize_alias(input TEXT) RETURNS TEXT AS $$
  SELECT lower(regexp_replace(input, '[[:space:][:punct:]]', '', 'g'));
$$ LANGUAGE sql IMMUTABLE;

-- 2. Table
CREATE TABLE partner_product_aliases (
  id                 SERIAL PRIMARY KEY,
  partner_product_id INTEGER NOT NULL REFERENCES partner_products(id) ON DELETE CASCADE,
  alias              TEXT NOT NULL CHECK (char_length(alias) BETWEEN 1 AND 50),
  alias_normalized   TEXT NOT NULL CHECK (alias_normalized <> ''),
  match_count        INTEGER NOT NULL DEFAULT 0,
  last_matched_at    TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Unique constraint: same item can't have duplicate normalized alias
ALTER TABLE partner_product_aliases
  ADD CONSTRAINT uq_partner_product_alias UNIQUE (partner_product_id, alias_normalized);

-- 4. Indexes
CREATE INDEX idx_ppa_partner_product ON partner_product_aliases(partner_product_id);
CREATE INDEX idx_ppa_alias_trgm ON partner_product_aliases USING gin (alias_normalized gin_trgm_ops);

-- 5. Trigger: max 5 aliases per partner_product
CREATE OR REPLACE FUNCTION check_alias_limit() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM partner_product_aliases WHERE partner_product_id = NEW.partner_product_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 aliases per partner product';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alias_limit
  BEFORE INSERT ON partner_product_aliases
  FOR EACH ROW EXECUTE FUNCTION check_alias_limit();

-- 6. Trigger: unique alias within same partner (partner_type + partner_id)
CREATE OR REPLACE FUNCTION check_alias_unique_per_partner() RETURNS TRIGGER AS $$
DECLARE
  _partner_type TEXT;
  _partner_id INT;
  _conflict_name TEXT;
BEGIN
  SELECT partner_type, partner_id INTO _partner_type, _partner_id
    FROM partner_products WHERE id = NEW.partner_product_id;

  SELECT pp.standard_code INTO _conflict_name
    FROM partner_product_aliases ppa
    JOIN partner_products pp ON pp.id = ppa.partner_product_id
    WHERE pp.partner_type = _partner_type
      AND pp.partner_id = _partner_id
      AND ppa.alias_normalized = NEW.alias_normalized
      AND ppa.partner_product_id <> NEW.partner_product_id
    LIMIT 1;

  IF _conflict_name IS NOT NULL THEN
    RAISE EXCEPTION 'Alias already used by another product in this partner (code: %)', _conflict_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alias_unique_per_partner
  BEFORE INSERT ON partner_product_aliases
  FOR EACH ROW EXECUTE FUNCTION check_alias_unique_per_partner();

-- 7. updated_at trigger (reuse existing function)
CREATE TRIGGER update_partner_product_aliases_updated_at
  BEFORE UPDATE ON partner_product_aliases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. RLS (permissive, matching partner_products pattern)
ALTER TABLE partner_product_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for partner_product_aliases"
  ON partner_product_aliases FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated full access for partner_product_aliases"
  ON partner_product_aliases FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 2: Apply migration and verify**

Run: `cd /c/Users/Gram_M/Documents/Projects/01_NotiRoute/notiflow && npm run supabase:reset`

Expected: All 42 migrations applied successfully. Verify with:

```bash
cd /c/Users/Gram_M/Documents/Projects/01_NotiRoute/notiflow && npx supabase db reset 2>&1 | tail -5
```

- [ ] **Step 3: Test normalize_alias with Korean input**

Run in Supabase SQL editor or via psql:

```sql
SELECT normalize_alias('투석 필터');        -- expect: '투석필터'
SELECT normalize_alias('FMC-필터(소)');     -- expect: 'fmc필터소'
SELECT normalize_alias('---');              -- expect: '' (empty)
SELECT normalize_alias('Blood Line #3');   -- expect: 'bloodline3'
```

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/migrations/00042_partner_product_aliases.sql
git commit -m "feat: add partner_product_aliases table with triggers and RLS"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `apps/web/src/lib/types.ts` (append at end)

- [ ] **Step 1: Add PartnerProductAlias interface**

Append to `apps/web/src/lib/types.ts`:

```typescript
export interface PartnerProductAlias {
  id: number;
  partner_product_id: number;
  alias: string;
  alias_normalized: string;
  match_count: number;
  last_matched_at: string | null;
  created_at: string;
}

```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat: add PartnerProductAlias type definitions"
```

---

### Task 3: Server Actions

**Files:**
- Modify: `apps/web/src/lib/actions.ts`

These actions go after the existing `deletePartnerProduct` function (around line 501).

- [ ] **Step 1: Add normalizeAlias helper**

Add before the alias server actions in `actions.ts` (around line 502):

```typescript
// --- Partner Product Aliases ---

/** Client-side normalization matching the DB normalize_alias() function */
function normalizeAlias(input: string): string {
  return input.toLowerCase().replace(/[\s\p{P}]/gu, "");
}
```

> **Note:** The `\p{P}` Unicode property matches the same punctuation characters as PostgreSQL's `[:punct:]` POSIX class. The `u` flag enables Unicode mode.

- [ ] **Step 2: Add addPartnerProductAlias action**

Add after the normalizeAlias helper:

```typescript
export async function addPartnerProductAlias(partnerProductId: number, alias: string) {
  const trimmed = alias.trim();
  if (!trimmed) return { success: false, error: "별칭을 입력해주세요" };
  if (trimmed.length > 50) return { success: false, error: "별칭은 50자 이내로 입력해주세요" };

  const normalized = normalizeAlias(trimmed);
  if (!normalized) return { success: false, error: "유효한 문자를 포함한 별칭을 입력해주세요" };

  const supabase = await createClient();

  try {
    // Get partner info for this partner_product
    const { data: pp } = await supabase
      .from("partner_products")
      .select("id, partner_type, partner_id")
      .eq("id", partnerProductId)
      .single();
    if (!pp) return { success: false, error: "품목을 찾을 수 없습니다" };

    // Check alias count
    const { count } = await supabase
      .from("partner_product_aliases")
      .select("id", { count: "exact", head: true })
      .eq("partner_product_id", partnerProductId);
    if ((count ?? 0) >= 5) return { success: false, error: "별칭은 최대 5개까지 등록할 수 있습니다" };

    // Check same-item duplicate
    const { data: sameDup } = await supabase
      .from("partner_product_aliases")
      .select("id")
      .eq("partner_product_id", partnerProductId)
      .eq("alias_normalized", normalized)
      .maybeSingle();
    if (sameDup) return { success: false, error: "이미 등록된 별칭입니다" };

    // Check same-partner different-item duplicate
    const { data: partnerDup } = await supabase
      .from("partner_product_aliases")
      .select("partner_product_id")
      .eq("alias_normalized", normalized)
      .neq("partner_product_id", partnerProductId);

    if (partnerDup && partnerDup.length > 0) {
      // Check if any of these belong to the same partner
      const dupPpIds = partnerDup.map(d => d.partner_product_id);
      const { data: samePartnerPps } = await supabase
        .from("partner_products")
        .select("id, standard_code")
        .eq("partner_type", pp.partner_type)
        .eq("partner_id", pp.partner_id)
        .in("id", dupPpIds);

      if (samePartnerPps && samePartnerPps.length > 0) {
        const conflictCode = samePartnerPps[0].standard_code || "코드없음";
        return {
          success: false,
          error: `'${trimmed}'은(는) 다른 품목(${conflictCode})에 이미 사용 중입니다`,
        };
      }
    }

    // Insert
    const { data, error } = await supabase
      .from("partner_product_aliases")
      .insert({
        partner_product_id: partnerProductId,
        alias: trimmed,
        alias_normalized: normalized,
      })
      .select("id, alias, alias_normalized")
      .single();

    if (error) throw error;
    revalidatePath("/suppliers");
    revalidatePath("/hospitals");
    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
```

- [ ] **Step 3: Add deletePartnerProductAlias action**

Add after addPartnerProductAlias:

```typescript
export async function deletePartnerProductAlias(aliasId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_product_aliases")
    .delete()
    .eq("id", aliasId);
  if (error) throw error;
  revalidatePath("/suppliers");
  revalidatePath("/hospitals");
  return { success: true };
}
```

- [ ] **Step 4: Modify getPartnerProducts to include aliases**

In the existing `getPartnerProducts` function (`actions.ts:432`), modify the return mapping to include aliases. After the three parallel queries (line 442-446), add an aliases query:

Change from:
```typescript
const [pRes, drRes, dvRes] = await Promise.all([
  productIds.length > 0 ? supabase.from("products").select("id, name, standard_code").in("id", productIds) : { data: [] },
  drugIds.length > 0 ? supabase.from("my_drugs").select("id, item_name, bar_code").in("id", drugIds) : { data: [] },
  deviceIds.length > 0 ? supabase.from("my_devices").select("id, prdlst_nm, udidi_cd").in("id", deviceIds) : { data: [] },
]);
```

Change to:
```typescript
const ppIds = mappings.map(m => m.id);
const [pRes, drRes, dvRes, aliasRes] = await Promise.all([
  productIds.length > 0 ? supabase.from("products").select("id, name, standard_code").in("id", productIds) : { data: [] },
  drugIds.length > 0 ? supabase.from("my_drugs").select("id, item_name, bar_code").in("id", drugIds) : { data: [] },
  deviceIds.length > 0 ? supabase.from("my_devices").select("id, prdlst_nm, udidi_cd").in("id", deviceIds) : { data: [] },
  supabase.from("partner_product_aliases").select("id, partner_product_id, alias").in("partner_product_id", ppIds),
]);
```

Then build an alias map and include it in the return. Change from:
```typescript
return mappings.map(item => {
  let name = "알 수 없는 품목", code = item.standard_code || "";
  if (item.product_source === "product") { const p = pMap.get(item.product_id); if (p) { name = p.name; code = p.standard_code || code; } }
  else if (item.product_source === "drug") { const d = drMap.get(item.product_id); if (d) { name = d.item_name; code = d.bar_code || code; } }
  else if (item.product_source === "device") { const v = dvMap.get(item.product_id); if (v) { name = v.prdlst_nm; code = v.udidi_cd || code; } }
  return { ...item, name, code };
});
```

Change to:
```typescript
// Build alias map: partner_product_id → [{id, alias}]
const aliasMap = new Map<number, { id: number; alias: string }[]>();
for (const a of aliasRes.data ?? []) {
  const list = aliasMap.get(a.partner_product_id) ?? [];
  list.push({ id: a.id, alias: a.alias });
  aliasMap.set(a.partner_product_id, list);
}

return mappings.map(item => {
  let name = "알 수 없는 품목", code = item.standard_code || "";
  if (item.product_source === "product") { const p = pMap.get(item.product_id); if (p) { name = p.name; code = p.standard_code || code; } }
  else if (item.product_source === "drug") { const d = drMap.get(item.product_id); if (d) { name = d.item_name; code = d.bar_code || code; } }
  else if (item.product_source === "device") { const v = dvMap.get(item.product_id); if (v) { name = v.prdlst_nm; code = v.udidi_cd || code; } }
  return { ...item, name, code, aliases: aliasMap.get(item.id) ?? [] };
});
```

- [ ] **Step 5: Add imports for the new actions in partner-product-manager.tsx**

In `apps/web/src/components/partner-product-manager.tsx:16-18`, add the new imports:

Change from:
```typescript
import {
  getPartnerProducts, addPartnerProduct, deletePartnerProduct,
  updatePartnerProductPrice, searchMfdsItems, searchMyItems,
  addToMyDrugs, addToMyDevices
} from "@/lib/actions";
```

Change to:
```typescript
import {
  getPartnerProducts, addPartnerProduct, deletePartnerProduct,
  updatePartnerProductPrice, searchMfdsItems, searchMyItems,
  addToMyDrugs, addToMyDevices,
  addPartnerProductAlias, deletePartnerProductAlias
} from "@/lib/actions";
```

- [ ] **Step 6: Verify build**

Run: `cd /c/Users/Gram_M/Documents/Projects/01_NotiRoute/notiflow && npm run build:web 2>&1 | tail -10`

Expected: Build succeeds (no type errors from new actions).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/actions.ts apps/web/src/components/partner-product-manager.tsx
git commit -m "feat: add alias CRUD server actions and include aliases in getPartnerProducts"
```

---

### Task 4: Alias UI — Display & Add

**Files:**
- Modify: `apps/web/src/components/partner-product-manager.tsx`

This task adds alias Badge chips and the inline add input to each product row.

- [ ] **Step 1: Add alias-related state**

First, add `useRef` to the React import on line 2 (it's `import { useState, useEffect, useTransition, useCallback, useMemo }` — add `useRef`).

Then, after the existing state declarations (around line 52), add:

```typescript
// Alias management
const [addingAliasFor, setAddingAliasFor] = useState<number | null>(null);
const [aliasInput, setAliasInput] = useState("");
const [aliasError, setAliasError] = useState("");
const [isAliasSubmitting, setIsAliasSubmitting] = useState(false);
const deleteTimers = useRef<Map<number, NodeJS.Timeout>>(new Map());
```

- [ ] **Step 2: Add cleanup useEffect for delete timers**

After the alias state declarations, add:

```typescript
// Cleanup delete timers on unmount
useEffect(() => {
  const timers = deleteTimers.current;
  return () => { timers.forEach(t => clearTimeout(t)); timers.clear(); };
}, []);
```

- [ ] **Step 3: Add handleAddAlias function**

After the existing `handlePriceUpdate` function (around line 196), add:

```typescript
async function handleAddAlias(partnerProductId: number) {
  if (isAliasSubmitting) return;
  const trimmed = aliasInput.trim();
  if (!trimmed) { setAliasError("별칭을 입력해주세요"); return; }
  if (trimmed.length > 50) { setAliasError("별칭은 50자 이내로 입력해주세요"); return; }

  setIsAliasSubmitting(true);
  setAliasError("");
  try {
    const res = await addPartnerProductAlias(partnerProductId, trimmed);
    if (res.success && res.data) {
      // Optimistically update local state
      setProducts(prev => prev.map(p =>
        p.id === partnerProductId
          ? { ...p, aliases: [...(p.aliases || []), { id: res.data.id, alias: res.data.alias }] }
          : p
      ));
      setAliasInput("");
      setAddingAliasFor(null);
    } else {
      setAliasError(res.error || "별칭 추가 실패");
    }
  } catch (err) {
    setAliasError("별칭 추가 실패");
  } finally {
    setIsAliasSubmitting(false);
  }
}
```

- [ ] **Step 4: Add alias row UI inside the product table**

In the `TableBody` section (around line 358-410), after the existing `<TableRow>` for each product, add an alias row. Replace the existing `filteredProducts.map` block:

Find this section (the TableBody mapping, line 359):
```typescript
{filteredProducts.map((p) => (
  <TableRow key={p.id} className="group hover:bg-zinc-50/50 transition-colors border-b-zinc-50">
```

Replace the entire `filteredProducts.map(...)` block with:

```typescript
{filteredProducts.map((p) => (
  <TableRow key={p.id} className="group hover:bg-zinc-50/50 transition-colors border-b-zinc-50">
    <TableCell className="py-3.5 pl-4" colSpan={1}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Badge
          variant="outline"
          className={cn(
            "text-[8px] font-black px-1.5 py-0 h-4 rounded-md border shrink-0",
            p.product_source === "drug"
              ? "text-blue-600 bg-blue-50 border-blue-200"
              : p.product_source === "device"
                ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                : "text-zinc-500 bg-zinc-50 border-zinc-200"
          )}
        >
          {p.product_source === "drug" ? "의약품" : p.product_source === "device" ? "의료기기" : "기타"}
        </Badge>
        <p className="text-[11px] font-bold text-zinc-950 leading-tight truncate max-w-[160px]">{p.name}</p>
      </div>
      <p className="text-[9px] font-mono text-zinc-400 tracking-tighter">{p.code}</p>
      {/* Alias chips */}
      <div className="flex flex-wrap items-center gap-1 mt-1.5">
        {(p.aliases || []).map((a: { id: number; alias: string }) => {
          const isHighlighted = listSearch.trim() &&
            a.alias.toLowerCase().includes(listSearch.trim().toLowerCase());
          return (
            <Badge
              key={a.id}
              variant={isHighlighted ? "default" : "secondary"}
              className="text-[9px] font-medium px-1.5 py-0 h-5 gap-0.5"
            >
              {a.alias}
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteAlias(a.id, p.id); }}
                className="ml-0.5 hover:text-destructive transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          );
        })}
        {addingAliasFor === p.id ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={aliasInput}
              onChange={(e) => { setAliasInput(e.target.value); setAliasError(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddAlias(p.id);
                if (e.key === "Escape") { setAddingAliasFor(null); setAliasInput(""); setAliasError(""); }
              }}
              onBlur={() => {
                if (aliasInput.trim()) handleAddAlias(p.id);
                else { setAddingAliasFor(null); setAliasError(""); }
              }}
              disabled={isAliasSubmitting}
              placeholder="별칭 입력..."
              className="h-5 w-24 text-[9px] px-1.5 border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            {aliasError && <span className="text-[8px] text-destructive">{aliasError}</span>}
          </div>
        ) : (
          (p.aliases || []).length < 5 && (
            <button
              onClick={() => { setAddingAliasFor(p.id); setAliasInput(""); setAliasError(""); }}
              className="inline-flex items-center gap-0.5 text-[9px] text-zinc-400 hover:text-primary transition-colors px-1 py-0.5 rounded hover:bg-zinc-100"
            >
              <Plus className="h-2.5 w-2.5" /> 별칭
            </button>
          )
        )}
      </div>
    </TableCell>
    <TableCell className="py-3.5 text-right pr-4">
      <button
        onClick={() => handlePriceUpdate(p.id, p.unit_price || 0)}
        className="text-[11px] font-black text-zinc-950 hover:text-primary transition-all flex items-center justify-end gap-1.5 w-full"
      >
        {p.unit_price ? formatCurrency(p.unit_price) : "단가 설정"}
        <Calculator className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0" />
      </button>
    </TableCell>
    <TableCell className="py-3.5 text-center px-0">
      <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg"
          onClick={() => setHistoryItem(p)}
        >
          <History className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-zinc-400 hover:text-destructive hover:bg-destructive/5 rounded-lg"
          onClick={() => handleDelete(p.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </TableCell>
  </TableRow>
))}
```

- [ ] **Step 5: Verify build**

Run: `cd /c/Users/Gram_M/Documents/Projects/01_NotiRoute/notiflow && npm run build:web 2>&1 | tail -10`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/partner-product-manager.tsx
git commit -m "feat: add alias display and inline add UI to partner product rows"
```

---

### Task 5: Alias UI — Optimistic Delete with Undo Toast

**Files:**
- Modify: `apps/web/src/components/partner-product-manager.tsx`

- [ ] **Step 1: Add handleDeleteAlias function with undo toast**

Add after `handleAddAlias` (the function referenced in Task 4):

```typescript
function handleDeleteAlias(aliasId: number, partnerProductId: number) {
  // Save for undo
  const product = products.find(p => p.id === partnerProductId);
  const alias = product?.aliases?.find((a: { id: number; alias: string }) => a.id === aliasId);
  if (!alias) return;

  // Optimistically remove from UI
  setProducts(prev => prev.map(p =>
    p.id === partnerProductId
      ? { ...p, aliases: (p.aliases || []).filter((a: { id: number }) => a.id !== aliasId) }
      : p
  ));

  // Set up delayed server delete with undo
  const timeoutId = setTimeout(async () => {
    deleteTimers.current.delete(aliasId);
    try {
      await deletePartnerProductAlias(aliasId);
    } catch {
      // Restore on failure
      setProducts(prev => prev.map(p =>
        p.id === partnerProductId
          ? { ...p, aliases: [...(p.aliases || []), alias] }
          : p
      ));
      toast.error("별칭 삭제 실패");
    }
  }, 3000);

  deleteTimers.current.set(aliasId, timeoutId);

  toast("별칭이 삭제되었습니다", {
    action: {
      label: "되돌리기",
      onClick: () => {
        clearTimeout(timeoutId);
        deleteTimers.current.delete(aliasId);
        setProducts(prev => prev.map(p =>
          p.id === partnerProductId
            ? { ...p, aliases: [...(p.aliases || []), alias] }
            : p
        ));
      },
    },
    duration: 3000,
  });
}
```

- [ ] **Step 2: Verify build**

Run: `cd /c/Users/Gram_M/Documents/Projects/01_NotiRoute/notiflow && npm run build:web 2>&1 | tail -10`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/partner-product-manager.tsx
git commit -m "feat: add optimistic alias delete with undo toast"
```

---

### Task 6: Search Filtering with Aliases

**Files:**
- Modify: `apps/web/src/components/partner-product-manager.tsx`

- [ ] **Step 1: Extend filteredProducts memo to include alias matching**

Find the existing `filteredProducts` memo (line 59-77):

```typescript
const filteredProducts = useMemo(() => {
  let result = products;

  // Type filter
  if (filterType !== "all") {
    result = result.filter(p => p.product_source === filterType);
  }

  // Search filter
  if (listSearch.trim()) {
    const q = listSearch.trim().toLowerCase();
    result = result.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q)
    );
  }

  return result;
}, [products, filterType, listSearch]);
```

Replace with:

```typescript
const filteredProducts = useMemo(() => {
  let result = products;

  // Type filter
  if (filterType !== "all") {
    result = result.filter(p => p.product_source === filterType);
  }

  // Search filter (name + code + aliases)
  if (listSearch.trim()) {
    const q = listSearch.trim().toLowerCase();
    result = result.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      (p.aliases || []).some((a: { alias: string }) => a.alias.toLowerCase().includes(q))
    );
  }

  return result;
}, [products, filterType, listSearch]);
```

- [ ] **Step 2: Verify build**

Run: `cd /c/Users/Gram_M/Documents/Projects/01_NotiRoute/notiflow && npm run build:web 2>&1 | tail -10`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/partner-product-manager.tsx
git commit -m "feat: extend product search to include alias matching"
```

---

### Task 7: Manual Verification

- [ ] **Step 1: Start dev server**

Run: `cd /c/Users/Gram_M/Documents/Projects/01_NotiRoute/notiflow && npm run dev:local`

- [ ] **Step 2: Test on supplier tab**

1. Open http://localhost:3000, navigate to supplier tab
2. Select a supplier with registered products
3. Go to "취급 품목" tab
4. Verify `[+ 별칭]` button appears under each product
5. Click `[+ 별칭]` → type "테스트별칭" → press Enter → verify chip appears
6. Add up to 5 aliases → verify `[+ 별칭]` button disappears at 5
7. Try adding a duplicate alias → verify error message
8. Click `×` on a chip → verify undo toast → click "되돌리기" → verify chip restored
9. Click `×` again → wait 3 seconds → verify chip is deleted
10. Type alias name in search bar → verify product found via alias

- [ ] **Step 3: Test on hospital tab**

Repeat the same tests on the hospital tab to verify both partner types work identically.

- [ ] **Step 4: Test edge cases**

1. Empty input → Enter → "별칭을 입력해주세요"
2. "---" (only punctuation) → "유효한 문자를 포함한 별칭을 입력해주세요"
3. Same alias on different product in same partner → error with other product reference
4. Same alias text on same product in different partner → allowed (no conflict)
5. ESC during input → cancels without saving

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```

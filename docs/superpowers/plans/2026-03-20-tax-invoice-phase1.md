# Tax Invoice (전자세금계산서) Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local tax invoice generation and management to NotiFlow — create invoices from orders, manage lifecycle (draft→issued→sent→cancelled), generate PDF, and provide a dashboard UI.

**Architecture:** New DB tables (`tax_invoices`, `tax_invoice_items`, `tax_invoice_orders`, `company_settings`) + hospitals/orders column extensions. Service layer in `apps/web/src/lib/tax-invoice/`. New dashboard routes at `/invoices` and `/settings/company`. PDF generation via `@react-pdf/renderer` (server-side, no puppeteer dependency).

**Tech Stack:** Supabase PostgreSQL (migrations, RLS, RPC functions), Next.js 16 Server Components + Server Actions, React 19, shadcn/ui, Tailwind CSS 4, TypeScript strict, `@react-pdf/renderer` for PDF.

**Spec:** `docs/TAX_INVOICE_DESIGN.md`

**Deviations from spec:**
- Migration numbering starts at 00049 (after existing 00048), not 00050 as in spec section 11.1
- Routes use `/invoices` (not `/tax-invoices`) for brevity — consistent throughout
- Service files use short names (`service.ts`, `validator.ts`, `pdf.ts`) instead of spec's `tax-invoice-service.ts` etc. — they live inside `tax-invoice/` directory so the prefix is redundant
- Cron jobs (spec section 10) are deferred to a follow-up plan (Phase 1-4 scope)
- `TaxInvoiceStats` adds `draft_count` beyond spec for UI convenience

---

## File Structure

### New Files

| Path | Responsibility |
|---|---|
| `packages/supabase/migrations/00049_hospitals_invoice_fields.sql` | Add `ceo_name`, `biz_type`, `biz_item`, `email`, `fax` to hospitals |
| `packages/supabase/migrations/00050_orders_tax_invoice_status.sql` | Add `tax_invoice_status` to orders |
| `packages/supabase/migrations/00051_tax_invoice_enums.sql` | Create ENUM types |
| `packages/supabase/migrations/00052_company_settings.sql` | `company_settings` table |
| `packages/supabase/migrations/00053_tax_invoices.sql` | `tax_invoices` + `tax_invoice_items` + `tax_invoice_orders` tables, indexes, RPC, RLS, triggers |
| `apps/web/src/lib/tax-invoice/types.ts` | TypeScript types for tax invoices |
| `apps/web/src/lib/tax-invoice/validator.ts` | Business validation (biz number check, amount consistency) |
| `apps/web/src/lib/tax-invoice/service.ts` | Core business logic (create, issue, cancel, modify) |
| `apps/web/src/lib/tax-invoice/pdf.ts` | PDF generation using @react-pdf/renderer |
| `apps/web/src/lib/queries/invoices.ts` | Supabase query functions (list, detail, stats) |
| `apps/web/src/lib/queries/company-settings.ts` | Company settings CRUD queries |
| `apps/web/src/app/(dashboard)/invoices/page.tsx` | Invoice list page (server component) |
| `apps/web/src/app/(dashboard)/invoices/[id]/page.tsx` | Invoice detail page |
| `apps/web/src/app/(dashboard)/invoices/new/page.tsx` | New invoice creation page |
| `apps/web/src/components/invoice-table.tsx` | Invoice data table (client component) |
| `apps/web/src/components/invoice-detail-client.tsx` | Invoice detail interactive view |
| `apps/web/src/components/invoice-form.tsx` | Invoice creation form (order selection + dates) |
| `apps/web/src/components/company-settings-form.tsx` | Company info edit form |
| `apps/web/src/app/(dashboard)/settings/company/page.tsx` | Company settings page |
| `apps/web/src/app/(dashboard)/settings/company/actions.ts` | Company settings server actions |
| `apps/web/src/app/api/tax-invoice/[id]/pdf/route.ts` | PDF download API route |

### Modified Files

| Path | Change |
|---|---|
| `apps/web/src/lib/types.ts` | Add `ceo_name`, `biz_type`, `biz_item`, `email`, `fax` to `Hospital`; add `tax_invoice_status` to `Order` |
| `apps/web/src/lib/nav-items.ts` | Add "세금계산서" nav item under "운영 관리" group |
| `apps/web/src/app/(dashboard)/settings/layout.tsx` | Add "자사 정보" tab |
| `apps/web/src/components/order-detail-client.tsx` | Add "세금계산서 발행" button for confirmed+ orders |

---

## Task 1: DB Migration — hospitals table extensions

**Files:**
- Create: `packages/supabase/migrations/00049_hospitals_invoice_fields.sql`
- Modify: `apps/web/src/lib/types.ts:1-13`

- [ ] **Step 1: Write migration**

```sql
-- 00049_hospitals_invoice_fields.sql
-- Add tax invoice required fields to hospitals table

ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ceo_name VARCHAR(50);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS biz_type VARCHAR(50);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS biz_item VARCHAR(50);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS email VARCHAR(200);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS fax VARCHAR(20);

COMMENT ON COLUMN hospitals.ceo_name IS '대표자명 (세금계산서용)';
COMMENT ON COLUMN hospitals.biz_type IS '업태 (세금계산서용)';
COMMENT ON COLUMN hospitals.biz_item IS '종목 (세금계산서용)';
COMMENT ON COLUMN hospitals.email IS '세금계산서 수신 이메일';
COMMENT ON COLUMN hospitals.fax IS '팩스번호';
```

- [ ] **Step 2: Update Hospital TypeScript interface**

In `apps/web/src/lib/types.ts`, add after `is_active: boolean;` in `Hospital`:
```typescript
  ceo_name: string | null;
  biz_type: string | null;
  biz_item: string | null;
  email: string | null;
  fax: string | null;
```

- [ ] **Step 3: Apply migration locally**

Run: `npm run supabase:reset`
Expected: All migrations apply successfully including 00049.

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/migrations/00049_hospitals_invoice_fields.sql apps/web/src/lib/types.ts
git commit -m "feat: add tax invoice fields to hospitals table"
```

---

## Task 2: DB Migration — orders tax_invoice_status + ENUM types

**Files:**
- Create: `packages/supabase/migrations/00050_orders_tax_invoice_status.sql`
- Create: `packages/supabase/migrations/00051_tax_invoice_enums.sql`
- Modify: `apps/web/src/lib/types.ts:15-32`

- [ ] **Step 1: Write orders migration**

```sql
-- 00050_orders_tax_invoice_status.sql
-- Add tax invoice status tracking to orders

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_invoice_status VARCHAR(20) DEFAULT 'pending';

COMMENT ON COLUMN orders.tax_invoice_status IS 'pending=미발행, partial=일부발행, issued=전체발행';
```

Note: This uses VARCHAR(20), not the ENUM type. The ENUM `tax_invoice_status` created in 00051 is for the `tax_invoices.status` column, not for `orders.tax_invoice_status`. The column name and ENUM name share the same label, but they are distinct — the orders column tracks issuance coverage (pending/partial/issued) while the ENUM tracks the invoice lifecycle (draft/issued/sent/cancelled/modified).

- [ ] **Step 2: Write ENUM types migration**

```sql
-- 00051_tax_invoice_enums.sql
-- Create ENUM types for tax invoice system

CREATE TYPE tax_invoice_status AS ENUM (
  'draft',
  'issued',
  'sent',
  'cancelled',
  'modified'
);

CREATE TYPE tax_invoice_type AS ENUM (
  'normal',
  'reverse'
);

CREATE TYPE tax_invoice_tax_type AS ENUM (
  'tax',
  'zero_rate',
  'exempt'
);

CREATE TYPE modify_reason AS ENUM (
  'return',
  'price_change',
  'quantity_change',
  'duplicate',
  'seller_info_change',
  'buyer_info_change',
  'other'
);
```

- [ ] **Step 3: Update Order TypeScript interface**

In `apps/web/src/lib/types.ts`, add after `source_message_id: string | null;` in `Order`:
```typescript
  tax_invoice_status: 'pending' | 'partial' | 'issued' | null;
```

- [ ] **Step 4: Apply migrations locally**

Run: `npm run supabase:reset`

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/migrations/00050_orders_tax_invoice_status.sql packages/supabase/migrations/00051_tax_invoice_enums.sql apps/web/src/lib/types.ts
git commit -m "feat: add orders tax_invoice_status and invoice ENUM types"
```

---

## Task 3: DB Migration — company_settings table

**Files:**
- Create: `packages/supabase/migrations/00052_company_settings.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00052_company_settings.sql
-- Company settings for tax invoice supplier info

CREATE TABLE company_settings (
  id              SERIAL PRIMARY KEY,
  biz_no          VARCHAR(10) NOT NULL,
  company_name    VARCHAR(100) NOT NULL,
  ceo_name        VARCHAR(50),
  address         VARCHAR(200),
  biz_type        VARCHAR(50),
  biz_item        VARCHAR(50),
  email           VARCHAR(200),
  auto_issue_on_delivery  BOOLEAN DEFAULT false,
  default_tax_type        tax_invoice_tax_type DEFAULT 'tax',
  monthly_consolidation   BOOLEAN DEFAULT false,
  consolidation_day       INT DEFAULT 25,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS: anyone can read, only service_role can write (admin client required for mutations)
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select" ON company_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_role_all" ON company_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed with empty row for initial setup
INSERT INTO company_settings (biz_no, company_name)
VALUES ('', '');
```

- [ ] **Step 2: Apply migration**

Run: `npm run supabase:reset`

- [ ] **Step 3: Commit**

```bash
git add packages/supabase/migrations/00052_company_settings.sql
git commit -m "feat: add company_settings table for tax invoice supplier info"
```

---

## Task 4: DB Migration — tax_invoices, tax_invoice_items, tax_invoice_orders

**Files:**
- Create: `packages/supabase/migrations/00053_tax_invoices.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00053_tax_invoices.sql
-- Main tax invoice tables, indexes, RPC, RLS, triggers

-- ═══ 1. tax_invoices table ═══
CREATE TABLE tax_invoices (
  id              SERIAL PRIMARY KEY,
  invoice_number  VARCHAR(24) NOT NULL UNIQUE,
  invoice_type    tax_invoice_type DEFAULT 'normal',
  tax_type        tax_invoice_tax_type DEFAULT 'tax',

  issue_date       DATE NOT NULL,
  supply_date      DATE,
  supply_date_from DATE,
  supply_date_to   DATE,

  -- Supplier snapshot
  supplier_id         INT REFERENCES suppliers(id),
  supplier_biz_no     VARCHAR(10) NOT NULL,
  supplier_name       VARCHAR(100) NOT NULL,
  supplier_ceo_name   VARCHAR(50),
  supplier_address    VARCHAR(200),
  supplier_biz_type   VARCHAR(50),
  supplier_biz_item   VARCHAR(50),
  supplier_email      VARCHAR(200),

  -- Buyer (hospital) snapshot
  hospital_id         INT REFERENCES hospitals(id),
  buyer_biz_no        VARCHAR(10) NOT NULL,
  buyer_name          VARCHAR(100) NOT NULL,
  buyer_ceo_name      VARCHAR(50),
  buyer_address       VARCHAR(200),
  buyer_biz_type      VARCHAR(50),
  buyer_biz_item      VARCHAR(50),
  buyer_email         VARCHAR(200),

  -- Amounts
  supply_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Status
  status          tax_invoice_status DEFAULT 'draft',
  remarks         TEXT,
  issued_at       TIMESTAMPTZ,
  issued_by       UUID REFERENCES auth.users(id),
  cancelled_at    TIMESTAMPTZ,
  cancelled_by    UUID REFERENCES auth.users(id),

  -- Modified invoice
  original_invoice_id INT REFERENCES tax_invoices(id),
  modify_reason   modify_reason,

  -- PDF
  pdf_url         VARCHAR(500),

  -- Future NTS integration (Phase 2)
  nts_confirm_no  VARCHAR(50),
  asp_response    JSONB,
  sent_to_nts_at  TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tax_invoices_status ON tax_invoices(status);
CREATE INDEX idx_tax_invoices_issue_date ON tax_invoices(issue_date);
CREATE INDEX idx_tax_invoices_hospital ON tax_invoices(hospital_id);
CREATE INDEX idx_tax_invoices_number ON tax_invoices(invoice_number);

-- ═══ 2. tax_invoice_items table ═══
CREATE TABLE tax_invoice_items (
  id              SERIAL PRIMARY KEY,
  invoice_id      INT NOT NULL REFERENCES tax_invoices(id) ON DELETE CASCADE,
  order_id        INT REFERENCES orders(id),
  order_item_id   INT REFERENCES order_items(id),
  item_seq        INT NOT NULL DEFAULT 1,
  item_date       DATE,
  item_name       VARCHAR(200) NOT NULL,
  specification   VARCHAR(100),
  quantity        DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price      DECIMAL(12,2) NOT NULL DEFAULT 0,
  supply_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  remark          VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tax_invoice_items_invoice ON tax_invoice_items(invoice_id);

-- ═══ 3. tax_invoice_orders mapping table (N:M) ═══
CREATE TABLE tax_invoice_orders (
  id              SERIAL PRIMARY KEY,
  invoice_id      INT NOT NULL REFERENCES tax_invoices(id) ON DELETE CASCADE,
  order_id        INT NOT NULL REFERENCES orders(id),
  amount          DECIMAL(15,2),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(invoice_id, order_id)
);

-- ═══ 4. Invoice number generation RPC ═══
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
  today_str VARCHAR(8);
  seq_num INT;
  new_number VARCHAR(24);
BEGIN
  today_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 13) AS INT)
  ), 0) + 1
  INTO seq_num
  FROM tax_invoices
  WHERE invoice_number LIKE 'TI-' || today_str || '-%';

  new_number := 'TI-' || today_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- ═══ 5. RLS policies ═══
ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_select" ON tax_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert" ON tax_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update" ON tax_invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated_delete" ON tax_invoices FOR DELETE TO authenticated USING (true);

ALTER TABLE tax_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_select" ON tax_invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert" ON tax_invoice_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update" ON tax_invoice_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated_delete" ON tax_invoice_items FOR DELETE TO authenticated USING (true);

ALTER TABLE tax_invoice_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON tax_invoice_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══ 6. updated_at trigger (uses existing function from 00001) ═══
CREATE TRIGGER set_updated_at_tax_invoices
  BEFORE UPDATE ON tax_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2: Apply migration**

Run: `npm run supabase:reset`
Expected: All tables created, RLS enabled, `generate_invoice_number()` callable.

- [ ] **Step 3: Verify RPC works**

Run via Supabase Studio SQL editor: `SELECT generate_invoice_number();`
Expected: Returns `TI-YYYYMMDD-001`

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/migrations/00053_tax_invoices.sql
git commit -m "feat: add tax_invoices, tax_invoice_items, tax_invoice_orders tables"
```

---

## Task 5: TypeScript types for tax invoices

**Files:**
- Create: `apps/web/src/lib/tax-invoice/types.ts`

- [ ] **Step 1: Write types file**

```typescript
// Tax invoice types — matches DB schema from migrations 00051-00053

export type TaxInvoiceStatus = "draft" | "issued" | "sent" | "cancelled" | "modified";
export type TaxInvoiceType = "normal" | "reverse";
export type TaxInvoiceTaxType = "tax" | "zero_rate" | "exempt";
export type ModifyReason =
  | "return"
  | "price_change"
  | "quantity_change"
  | "duplicate"
  | "seller_info_change"
  | "buyer_info_change"
  | "other";

export interface TaxInvoice {
  id: number;
  invoice_number: string;
  invoice_type: TaxInvoiceType;
  tax_type: TaxInvoiceTaxType;
  status: TaxInvoiceStatus;
  issue_date: string;
  supply_date: string | null;
  supply_date_from: string | null;
  supply_date_to: string | null;

  supplier_id: number | null;
  supplier_biz_no: string;
  supplier_name: string;
  supplier_ceo_name: string | null;
  supplier_address: string | null;
  supplier_biz_type: string | null;
  supplier_biz_item: string | null;
  supplier_email: string | null;

  hospital_id: number | null;
  buyer_biz_no: string;
  buyer_name: string;
  buyer_ceo_name: string | null;
  buyer_address: string | null;
  buyer_biz_type: string | null;
  buyer_biz_item: string | null;
  buyer_email: string | null;

  supply_amount: number;
  tax_amount: number;
  total_amount: number;

  original_invoice_id: number | null;
  modify_reason: ModifyReason | null;
  remarks: string | null;

  pdf_url: string | null;
  issued_at: string | null;
  issued_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxInvoiceItem {
  id: number;
  invoice_id: number;
  item_seq: number;
  order_id: number | null;
  order_item_id: number | null;
  item_date: string | null;
  item_name: string;
  specification: string | null;
  quantity: number;
  unit_price: number;
  supply_amount: number;
  tax_amount: number;
  remark: string | null;
}

export interface TaxInvoiceDetail extends TaxInvoice {
  items: TaxInvoiceItem[];
  linked_orders: {
    order_id: number;
    order_number: string;
    amount: number | null;
  }[];
}

export interface TaxInvoiceStats {
  total_count: number;
  issued_count: number;
  draft_count: number;
  total_supply_amount: number;
  total_tax_amount: number;
  total_amount: number;
  unbilled_order_count: number;
}

/** Order with hospital_name resolved — returned by getUnbilledOrders */
export interface UnbilledOrder {
  id: number;
  order_number: string;
  order_date: string;
  hospital_id: number;
  hospital_name: string | undefined;
  status: string;
  total_amount: number | null;
  supply_amount: number | null;
  tax_amount: number | null;
  delivery_date: string | null;
  delivered_at: string | null;
  tax_invoice_status: string | null;
}

export interface CompanySettings {
  id: number;
  biz_no: string;
  company_name: string;
  ceo_name: string | null;
  address: string | null;
  biz_type: string | null;
  biz_item: string | null;
  email: string | null;
  auto_issue_on_delivery: boolean;
  default_tax_type: TaxInvoiceTaxType;
  monthly_consolidation: boolean;
  consolidation_day: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/tax-invoice/types.ts
git commit -m "feat: add tax invoice TypeScript type definitions"
```

---

## Task 6: Validator — business number check + invoice validation

**Files:**
- Create: `apps/web/src/lib/tax-invoice/validator.ts`

- [ ] **Step 1: Write validator**

```typescript
import type { TaxInvoice, TaxInvoiceItem, ValidationResult } from "./types";

export function isValidBizNo(bizNo: string): boolean {
  if (!bizNo || bizNo.length !== 10 || !/^\d{10}$/.test(bizNo)) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const digits = bizNo.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i];
  }
  sum += Math.floor((digits[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === digits[9];
}

export function validateForIssue(
  invoice: TaxInvoice,
  items: TaxInvoiceItem[]
): ValidationResult {
  const errors: string[] = [];

  if (!isValidBizNo(invoice.supplier_biz_no)) {
    errors.push("공급자 사업자등록번호가 유효하지 않습니다.");
  }
  if (!isValidBizNo(invoice.buyer_biz_no)) {
    errors.push("공급받는자 사업자등록번호가 유효하지 않습니다.");
  }

  const expectedTotal = Number(invoice.supply_amount) + Number(invoice.tax_amount);
  if (Math.abs(expectedTotal - Number(invoice.total_amount)) > 1) {
    errors.push("공급가액 + 세액 ≠ 합계금액");
  }

  if (!invoice.supplier_name) errors.push("공급자 상호가 없습니다.");
  if (!invoice.buyer_name) errors.push("공급받는자 상호가 없습니다.");
  if (!invoice.issue_date) errors.push("작성일자가 없습니다.");

  if (!items || items.length === 0) {
    errors.push("품목이 1건 이상 필요합니다.");
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/tax-invoice/validator.ts
git commit -m "feat: add tax invoice validator with Korean biz number check"
```

---

## Task 7: Query functions — invoices + company settings

**Files:**
- Create: `apps/web/src/lib/queries/invoices.ts`
- Create: `apps/web/src/lib/queries/company-settings.ts`

- [ ] **Step 1: Write invoice query functions**

```typescript
import { createClient } from "@/lib/supabase/server";
import type { TaxInvoice, TaxInvoiceDetail, TaxInvoiceStats, UnbilledOrder } from "@/lib/tax-invoice/types";

export async function getInvoices(params: {
  status?: string;
  hospital_id?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ invoices: TaxInvoice[]; total: number }> {
  const supabase = await createClient();

  let query = supabase
    .from("tax_invoices")
    .select("*", { count: "exact" });

  if (params.status) query = query.eq("status", params.status);
  if (params.hospital_id) query = query.eq("hospital_id", params.hospital_id);
  if (params.from) query = query.gte("issue_date", params.from);
  if (params.to) query = query.lte("issue_date", params.to);

  query = query
    .order("created_at", { ascending: false })
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 25) - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  return { invoices: (data ?? []) as TaxInvoice[], total: count ?? 0 };
}

export async function getInvoice(id: number): Promise<TaxInvoiceDetail> {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("tax_invoices")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: items } = await supabase
    .from("tax_invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("item_seq");

  const { data: linkedOrders } = await supabase
    .from("tax_invoice_orders")
    .select("order_id, amount, orders(order_number)")
    .eq("invoice_id", id);

  return {
    ...invoice,
    items: items ?? [],
    linked_orders: (linkedOrders ?? []).map((lo) => ({
      order_id: lo.order_id,
      order_number: (lo.orders as { order_number: string } | null)?.order_number ?? "",
      amount: lo.amount,
    })),
  } as TaxInvoiceDetail;
}

export async function getInvoiceStats(params: {
  from?: string;
  to?: string;
} = {}): Promise<TaxInvoiceStats> {
  const supabase = await createClient();

  let query = supabase.from("tax_invoices").select("status, supply_amount, tax_amount, total_amount");
  if (params.from) query = query.gte("issue_date", params.from);
  if (params.to) query = query.lte("issue_date", params.to);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  // Only count issued/sent invoices for amount totals (exclude draft/cancelled)
  const activeRows = rows.filter((r) => r.status === "issued" || r.status === "sent");

  const { count: unbilledCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "delivered")
    .eq("tax_invoice_status", "pending");

  return {
    total_count: rows.length,
    issued_count: rows.filter((r) => r.status === "issued").length,
    draft_count: rows.filter((r) => r.status === "draft").length,
    total_supply_amount: activeRows.reduce((s, r) => s + Number(r.supply_amount), 0),
    total_tax_amount: activeRows.reduce((s, r) => s + Number(r.tax_amount), 0),
    total_amount: activeRows.reduce((s, r) => s + Number(r.total_amount), 0),
    unbilled_order_count: unbilledCount ?? 0,
  };
}

export async function getUnbilledOrders(hospitalId?: number): Promise<UnbilledOrder[]> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select("id, order_number, order_date, hospital_id, status, total_amount, supply_amount, tax_amount, delivery_date, delivered_at, tax_invoice_status, hospitals(name)")
    .in("status", ["confirmed", "processing", "delivered"])
    .eq("tax_invoice_status", "pending")
    .order("order_date", { ascending: false });

  if (hospitalId) query = query.eq("hospital_id", hospitalId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    hospital_name: (row.hospitals as { name: string } | null)?.name,
    hospitals: undefined,
  })) as UnbilledOrder[];
}

/** Get invoices linked to a specific order */
export async function getInvoicesForOrder(orderId: number): Promise<TaxInvoice[]> {
  const supabase = await createClient();

  const { data: links } = await supabase
    .from("tax_invoice_orders")
    .select("invoice_id")
    .eq("order_id", orderId);

  if (!links?.length) return [];

  const invoiceIds = links.map((l) => l.invoice_id);
  const { data, error } = await supabase
    .from("tax_invoices")
    .select("*")
    .in("id", invoiceIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []) as TaxInvoice[];
}
```

- [ ] **Step 2: Write company settings queries**

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CompanySettings } from "@/lib/tax-invoice/types";

/** Read uses regular client (SELECT is allowed for authenticated) */
export async function getCompanySettings(): Promise<CompanySettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data as CompanySettings | null;
}

/** Write uses admin client (service_role required by RLS) */
export async function upsertCompanySettings(
  settings: Partial<CompanySettings>
): Promise<CompanySettings> {
  const admin = createAdminClient();

  // Check if row exists
  const { data: existing } = await admin
    .from("company_settings")
    .select("id")
    .limit(1)
    .single();

  if (existing) {
    const { data, error } = await admin
      .from("company_settings")
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as CompanySettings;
  }

  const { data, error } = await admin
    .from("company_settings")
    .insert({
      biz_no: settings.biz_no ?? "",
      company_name: settings.company_name ?? "",
      ...settings,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CompanySettings;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/queries/invoices.ts apps/web/src/lib/queries/company-settings.ts
git commit -m "feat: add invoice and company settings query functions"
```

---

## Task 8: Tax invoice service — core CRUD + issue/cancel

**Files:**
- Create: `apps/web/src/lib/tax-invoice/service.ts`

- [ ] **Step 1: Write service**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TaxInvoice } from "./types";
import { validateForIssue } from "./validator";

export async function createInvoiceFromOrder(orderId: number, issueDate: string) {
  const supabase = await createClient();

  // 1. Fetch order with hospital + items
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*, hospitals(*), order_items(*, products(name, standard_code))")
    .eq("id", orderId)
    .in("status", ["confirmed", "processing", "delivered"])
    .single();
  if (orderErr || !order) throw new Error("발행 가능한 주문을 찾을 수 없습니다.");

  // 2. Fetch company settings
  const { data: company } = await supabase
    .from("company_settings")
    .select("*")
    .limit(1)
    .single();
  if (!company || !company.biz_no) throw new Error("공급자 정보가 설정되지 않았습니다. 설정 > 자사 정보에서 입력해주세요.");

  // 3. Generate invoice number
  const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");

  const hospital = order.hospitals as Record<string, unknown>;

  // 4. Create tax invoice
  const { data: invoice, error: invoiceErr } = await supabase
    .from("tax_invoices")
    .insert({
      invoice_number: invoiceNumber,
      tax_type: company.default_tax_type || "tax",
      status: "draft",
      issue_date: issueDate,
      supply_date: order.delivery_date,
      supplier_id: company.supplier_id ?? null,
      supplier_biz_no: company.biz_no,
      supplier_name: company.company_name,
      supplier_ceo_name: company.ceo_name,
      supplier_address: company.address,
      supplier_biz_type: company.biz_type,
      supplier_biz_item: company.biz_item,
      supplier_email: company.email,
      hospital_id: order.hospital_id,
      buyer_biz_no: (hospital.business_number as string) || "",
      buyer_name: (hospital.name as string) || "",
      buyer_ceo_name: hospital.ceo_name as string | null,
      buyer_address: hospital.address as string | null,
      buyer_biz_type: hospital.biz_type as string | null,
      buyer_biz_item: hospital.biz_item as string | null,
      buyer_email: hospital.email as string | null,
      supply_amount: order.supply_amount || 0,
      tax_amount: order.tax_amount || 0,
      total_amount: order.total_amount || 0,
    })
    .select()
    .single();
  if (invoiceErr) throw invoiceErr;

  // 5. Create invoice items from order items
  const orderItems = (order.order_items ?? []) as Array<Record<string, unknown>>;
  const items = orderItems.map((item, idx) => ({
    invoice_id: invoice.id,
    item_seq: idx + 1,
    order_id: orderId,
    order_item_id: item.id as number,
    item_date: order.delivery_date,
    item_name: (item.product_name as string) || ((item.products as Record<string, unknown>)?.name as string) || "품목",
    specification: (item.products as Record<string, unknown>)?.standard_code as string | null,
    quantity: item.quantity as number,
    unit_price: (item.unit_price as number) || 0,
    supply_amount: (item.line_total as number) || 0,
    tax_amount: Math.round(((item.line_total as number) || 0) * 0.1),
  }));

  if (items.length > 0) {
    await supabase.from("tax_invoice_items").insert(items);
  }

  // 6. Link order ↔ invoice
  await supabase.from("tax_invoice_orders").insert({
    invoice_id: invoice.id,
    order_id: orderId,
    amount: order.total_amount,
  });

  revalidatePath("/invoices");
  revalidatePath("/orders");
  return { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number };
}

export async function createConsolidatedInvoice(
  orderIds: number[],
  issueDate: string
) {
  if (orderIds.length === 0) throw new Error("주문을 선택해주세요.");

  const supabase = await createClient();

  // 1. Fetch selected orders
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("*, hospitals(*), order_items(*, products(name, standard_code))")
    .in("id", orderIds)
    .in("status", ["confirmed", "processing", "delivered"]);
  if (ordersErr || !orders?.length) throw new Error("발행 가능한 주문을 찾을 수 없습니다.");

  // 2. Same hospital check
  const hospitalIds = [...new Set(orders.map((o) => o.hospital_id))];
  if (hospitalIds.length > 1) {
    throw new Error("합산 발행은 같은 공급받는자(병원)의 주문만 가능합니다.");
  }

  // 3. Company settings
  const { data: company } = await supabase
    .from("company_settings")
    .select("*")
    .limit(1)
    .single();
  if (!company || !company.biz_no) throw new Error("공급자 정보가 설정되지 않았습니다.");

  // 4. Sum amounts
  const totals = orders.reduce(
    (acc, o) => ({
      supply: acc.supply + (o.supply_amount || 0),
      tax: acc.tax + (o.tax_amount || 0),
      total: acc.total + (o.total_amount || 0),
    }),
    { supply: 0, tax: 0, total: 0 }
  );

  // 5. Supply date range
  const dates = orders.map((o) => o.delivery_date).filter(Boolean).sort();
  const supplyDateFrom = dates[0] || null;
  const supplyDateTo = dates.length > 1 ? dates[dates.length - 1] : null;

  // 6. Generate number + create invoice
  const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");
  const hospital = orders[0].hospitals as Record<string, unknown>;

  const { data: invoice, error: invoiceErr } = await supabase
    .from("tax_invoices")
    .insert({
      invoice_number: invoiceNumber,
      tax_type: company.default_tax_type || "tax",
      status: "draft",
      issue_date: issueDate,
      supply_date_from: supplyDateFrom,
      supply_date_to: supplyDateTo,
      supplier_id: company.supplier_id ?? null,
      supplier_biz_no: company.biz_no,
      supplier_name: company.company_name,
      supplier_ceo_name: company.ceo_name,
      supplier_address: company.address,
      supplier_biz_type: company.biz_type,
      supplier_biz_item: company.biz_item,
      supplier_email: company.email,
      hospital_id: orders[0].hospital_id,
      buyer_biz_no: (hospital.business_number as string) || "",
      buyer_name: (hospital.name as string) || "",
      buyer_ceo_name: hospital.ceo_name as string | null,
      buyer_address: hospital.address as string | null,
      buyer_biz_type: hospital.biz_type as string | null,
      buyer_biz_item: hospital.biz_item as string | null,
      buyer_email: hospital.email as string | null,
      supply_amount: totals.supply,
      tax_amount: totals.tax,
      total_amount: totals.total,
    })
    .select()
    .single();
  if (invoiceErr) throw invoiceErr;

  // 7. Items from all orders
  let seq = 0;
  for (const order of orders) {
    const orderItems = (order.order_items ?? []) as Array<Record<string, unknown>>;
    const items = orderItems.map((item) => ({
      invoice_id: invoice.id,
      item_seq: ++seq,
      order_id: order.id,
      order_item_id: item.id as number,
      item_date: order.delivery_date,
      item_name: (item.product_name as string) || ((item.products as Record<string, unknown>)?.name as string) || "품목",
      specification: (item.products as Record<string, unknown>)?.standard_code as string | null,
      quantity: item.quantity as number,
      unit_price: (item.unit_price as number) || 0,
      supply_amount: (item.line_total as number) || 0,
      tax_amount: Math.round(((item.line_total as number) || 0) * 0.1),
    }));
    if (items.length > 0) {
      await supabase.from("tax_invoice_items").insert(items);
    }

    await supabase.from("tax_invoice_orders").insert({
      invoice_id: invoice.id,
      order_id: order.id,
      amount: order.total_amount,
    });
  }

  revalidatePath("/invoices");
  revalidatePath("/orders");
  return { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number };
}

/** Helper: recompute order's tax_invoice_status based on all linked invoices */
async function recomputeOrderInvoiceStatus(supabase: Awaited<ReturnType<typeof createClient>>, orderId: number) {
  const { data: links } = await supabase
    .from("tax_invoice_orders")
    .select("invoice_id, tax_invoices(status)")
    .eq("order_id", orderId);

  const activeInvoices = (links ?? []).filter(
    (l) => {
      const inv = l.tax_invoices as { status: string } | null;
      return inv && inv.status !== "cancelled";
    }
  );

  let newStatus = "pending";
  if (activeInvoices.length > 0) {
    // Check if all active invoices are issued
    const allIssued = activeInvoices.every((l) => {
      const inv = l.tax_invoices as { status: string };
      return inv.status === "issued" || inv.status === "sent";
    });
    newStatus = allIssued ? "issued" : "partial";
  }

  await supabase
    .from("orders")
    .update({ tax_invoice_status: newStatus })
    .eq("id", orderId);
}

export async function issueInvoice(invoiceId: number) {
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("tax_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("status", "draft")
    .single();
  if (!invoice) throw new Error("발행 가능한 초안 세금계산서를 찾을 수 없습니다.");

  const { data: items } = await supabase
    .from("tax_invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId);

  const validation = validateForIssue(invoice as TaxInvoice, items ?? []);
  if (!validation.valid) {
    throw new Error(validation.errors.join("\n"));
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("tax_invoices")
    .update({
      status: "issued",
      issued_at: new Date().toISOString(),
      issued_by: user?.id,
    })
    .eq("id", invoiceId);
  if (error) throw error;

  // Recompute each linked order's tax_invoice_status
  const { data: linkedOrders } = await supabase
    .from("tax_invoice_orders")
    .select("order_id")
    .eq("invoice_id", invoiceId);

  for (const lo of linkedOrders ?? []) {
    await recomputeOrderInvoiceStatus(supabase, lo.order_id);
  }

  revalidatePath("/invoices");
  revalidatePath("/orders");
  return { success: true };
}

export async function cancelInvoice(invoiceId: number, reason: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("tax_invoices")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: user?.id,
      remarks: reason,
    })
    .eq("id", invoiceId);
  if (error) throw error;

  // Recompute each linked order's tax_invoice_status
  const { data: linkedOrders } = await supabase
    .from("tax_invoice_orders")
    .select("order_id")
    .eq("invoice_id", invoiceId);

  for (const lo of linkedOrders ?? []) {
    await recomputeOrderInvoiceStatus(supabase, lo.order_id);
  }

  revalidatePath("/invoices");
  revalidatePath("/orders");
  return { success: true };
}

export async function deleteInvoice(invoiceId: number) {
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("tax_invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();
  if (!invoice || invoice.status !== "draft") {
    throw new Error("초안 상태의 세금계산서만 삭제할 수 있습니다.");
  }

  // Get linked orders before deletion (CASCADE will remove tax_invoice_orders)
  const { data: linkedOrders } = await supabase
    .from("tax_invoice_orders")
    .select("order_id")
    .eq("invoice_id", invoiceId);

  const { error } = await supabase
    .from("tax_invoices")
    .delete()
    .eq("id", invoiceId);
  if (error) throw error;

  // Recompute linked orders' status
  for (const lo of linkedOrders ?? []) {
    await recomputeOrderInvoiceStatus(supabase, lo.order_id);
  }

  revalidatePath("/invoices");
  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/tax-invoice/service.ts
git commit -m "feat: add tax invoice service (create, issue, cancel, delete)"
```

---

## Task 9: Navigation + settings layout updates

**Files:**
- Modify: `apps/web/src/lib/nav-items.ts`
- Modify: `apps/web/src/app/(dashboard)/settings/layout.tsx`

- [ ] **Step 1: Add nav item**

In `apps/web/src/lib/nav-items.ts`:
- Add `FileText` to the lucide-react import
- Add `{ href: "/invoices", label: "세금계산서", icon: FileText }` as the 4th item in the "운영 관리" group (after "주문 현황")

- [ ] **Step 2: Add settings tab**

In `apps/web/src/app/(dashboard)/settings/layout.tsx`:
- Add `Building` to the lucide-react import
- Add `{ href: "/settings/company", label: "자사 정보", icon: Building }` to `settingsTabs` array

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint:web`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/nav-items.ts apps/web/src/app/(dashboard)/settings/layout.tsx
git commit -m "feat: add tax invoice nav item and company settings tab"
```

---

## Task 10: Company settings page

**Files:**
- Create: `apps/web/src/components/company-settings-form.tsx`
- Create: `apps/web/src/app/(dashboard)/settings/company/page.tsx`
- Create: `apps/web/src/app/(dashboard)/settings/company/actions.ts`

- [ ] **Step 1: Write server action**

```typescript
// apps/web/src/app/(dashboard)/settings/company/actions.ts
"use server";

import { requireAuth } from "@/lib/auth";
import { upsertCompanySettings } from "@/lib/queries/company-settings";
import { revalidatePath } from "next/cache";
import type { CompanySettings } from "@/lib/tax-invoice/types";

export async function upsertCompanySettingsAction(data: Partial<CompanySettings>) {
  await requireAuth();
  await upsertCompanySettings(data);
  revalidatePath("/settings/company");
  return { success: true };
}
```

- [ ] **Step 2: Write company settings form (client component)**

`apps/web/src/components/company-settings-form.tsx` — A form with fields:
- `biz_no` (사업자등록번호, 10자리 숫자, formatted: XXX-XX-XXXXX)
- `company_name` (상호)
- `ceo_name` (대표자)
- `address` (사업장 주소)
- `biz_type` (업태)
- `biz_item` (종목)
- `email` (이메일)
- `auto_issue_on_delivery` (배송완료 시 자동발행 — Switch)
- `monthly_consolidation` (월합산 발행 — Switch)
- `consolidation_day` (마감일 — number input, 1-31)

Pattern: `"use client"`, props `{ initialSettings: CompanySettings | null }`, `useState` for form, `useTransition` for submit, `toast` on result. Submit calls `upsertCompanySettingsAction`.

Use shadcn: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Input`, `Label`, `Button`, `Switch`.

- [ ] **Step 3: Write settings page (server component)**

```typescript
// apps/web/src/app/(dashboard)/settings/company/page.tsx
import { getCompanySettings } from "@/lib/queries/company-settings";
import CompanySettingsForm from "@/components/company-settings-form";

export default async function CompanySettingsPage() {
  const settings = await getCompanySettings();
  return <CompanySettingsForm initialSettings={settings} />;
}
```

- [ ] **Step 4: Verify dev server renders**

Run: `npm run dev:web`
Navigate to: `http://localhost:3000/settings/company`
Expected: Company settings form renders with empty/seeded values.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/company-settings-form.tsx apps/web/src/app/(dashboard)/settings/company/
git commit -m "feat: add company settings page for tax invoice supplier info"
```

---

## Task 11: Invoice list page

**Files:**
- Create: `apps/web/src/app/(dashboard)/invoices/page.tsx`
- Create: `apps/web/src/components/invoice-table.tsx`

- [ ] **Step 1: Write invoice table (client component)**

`apps/web/src/components/invoice-table.tsx` — Data table with columns:
- 발행번호 (invoice_number) — link to `/invoices/[id]`
- 작성일자 (issue_date)
- 거래처 (buyer_name)
- 공급가액 (supply_amount) — formatted with ₩ and comma
- 세액 (tax_amount)
- 합계 (total_amount)
- 상태 (status) — Badge component with color per status

Pattern: `"use client"`, props `{ invoices: TaxInvoice[] }`, shadcn `Table`.
Status badge mapping:
- draft → `variant="secondary"` label "임시"
- issued → `variant="default"` label "발행"
- sent → blue custom class, label "전송"
- cancelled → `variant="destructive"` label "취소"
- modified → `variant="outline"` label "수정"

Import: `import type { TaxInvoice } from "@/lib/tax-invoice/types";`

- [ ] **Step 2: Write invoice list page (server component)**

```typescript
// apps/web/src/app/(dashboard)/invoices/page.tsx
import { getInvoices, getInvoiceStats } from "@/lib/queries/invoices";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import InvoiceTable from "@/components/invoice-table";
import { Pagination } from "@/components/pagination";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || "";
  const page = parseInt(params.page || "1", 10);
  const limit = 25;

  const [result, stats] = await Promise.all([
    getInvoices({
      status: status || undefined,
      from: params.from,
      to: params.to,
      limit,
      offset: (page - 1) * limit,
    }),
    getInvoiceStats({ from: params.from, to: params.to }).catch(() => null),
  ]);

  const totalPages = Math.ceil(result.total / limit);

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">세금계산서</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-8 gap-1" asChild>
            <Link href="/invoices/new">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">신규 발행</span>
            </Link>
          </Button>
        </div>
      </div>
      {/* TODO: Stats summary cards (optional — can be added in Phase 1-4) */}
      <Tabs defaultValue={status || "all"}>
        <TabsList>
          <TabsTrigger value="all" asChild><Link href="/invoices">전체</Link></TabsTrigger>
          <TabsTrigger value="draft" asChild><Link href="/invoices?status=draft">임시</Link></TabsTrigger>
          <TabsTrigger value="issued" asChild><Link href="/invoices?status=issued">발행</Link></TabsTrigger>
          <TabsTrigger value="cancelled" asChild><Link href="/invoices?status=cancelled">취소</Link></TabsTrigger>
        </TabsList>
        <TabsContent value={status || "all"}>
          <Card>
            <CardContent className="p-0">
              <InvoiceTable invoices={result.invoices} />
            </CardContent>
            <CardFooter>
              <Pagination currentPage={page} totalPages={totalPages} totalCount={result.total} />
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
```

- [ ] **Step 3: Verify page renders**

Run: `npm run dev:web`
Navigate to: `http://localhost:3000/invoices`
Expected: Empty table with tab filters and "신규 발행" button.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/invoices/page.tsx apps/web/src/components/invoice-table.tsx
git commit -m "feat: add tax invoice list page with status tabs"
```

---

## Task 12: Invoice creation page (new)

**Files:**
- Create: `apps/web/src/app/(dashboard)/invoices/new/page.tsx`
- Create: `apps/web/src/components/invoice-form.tsx`

- [ ] **Step 1: Write invoice form (client component)**

`apps/web/src/components/invoice-form.tsx` — A form that:
1. Shows unbilled orders as a selectable list (checkboxes per row)
2. Hospital filter dropdown to narrow orders
3. Date picker for `issue_date` (작성일자) — defaults to today
4. Selected orders summary: count, supply_amount, tax_amount, total_amount
5. Single order → calls `createInvoiceFromOrder`, multiple → calls `createConsolidatedInvoice`
6. On success, `router.push("/invoices/[newId]")`
7. Validates: at least 1 order selected, multiple orders must share same hospital_id

Props: `{ orders: UnbilledOrder[]; hospitals: Hospital[] }`
Pattern: `"use client"`, `useState` for selections, `useTransition` for submit, `useRouter` for redirect.
Imports server actions directly: `import { createInvoiceFromOrder, createConsolidatedInvoice } from "@/lib/tax-invoice/service";`

Use shadcn: `Card`, `CardContent`, `CardHeader`, `Table`, `Checkbox`, `Input` (type="date"), `Button`, `Select`.

- [ ] **Step 2: Write new invoice page (server component)**

```typescript
// apps/web/src/app/(dashboard)/invoices/new/page.tsx
import { getUnbilledOrders } from "@/lib/queries/invoices";
import { getHospitals } from "@/lib/queries/hospitals";
import InvoiceForm from "@/components/invoice-form";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function NewInvoicePage() {
  const [orders, { hospitals }] = await Promise.all([
    getUnbilledOrders(),
    getHospitals({ limit: 200 }),
  ]);

  return (
    <>
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/invoices"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-lg font-semibold md:text-2xl">세금계산서 발행</h1>
      </div>
      <InvoiceForm orders={orders} hospitals={hospitals} />
    </>
  );
}
```

- [ ] **Step 3: Verify creation flow**

1. Navigate to `/invoices/new`
2. Select one or more orders (same hospital)
3. Set issue date
4. Submit
Expected: Invoice created, redirected to detail page.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/invoices/new/ apps/web/src/components/invoice-form.tsx
git commit -m "feat: add tax invoice creation page with order selection"
```

---

## Task 13: Invoice detail page

**Files:**
- Create: `apps/web/src/app/(dashboard)/invoices/[id]/page.tsx`
- Create: `apps/web/src/components/invoice-detail-client.tsx`

- [ ] **Step 1: Write invoice detail client component**

`apps/web/src/components/invoice-detail-client.tsx` — Shows:
- Header: invoice_number, status badge, issue_date, supply date info
- Two-column layout: Supplier info (공급자) | Buyer info (공급받는자)
- Amount summary row: supply_amount, tax_amount, total_amount (formatted with ₩)
- Items table: 순번, 일자, 품명, 규격, 수량, 단가, 공급가액, 세액, 비고
- Linked orders list with links to `/orders/[id]`
- Action buttons (conditional on status):
  - draft: "발행 확정" (calls `issueInvoice`), "삭제" (calls `deleteInvoice`)
  - issued/sent: "취소" (dialog for reason → `cancelInvoice`), "PDF 다운로드" (link)
  - cancelled: read-only, show cancellation info

Pattern: `"use client"`, props `{ invoice: TaxInvoiceDetail }`, `useTransition` + `useRouter`.
Import actions: `import { issueInvoice, cancelInvoice, deleteInvoice } from "@/lib/tax-invoice/service";`

Use shadcn: `Card`, `Table`, `Badge`, `Button`, `Dialog` (for cancel reason).

- [ ] **Step 2: Write detail page (server component)**

```typescript
// apps/web/src/app/(dashboard)/invoices/[id]/page.tsx
import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/queries/invoices";
import InvoiceDetailClient from "@/components/invoice-detail-client";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const invoice = await getInvoice(parseInt(id, 10));
    return <InvoiceDetailClient invoice={invoice} />;
  } catch {
    notFound();
  }
}
```

- [ ] **Step 3: Verify detail page**

Navigate to a created invoice's detail URL.
Expected: Full invoice detail with supplier/buyer info, items, amounts, action buttons.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/invoices/[id]/ apps/web/src/components/invoice-detail-client.tsx
git commit -m "feat: add tax invoice detail page with issue/cancel actions"
```

---

## Task 14: PDF generation + download route

**Files:**
- Create: `apps/web/src/lib/tax-invoice/pdf.ts`
- Create: `apps/web/src/app/api/tax-invoice/[id]/pdf/route.ts`

- [ ] **Step 1: Install @react-pdf/renderer**

Run: `cd /Users/hartmacm4/Documents/Notiflow/apps/web && npm install @react-pdf/renderer`

Note: If `@react-pdf/renderer` has React 19 compatibility issues, fall back to `pdf-lib` with manual coordinate-based rendering. Check `npm ls react` to verify peer dependency compatibility.

- [ ] **Step 2: Write PDF generator**

`apps/web/src/lib/tax-invoice/pdf.ts` — Generate a Korean tax invoice PDF matching 국세청 standard layout:
- Title: "전 자 세 금 계 산 서"
- Two-column header: supplier info (공급자) | buyer info (공급받는자)
- Each column shows: 사업자번호, 상호, 대표자, 주소, 업태, 종목
- Amount summary row: 공급가액, 세액, 합계금액
- Items table: 월일, 품목, 규격, 수량, 단가, 공급가액, 세액, 비고
- Footer: total amount in both digits and Korean text

Export: `async function generateInvoicePdf(invoice: TaxInvoiceDetail): Promise<Buffer>`

If using `@react-pdf/renderer`, register a Korean font (Noto Sans KR from Google Fonts CDN or bundled).
If using `pdf-lib`, use `fontkit` + embedded Korean font.

- [ ] **Step 3: Write PDF API route**

```typescript
// apps/web/src/app/api/tax-invoice/[id]/pdf/route.ts
import { getInvoice } from "@/lib/queries/invoices";
import { generateInvoicePdf } from "@/lib/tax-invoice/pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const invoice = await getInvoice(parseInt(id, 10));
    const pdfBuffer = await generateInvoicePdf(invoice);

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
      },
    });
  } catch {
    return Response.json({ error: "세금계산서를 찾을 수 없습니다." }, { status: 404 });
  }
}
```

- [ ] **Step 4: Add PDF button to detail page**

In `invoice-detail-client.tsx`, for `issued`/`sent` status, add a "PDF 다운로드" button:
```tsx
<Button variant="outline" asChild>
  <a href={`/api/tax-invoice/${invoice.id}/pdf`} target="_blank" rel="noopener">PDF 다운로드</a>
</Button>
```

- [ ] **Step 5: Test PDF generation**

Navigate to: `http://localhost:3000/api/tax-invoice/[id]/pdf`
Expected: PDF renders in browser with Korean text and proper tabular layout.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/tax-invoice/pdf.ts apps/web/src/app/api/tax-invoice/ apps/web/src/components/invoice-detail-client.tsx apps/web/package.json apps/web/package-lock.json
git commit -m "feat: add tax invoice PDF generation with Korean standard layout"
```

---

## Task 15: Order detail — invoice integration

**Files:**
- Modify: `apps/web/src/components/order-detail-client.tsx`

- [ ] **Step 1: Read order-detail-client.tsx to understand current structure**

Read `apps/web/src/components/order-detail-client.tsx` fully before making changes.

- [ ] **Step 2: Add invoice section**

Add to order detail, visible for `confirmed`/`processing`/`delivered` orders:
- If `tax_invoice_status === "pending"`: Show "세금계산서 발행" button → dialog with date picker → calls `createInvoiceFromOrder`
- If `tax_invoice_status === "issued"` or `"partial"`: Show badge + list of linked invoices with links to `/invoices/[id]`

To get linked invoices, either:
a) Pass them as a prop from the page (fetch in server component), or
b) Fetch in the detail page and pass down

Recommended: Fetch in `orders/[id]/page.tsx` using `getInvoicesForOrder(orderId)` and pass to the client component.

- [ ] **Step 3: Update orders/[id]/page.tsx to fetch linked invoices**

Add to the parallel data fetch:
```typescript
import { getInvoicesForOrder } from "@/lib/queries/invoices";
// In the Promise.all:
const linkedInvoices = await getInvoicesForOrder(orderId);
// Pass to component:
<OrderDetailClient ... linkedInvoices={linkedInvoices} />
```

- [ ] **Step 4: Verify integration**

1. Go to an order detail page for a `delivered` order
2. Click "세금계산서 발행"
3. Set date, confirm
Expected: Invoice created, badge appears on order.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/order-detail-client.tsx apps/web/src/app/(dashboard)/orders/[id]/page.tsx
git commit -m "feat: add tax invoice issuance button to order detail page"
```

---

## Task 16: Build verification + lint

- [ ] **Step 1: Run lint**

Run: `npm run lint:web`
Expected: No errors.

- [ ] **Step 2: Run production build**

Run: `npm run build:web`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Fix any issues found**

Address any lint errors or type errors discovered in steps 1-2.

- [ ] **Step 4: Final commit (if fixes needed)**

```bash
git add -A
git commit -m "fix: resolve lint and build issues for tax invoice feature"
```

---

## Summary

| Task | Description | Key Files |
|---|---|---|
| 1 | hospitals table extensions | migration 00049, types.ts |
| 2 | orders + ENUM migrations | migrations 00050-00051, types.ts |
| 3 | company_settings table | migration 00052 |
| 4 | tax invoice tables + RPC + RLS | migration 00053 |
| 5 | TypeScript types | tax-invoice/types.ts |
| 6 | Validator | tax-invoice/validator.ts |
| 7 | Query functions | queries/invoices.ts, queries/company-settings.ts |
| 8 | Service layer (CRUD) | tax-invoice/service.ts |
| 9 | Navigation + settings layout | nav-items.ts, settings/layout.tsx |
| 10 | Company settings page | settings/company/page.tsx, form component |
| 11 | Invoice list page | invoices/page.tsx, invoice-table component |
| 12 | Invoice creation page | invoices/new/page.tsx, invoice-form component |
| 13 | Invoice detail page | invoices/[id]/page.tsx, detail-client component |
| 14 | PDF generation | tax-invoice/pdf.ts, API route |
| 15 | Order detail integration | order-detail-client.tsx |
| 16 | Build verification | lint + build |

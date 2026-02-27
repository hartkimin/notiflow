# Order Creation Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove message parsing infrastructure and build inline order creation with item selection from my_drugs/my_devices, configurable display columns, and auto-generated order numbers.

**Architecture:** Incremental migration — delete parsing code first, then add price columns and order number generation, then build the inline order creation form with item search, and finally the column settings UI. Each task is independently committable.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL), shadcn/ui (command/combobox, checkbox, card), TypeScript, Tailwind CSS

---

### Task 1: DB Migration — Remove message parsing infrastructure

**Files:**
- Create: `packages/supabase/migrations/00030_remove_message_parsing.sql`

**Step 1: Write migration SQL**

```sql
-- 00030_remove_message_parsing.sql
-- Remove message parsing infrastructure (keep AI connection settings)

-- 1. Drop FK constraint and column from orders
ALTER TABLE orders DROP COLUMN IF EXISTS message_id;

-- 2. Drop parsing columns from order_items
ALTER TABLE order_items DROP COLUMN IF EXISTS original_text;
ALTER TABLE order_items DROP COLUMN IF EXISTS match_status;
ALTER TABLE order_items DROP COLUMN IF EXISTS match_confidence;

-- 3. Drop raw_messages table (CASCADE drops dependent objects)
DROP TABLE IF EXISTS raw_messages CASCADE;

-- 4. Drop enum types used by parsing
DROP TYPE IF EXISTS match_status_enum;
DROP TYPE IF EXISTS parse_status_enum;

-- 5. Remove parsing-specific settings (keep AI connection keys)
DELETE FROM settings WHERE key IN (
  'ai_parse_prompt',
  'ai_auto_process',
  'ai_confidence_threshold'
);

-- 6. Drop cron job for message archiving if exists
SELECT cron.unschedule('archive_old_messages')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive_old_messages');
```

**Step 2: Apply migration to remote**

Run: `cd /mnt/d/Project/09_NotiFlow && npx supabase db push --linked`

**Step 3: Commit**

```bash
git add packages/supabase/migrations/00030_remove_message_parsing.sql
git commit -m "migration: remove message parsing tables, columns, and enum types"
```

---

### Task 2: Delete Edge Functions for parsing

**Files:**
- Delete: `packages/supabase/functions/parse-message/index.ts`
- Delete: `packages/supabase/functions/test-parse/index.ts`

**Step 1: Delete the Edge Function directories**

```bash
rm -rf packages/supabase/functions/parse-message/
rm -rf packages/supabase/functions/test-parse/
```

**Step 2: Commit**

```bash
git add -u packages/supabase/functions/
git commit -m "chore: remove parse-message and test-parse Edge Functions"
```

---

### Task 3: Delete message-related web pages and components

**Files to delete:**
- `apps/web/src/app/(dashboard)/messages/page.tsx`
- `apps/web/src/app/(dashboard)/messages/loading.tsx`
- `apps/web/src/app/(dashboard)/messages/actions.ts`
- `apps/web/src/app/(dashboard)/messages/forecast-actions.ts`
- `apps/web/src/app/api/parse/route.ts`
- `apps/web/src/app/api/test-parse/route.ts`
- `apps/web/src/app/api/cron/archive/route.ts`
- `apps/web/src/components/messages-view.tsx`
- `apps/web/src/components/message-list.tsx`
- `apps/web/src/components/message-calendar.tsx`
- `apps/web/src/components/manual-parse-form.tsx`
- `apps/web/src/components/message-inbox/index.tsx`
- `apps/web/src/components/message-inbox/detail-panel.tsx`
- `apps/web/src/components/message-inbox/parse-result-table.tsx`
- `apps/web/src/components/message-inbox/list-panel.tsx`
- `apps/web/src/components/message-inbox/filter-bar.tsx`
- `apps/web/src/components/message-inbox/constants.ts`
- `apps/web/src/components/message-inbox/order-panel.tsx`
- `apps/web/src/lib/parse-service.ts`
- `apps/web/src/lib/parser.ts`
- `apps/web/src/lib/queries/messages.ts`

**Step 1: Delete all message-related files**

```bash
rm -rf apps/web/src/app/(dashboard)/messages/
rm -rf apps/web/src/app/api/parse/
rm -rf apps/web/src/app/api/test-parse/
rm -f  apps/web/src/app/api/cron/archive/route.ts
rm -rf apps/web/src/components/message-inbox/
rm -f  apps/web/src/components/messages-view.tsx
rm -f  apps/web/src/components/message-list.tsx
rm -f  apps/web/src/components/message-calendar.tsx
rm -f  apps/web/src/components/manual-parse-form.tsx
rm -f  apps/web/src/lib/parse-service.ts
rm -f  apps/web/src/lib/parser.ts
rm -f  apps/web/src/lib/queries/messages.ts
```

**Step 2: Commit**

```bash
git add -u
git commit -m "chore: delete message parsing pages, components, and query files"
```

---

### Task 4: Clean up references to deleted code

**Files to modify:**
- Modify: `apps/web/src/lib/nav-items.ts` — remove messages menu item
- Modify: `apps/web/src/lib/actions.ts` — remove message functions (lines 104-318) and parse-service imports
- Modify: `apps/web/src/lib/types.ts` — remove `RawMessage`, `DailyStats`, `CalendarDay`, `MessageCalendarItem`, message-related types; remove `original_text`/`match_status`/`match_confidence` from `OrderItem`; remove `message_*` fields from `OrderDetail`
- Modify: `apps/web/src/lib/queries/orders.ts` — remove `raw_messages` join from `getOrder()`, remove `match_status` from `getOrderItems()` select
- Modify: `apps/web/src/components/global-notifications.tsx` — remove raw_messages subscription
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx` — remove raw_messages from RealtimeListener
- Modify: `apps/web/src/app/(dashboard)/help/page.tsx` — remove raw_messages mention
- Modify: `apps/web/src/components/order-table.tsx` — remove match_status column references
- Modify: `apps/web/src/components/order-detail-client.tsx` — remove message_content display, remove match_status references
- Modify: `apps/web/src/lib/queries/settings.ts` — remove `ai_parse_prompt`, `ai_auto_process`, `ai_confidence_threshold` from `AISettings` and `getSettings()`
- Modify: `apps/web/src/components/ai-settings.tsx` — remove parse prompt section, test parse button, and related state; keep AI connection (provider, API key, model)

**Step 1: Edit `nav-items.ts`** — Remove line 34 (messages menu) and `MessageSquare` import

```typescript
// Remove from imports: MessageSquare
// Remove from items array:
//   { href: "/messages", label: "수신메시지", icon: MessageSquare },
```

**Step 2: Edit `actions.ts`** — Delete lines 104-318 (entire Messages section: createMessage, updateMessage, deleteMessage, testParseMessage, reparseMessage, reparseMessages, deleteMessages). Remove imports of `getAISettings`, `parseMessageCore`, `getHospitalAliases`, `aiParse`, `resolveHospitalFromSender` from parse-service. Remove import of `matchProductsBulk`, `ProductCatalogEntry` from parser.

**Step 3: Edit `types.ts`**

Remove these interfaces entirely:
- `RawMessage` (lines 234-250)
- `DailyStats` (lines 83-89)
- `CalendarDay` (lines 252-257)
- `MessageCalendarItem` (lines 438-441)
- `MessageComment` (lines 376-380)
- `MessageLocalData` (lines 382-389)
- `MessageLocalStateMap` (line 391)
- `StatusStep` (lines 360-365)
- `StatusChangeItem` (lines 367-374)

Edit `OrderItem` — remove `original_text`, `match_status`, `match_confidence`:
```typescript
export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  supplier_id: number | null;
  quantity: number;
  unit_type: string;
  unit_price: number | null;
  line_total: number | null;
}
```

Edit `OrderDetail` — remove message fields:
```typescript
export interface OrderDetail extends Order {
  items: OrderItem[];
}
```

Edit `OrderItemFlat` — remove `match_status`:
```typescript
// Remove: match_status: string;
```

**Step 4: Edit `queries/orders.ts`**

In `getOrder()` (line 133): change select to remove `raw_messages!message_id(...)`:
```typescript
.select("*, hospitals(name)")
```

Remove lines 145-154 (msg parsing and message_content/sender/received_at mapping).

In `getOrderItems()` (line 56): remove `"match_status"` from selectStr array. In the map function (line 121): remove `match_status: row.match_status`.

**Step 5: Edit `global-notifications.tsx`** — Remove `raw_messages` from subscription (line 41) and `/messages` from navigation (line 50).

**Step 6: Edit `dashboard/page.tsx`** — Change `<RealtimeListener tables={["orders", "raw_messages"]} />` to `<RealtimeListener tables={["orders"]} />`.

**Step 7: Edit `ai-settings.tsx`** — Remove `handleTestParse()` function, parse prompt Card section, test parse button and related state. Keep: AI enable/disable, provider selection, API key management, model selection.

**Step 8: Edit `queries/settings.ts`** — Remove `ai_parse_prompt`, `ai_auto_process`, `ai_confidence_threshold` from `AISettings` interface, from the `getSettings()` key list, and from the return object.

**Step 9: Edit `order-table.tsx`** and `order-detail-client.tsx`** — Remove any references to `match_status`, `match_confidence`, `original_text`, `message_content`, `message_sender`, `message_received_at`.

**Step 10: Edit `help/page.tsx`** — Remove or update the line mentioning `raw_messages`.

**Step 11: Verify build**

Run: `cd /mnt/d/Project/09_NotiFlow && npm run build --workspace=apps/web`
Expected: Build succeeds with no errors referencing deleted code

**Step 12: Commit**

```bash
git add -u apps/web/src/
git commit -m "refactor: remove all message parsing references from web app"
```

---

### Task 5: DB Migration — Add price columns and order number function

**Files:**
- Create: `packages/supabase/migrations/00031_order_enhancements.sql`

**Step 1: Write migration SQL**

```sql
-- 00031_order_enhancements.sql
-- Add unit_price to my_drugs/my_devices and order number generation function

-- 1. Add price column to my_drugs
ALTER TABLE my_drugs ADD COLUMN unit_price DECIMAL(12,2);

-- 2. Add price column to my_devices
ALTER TABLE my_devices ADD COLUMN unit_price DECIMAL(12,2);

-- 3. Order number auto-generation function
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  today TEXT := to_char(CURRENT_DATE, 'YYYYMMDD');
  seq INT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM orders
  WHERE order_number LIKE 'ORD-' || today || '-%';

  RETURN 'ORD-' || today || '-' || lpad(seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 4. Default column display settings for orders
INSERT INTO settings (key, value) VALUES
  ('order_display_columns', '"{\\"drug\\": [\\"ITEM_NAME\\", \\"BAR_CODE\\", \\"ENTP_NAME\\", \\"EDI_CODE\\"], \\"device\\": [\\"PRDLST_NM\\", \\"UDIDI_CD\\", \\"MNFT_IPRT_ENTP_NM\\", \\"CLSF_NO_GRAD_CD\\"]}"')
ON CONFLICT (key) DO NOTHING;
```

Note: The settings value format should match how other settings are stored. Check the `updateSetting` function which does `upsert({ key, value })` — the value is stored as JSONB. So the insert should be:

```sql
INSERT INTO settings (key, value) VALUES
  ('order_display_columns', '{"drug": ["ITEM_NAME", "BAR_CODE", "ENTP_NAME", "EDI_CODE"], "device": ["PRDLST_NM", "UDIDI_CD", "MNFT_IPRT_ENTP_NM", "CLSF_NO_GRAD_CD"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

**Step 2: Apply migration**

Run: `cd /mnt/d/Project/09_NotiFlow && npx supabase db push --linked`

**Step 3: Commit**

```bash
git add packages/supabase/migrations/00031_order_enhancements.sql
git commit -m "migration: add unit_price to my_drugs/my_devices, order number function, display column settings"
```

---

### Task 6: Update TypeScript types for new fields

**Files:**
- Modify: `apps/web/src/lib/types.ts` — add `unit_price` to `MyDrug` and `MyDevice`

**Step 1: Add unit_price to MyDrug interface**

After `synced_at: string;` in `MyDrug` interface, add:
```typescript
  unit_price: number | null;
```

**Step 2: Add unit_price to MyDevice interface**

After `synced_at: string;` in `MyDevice` interface, add:
```typescript
  unit_price: number | null;
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat: add unit_price field to MyDrug and MyDevice types"
```

---

### Task 7: Add order display column settings to settings page

**Files:**
- Modify: `apps/web/src/lib/queries/settings.ts` — add `order_display_columns` to settings fetch and type
- Create: `apps/web/src/components/order-column-settings.tsx` — column selection UI
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx` — add OrderColumnSettings component

**Step 1: Update settings types and query**

In `apps/web/src/lib/queries/settings.ts`:

Add to `AISettings` interface (rename to `AppSettings` if appropriate, or add alongside):
```typescript
export interface OrderDisplayColumns {
  drug: string[];
  device: string[];
}
```

Add `order_display_columns` to the key list in `getSettings()`, and add to the return value.

Alternatively, create a separate query function:
```typescript
export async function getOrderDisplayColumns(): Promise<OrderDisplayColumns> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "order_display_columns")
    .single();

  const defaults = {
    drug: ["ITEM_NAME", "BAR_CODE", "ENTP_NAME", "EDI_CODE"],
    device: ["PRDLST_NM", "UDIDI_CD", "MNFT_IPRT_ENTP_NM", "CLSF_NO_GRAD_CD"],
  };

  if (!data?.value) return defaults;
  const val = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
  return { ...defaults, ...val };
}
```

**Step 2: Create `order-column-settings.tsx`**

Client component with:
- Two sections: 의약품 (drug) and 의료기기 (device)
- Checkbox list for each section showing available columns with Korean labels
- Maximum 4 selections per type (disable further checkboxes when 4 selected)
- Save button that calls `updateSetting("order_display_columns", value)`
- Toast notification on save

Available drug columns (use DRUG_LABELS from `actions.ts` — move to a shared constants file or inline):
```typescript
const DRUG_COLUMNS = [
  { key: "ITEM_SEQ", label: "품목기준코드" },
  { key: "ITEM_NAME", label: "품목명" },
  { key: "ITEM_ENG_NAME", label: "영문명" },
  { key: "ENTP_NAME", label: "업체명" },
  { key: "BAR_CODE", label: "표준코드" },
  { key: "EDI_CODE", label: "보험코드" },
  { key: "ETC_OTC_CODE", label: "전문/일반" },
  { key: "MATERIAL_NAME", label: "성분" },
  { key: "STORAGE_METHOD", label: "저장방법" },
  { key: "PACK_UNIT", label: "포장단위" },
  { key: "PERMIT_KIND_NAME", label: "허가구분" },
  { key: "ATC_CODE", label: "ATC코드" },
  // ... all 24 columns
];

const DEVICE_COLUMNS = [
  { key: "UDIDI_CD", label: "UDI-DI코드" },
  { key: "PRDLST_NM", label: "품목명" },
  { key: "MNFT_IPRT_ENTP_NM", label: "제조수입업체명" },
  { key: "CLSF_NO_GRAD_CD", label: "등급" },
  { key: "PERMIT_NO", label: "품목허가번호" },
  { key: "FOML_INFO", label: "모델명" },
  // ... all 20 columns
];
```

**Step 3: Add to settings page**

In `apps/web/src/app/(dashboard)/settings/page.tsx`:
```typescript
import { OrderColumnSettings } from "@/components/order-column-settings";
import { getOrderDisplayColumns } from "@/lib/queries/settings";

// In component body:
const displayColumns = await getOrderDisplayColumns();

// In JSX, add before or after AI settings:
<OrderColumnSettings initialColumns={displayColumns} />
```

**Step 4: Verify build**

Run: `cd /mnt/d/Project/09_NotiFlow && npm run build --workspace=apps/web`

**Step 5: Commit**

```bash
git add apps/web/src/lib/queries/settings.ts apps/web/src/components/order-column-settings.tsx apps/web/src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add order display column settings to settings page"
```

---

### Task 8: Add price input to My Items management

**Files:**
- Modify: `apps/web/src/components/mfds-search-panel.tsx` — show and edit `unit_price` in manage mode
- Modify: `apps/web/src/lib/actions.ts` — add `updateMyDrugPrice` and `updateMyDevicePrice` actions

**Step 1: Add price update server actions**

In `apps/web/src/lib/actions.ts`, add after the existing `deleteMyDevice` function:

```typescript
export async function updateMyDrugPrice(id: number, unitPrice: number | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("my_drugs")
    .update({ unit_price: unitPrice })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}

export async function updateMyDevicePrice(id: number, unitPrice: number | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("my_devices")
    .update({ unit_price: unitPrice })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/products/my");
  return { success: true };
}
```

**Step 2: Add unit_price column to MfdsSearchPanel manage mode**

In `apps/web/src/components/mfds-search-panel.tsx`, add a "가격" column in manage mode that:
- Shows current `unit_price` value (formatted as currency)
- Allows inline editing (click to edit, blur to save)
- Calls `updateMyDrugPrice`/`updateMyDevicePrice` on save

**Step 3: Verify build**

Run: `cd /mnt/d/Project/09_NotiFlow && npm run build --workspace=apps/web`

**Step 4: Commit**

```bash
git add apps/web/src/lib/actions.ts apps/web/src/components/mfds-search-panel.tsx
git commit -m "feat: add unit_price editing to my items management"
```

---

### Task 9: Create order creation server actions and queries

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/actions.ts` — add `createOrderAction`
- Modify: `apps/web/src/lib/queries/orders.ts` — add `generateOrderNumber` query
- Modify: `apps/web/src/lib/queries/products.ts` — add `searchMyItems` query

**Step 1: Add order number generation query**

In `apps/web/src/lib/queries/orders.ts`:

```typescript
export async function generateOrderNumber(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_order_number");
  if (error) throw error;
  return data as string;
}
```

**Step 2: Add my items search query**

In `apps/web/src/lib/queries/products.ts`:

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
  const q = `%${query}%`;

  const [{ data: drugs }, { data: devices }] = await Promise.all([
    supabase
      .from("my_drugs")
      .select("*")
      .or(`item_name.ilike.${q},bar_code.ilike.${q},entp_name.ilike.${q},edi_code.ilike.${q}`)
      .limit(20),
    supabase
      .from("my_devices")
      .select("*")
      .or(`prdlst_nm.ilike.${q},udidi_cd.ilike.${q},mnft_iprt_entp_nm.ilike.${q}`)
      .limit(20),
  ]);

  const results = [];

  for (const d of drugs ?? []) {
    results.push({
      id: d.id,
      type: "drug" as const,
      name: d.item_name ?? "",
      code: d.bar_code,
      manufacturer: d.entp_name,
      unit_price: d.unit_price,
      raw: d,
    });
  }

  for (const d of devices ?? []) {
    results.push({
      id: d.id,
      type: "device" as const,
      name: d.prdlst_nm ?? "",
      code: d.udidi_cd,
      manufacturer: d.mnft_iprt_entp_nm,
      unit_price: d.unit_price,
      raw: d,
    });
  }

  return results;
}
```

**Step 3: Add createOrderAction**

In `apps/web/src/app/(dashboard)/orders/actions.ts`:

```typescript
export async function createOrderAction(data: {
  hospital_id: number;
  order_date: string;
  delivery_date?: string | null;
  delivered_at?: string | null;
  notes?: string | null;
  items: Array<{
    my_item_id: number;
    my_item_type: "drug" | "device";
    quantity: number;
    unit_price: number | null;
  }>;
}) {
  const supabase = (await import("@/lib/supabase/server")).createClient();
  const client = await supabase;

  // Generate order number
  const { data: orderNumber, error: rpcErr } = await client.rpc("generate_order_number");
  if (rpcErr) throw rpcErr;

  // Insert order
  const { data: order, error: orderErr } = await client
    .from("orders")
    .insert({
      order_number: orderNumber,
      order_date: data.order_date,
      hospital_id: data.hospital_id,
      delivery_date: data.delivery_date ?? null,
      delivered_at: data.delivered_at ?? null,
      notes: data.notes ?? null,
      status: "draft",
      total_items: data.items.length,
    })
    .select("id")
    .single();
  if (orderErr) throw orderErr;

  // Insert order items
  if (data.items.length > 0) {
    const orderItems = data.items.map((item) => ({
      order_id: order.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.unit_price ? item.unit_price * item.quantity : null,
    }));

    const { error: itemsErr } = await client
      .from("order_items")
      .insert(orderItems);
    if (itemsErr) throw itemsErr;
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { success: true, orderId: order.id, orderNumber };
}
```

**Step 4: Verify build**

Run: `cd /mnt/d/Project/09_NotiFlow && npm run build --workspace=apps/web`

**Step 5: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/orders/actions.ts apps/web/src/lib/queries/orders.ts apps/web/src/lib/queries/products.ts
git commit -m "feat: add order creation action, order number generation, and my items search query"
```

---

### Task 10: Build inline order creation form component

**Files:**
- Create: `apps/web/src/components/order-inline-form.tsx`

**Step 1: Create the inline form component**

Client component (`"use client"`) with:

**State:**
- `isOpen` (boolean) — form visibility
- `hospitalId` (number | null) — selected hospital
- `orderDate` (string) — defaults to today
- `deliveryDate` (string | null)
- `deliveredAt` (string | null)
- `notes` (string)
- `selectedItems` (array of: `{ id, type, name, code, manufacturer, quantity, unit_price, raw }`)
- `searchQuery` (string) — item search input
- `searchResults` (array) — from `searchMyItems`
- `isSubmitting` (boolean)

**UI sections:**
1. Toggle button: "주문 추가" with PlusCircle icon
2. When open, Card with:
   - Header row: 주문번호 (read-only, auto-generated preview), 병원 (Command/Combobox), 주문일 (Input type=date), 예상배송일 (Input type=date), 실제배송일 (Input type=date)
   - Item search: Input with search icon, results dropdown (Command)
   - Selected items table: columns from settings (4 dynamic) + 수량 (Input number) + 가격 (Input number) + 삭제 (Button)
   - Footer: 메모 (Textarea), 취소 (Button variant=outline), 주문 생성 (Button)

**Props:**
```typescript
interface OrderInlineFormProps {
  hospitals: Array<{ id: number; name: string }>;
  displayColumns: { drug: string[]; device: string[] };
}
```

**Key behaviors:**
- Hospital search uses Command/Combobox from shadcn
- Item search debounced (300ms), calls server action `searchMyItemsAction`
- When item selected from dropdown, add to selectedItems with default quantity=1 and unit_price from the item
- Dynamic column rendering based on `displayColumns` prop and item type
- Submit calls `createOrderAction`, shows toast on success, closes form

**Step 2: Verify build**

Run: `cd /mnt/d/Project/09_NotiFlow && npm run build --workspace=apps/web`

**Step 3: Commit**

```bash
git add apps/web/src/components/order-inline-form.tsx
git commit -m "feat: create OrderInlineForm component with item search and dynamic columns"
```

---

### Task 11: Add search items server action for client use

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/actions.ts` — add `searchMyItemsAction`

**Step 1: Add search action wrapper**

```typescript
export async function searchMyItemsAction(query: string) {
  if (!query || query.length < 1) return [];
  const { searchMyItems } = await import("@/lib/queries/products");
  return searchMyItems(query);
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/orders/actions.ts
git commit -m "feat: add searchMyItemsAction for order inline form"
```

---

### Task 12: Integrate OrderInlineForm into orders page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx` — import and render OrderInlineForm

**Step 1: Update orders page**

Add imports:
```typescript
import { OrderInlineForm } from "@/components/order-inline-form";
import { getOrderDisplayColumns } from "@/lib/queries/settings";
```

Fetch display columns alongside existing data:
```typescript
const [
  { items, total },
  allHospitals,
  allProducts,
  allSuppliers,
  calendarOrders,
  displayColumns,
] = await Promise.all([
  getOrderItems({ status, from: params.from, to: params.to, limit, offset }),
  getHospitals(),
  getProductsCatalog(),
  getSuppliers(),
  getOrdersForCalendar({ from: calFrom, to: calTo }),
  getOrderDisplayColumns(),
]);
```

Render `OrderInlineForm` above the order table (replace the existing "+ 주문 추가" button):
```typescript
<OrderInlineForm
  hospitals={allHospitals.hospitals}
  displayColumns={displayColumns}
/>
```

**Step 2: Verify build**

Run: `cd /mnt/d/Project/09_NotiFlow && npm run build --workspace=apps/web`

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/orders/page.tsx
git commit -m "feat: integrate OrderInlineForm into orders page"
```

---

### Task 13: Update products_catalog view for unit_price

**Files:**
- Create: `packages/supabase/migrations/00032_update_products_catalog_view.sql`

**Step 1: Write migration** to include unit_price in the products_catalog view

```sql
-- 00032_update_products_catalog_view.sql
-- Add unit_price to products_catalog view

CREATE OR REPLACE VIEW products_catalog AS
  SELECT
    id,
    name,
    official_name,
    short_name,
    is_active,
    standard_code,
    COALESCE(mfds_source_type, 'unknown') AS source_type,
    unit_price
  FROM products
UNION ALL
  SELECT
    -1 * id AS id,
    item_name AS name,
    item_name AS official_name,
    NULL::TEXT AS short_name,
    TRUE AS is_active,
    bar_code AS standard_code,
    'drug' AS source_type,
    unit_price
  FROM my_drugs
  WHERE bar_code NOT IN (SELECT standard_code FROM products WHERE standard_code IS NOT NULL)
UNION ALL
  SELECT
    -1000000 - id AS id,
    prdlst_nm AS name,
    prdlst_nm AS official_name,
    NULL::TEXT AS short_name,
    TRUE AS is_active,
    udidi_cd AS standard_code,
    'device_std' AS source_type,
    unit_price
  FROM my_devices
  WHERE udidi_cd NOT IN (SELECT standard_code FROM products WHERE standard_code IS NOT NULL);
```

**Step 2: Apply migration**

Run: `cd /mnt/d/Project/09_NotiFlow && npx supabase db push --linked`

**Step 3: Commit**

```bash
git add packages/supabase/migrations/00032_update_products_catalog_view.sql
git commit -m "migration: add unit_price to products_catalog view"
```

---

### Task 14: End-to-end verification

**Step 1: Full build check**

Run: `cd /mnt/d/Project/09_NotiFlow && npm run build --workspace=apps/web`
Expected: Clean build with no errors

**Step 2: Manual test checklist**

- [ ] Navigate to `/orders` — inline form button visible
- [ ] Click "주문 추가" — form expands
- [ ] Select hospital from combobox
- [ ] Search for item — results appear from my_drugs/my_devices
- [ ] Select item — appears in table with correct 4 columns
- [ ] Edit quantity and price — values update
- [ ] Click "주문 생성" — order created with ORD-YYYYMMDD-NNN format
- [ ] Navigate to `/settings` — column selection UI visible
- [ ] Change selected columns — save works
- [ ] Navigate to `/messages` — 404 (page deleted)
- [ ] Sidebar — no "수신메시지" menu item

**Step 3: Final commit if any fixes needed**

```bash
git add -u
git commit -m "fix: address issues found during e2e verification"
```

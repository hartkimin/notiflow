# Order From Message Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "주문 생성" button to the message detail panel that navigates to /orders with the message content pre-filled in the order form, and stores the link between order and source message.

**Architecture:** URL query parameter (`create_from_message=<id>`) carries the message ID to the orders page. The server component fetches the message and passes its content as initial props to the existing `OrderInlineForm`. A new `source_message_id` column on the `orders` table stores the FK back to `captured_messages`.

**Tech Stack:** Next.js 16 (App Router, Server Components), Supabase (Postgres + JS client), shadcn/ui, Lucide icons

---

### Task 1: Add DB migration for `source_message_id` column

**Files:**
- Create: `packages/supabase/migrations/00033_order_source_message.sql`

**Step 1: Create migration file**

```sql
-- Add source_message_id to orders for linking to captured_messages
ALTER TABLE orders
  ADD COLUMN source_message_id TEXT
  REFERENCES captured_messages(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_source_message_id ON orders(source_message_id);
```

**Step 2: Verify migration syntax**

Run: `cd /mnt/d/Project/09_NotiFlow && cat packages/supabase/migrations/00033_order_source_message.sql`
Expected: File contents match the SQL above.

**Step 3: Commit**

```bash
git add packages/supabase/migrations/00033_order_source_message.sql
git commit -m "feat: add source_message_id column to orders table"
```

---

### Task 2: Add `source_message_id` to TypeScript types

**Files:**
- Modify: `apps/web/src/lib/types.ts:15-31` (Order interface)

**Step 1: Add field to Order interface**

In `apps/web/src/lib/types.ts`, add `source_message_id` to the `Order` interface after the `notes` field (line 30):

```typescript
export interface Order {
  id: number;
  order_number: string;
  order_date: string;
  hospital_id: number;
  hospital_name?: string;
  status: 'draft' | 'confirmed' | 'processing' | 'delivered' | 'cancelled';
  total_items: number;
  total_amount: number | null;
  supply_amount: number | null;
  tax_amount: number | null;
  delivery_date: string | null;
  delivered_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  notes: string | null;
  source_message_id: string | null;
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat: add source_message_id to Order type"
```

---

### Task 3: Add `getMessageById` query function

**Files:**
- Modify: `apps/web/src/lib/queries/messages.ts` (append after existing functions)

**Step 1: Add the function**

Append to end of `apps/web/src/lib/queries/messages.ts`:

```typescript
/**
 * Get a single message by ID.
 */
export async function getMessageById(id: string): Promise<CapturedMessage | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("captured_messages")
    .select(
      "id, app_name, sender, content, received_at, category_id, status_id, is_archived, source, room_name, sender_icon, attached_image",
    )
    .eq("id", id)
    .single();

  if (error) return null;
  return data as CapturedMessage;
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/queries/messages.ts
git commit -m "feat: add getMessageById query function"
```

---

### Task 4: Add `source_message_id` to `createOrderAction`

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/actions.ts:97-149`

**Step 1: Update the action parameter type and insert**

In `apps/web/src/app/(dashboard)/orders/actions.ts`, update `createOrderAction`:

1. Add `source_message_id?: string | null;` to the `data` parameter type (after line 102, the `notes` field):

```typescript
export async function createOrderAction(data: {
  hospital_id: number;
  order_date: string;
  delivery_date?: string | null;
  delivered_at?: string | null;
  notes?: string | null;
  source_message_id?: string | null;
  items: Array<{
    my_item_id: number;
    my_item_type: "drug" | "device";
    quantity: number;
    unit_price: number | null;
  }>;
}) {
```

2. Add `source_message_id` to the insert object (after the `total_items` field, line 128):

```typescript
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      order_date: data.order_date,
      hospital_id: data.hospital_id,
      delivery_date: data.delivery_date ?? null,
      delivered_at: data.delivered_at ?? null,
      notes: data.notes ?? null,
      source_message_id: data.source_message_id ?? null,
      status: "draft",
      total_items: data.items.length,
    })
    .select("id")
    .single();
```

**Step 2: Commit**

```bash
git add apps/web/src/app/(dashboard)/orders/actions.ts
git commit -m "feat: add source_message_id to createOrderAction"
```

---

### Task 5: Update `OrderInlineForm` to accept initial data props

**Files:**
- Modify: `apps/web/src/components/order-inline-form.tsx:96-115`

**Step 1: Extend props interface**

Update the interface and initial state in `order-inline-form.tsx`:

```typescript
interface OrderInlineFormProps {
  displayColumns: { drug: string[]; device: string[] };
  initialNotes?: string;
  sourceMessageId?: string;
}

export function OrderInlineForm({
  displayColumns,
  initialNotes,
  sourceMessageId,
}: OrderInlineFormProps) {
  const [isOpen, setIsOpen] = useState(!!initialNotes);
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [notes, setNotes] = useState(initialNotes ?? "");
```

**Step 2: Pass `source_message_id` in handleSubmit**

In the `handleSubmit` function (around line 227), add `source_message_id`:

```typescript
  const result = await createOrderAction({
    hospital_id: hospitalId,
    order_date: orderDate,
    delivery_date: deliveryDate || null,
    delivered_at: deliveredAt || null,
    notes: notes || null,
    source_message_id: sourceMessageId ?? null,
    items: selectedItems.map((item) => ({
      my_item_id: item.id,
      my_item_type: item.type,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
  });
```

**Step 3: Clear URL param after cancel or successful submit**

In `handleCancel` and after successful submit in `handleSubmit`, clear the URL query param so that re-navigating to /orders doesn't re-open the form:

At the top of the component, add `useRouter`:
```typescript
import { useRouter } from "next/navigation";
```

Inside the component function:
```typescript
const router = useRouter();
```

In `handleCancel` (around line 255), add at the end:
```typescript
function handleCancel() {
  setIsOpen(false);
  setHospitalId(null);
  setSelectedItems([]);
  setNotes("");
  setDeliveryDate("");
  setDeliveredAt("");
  setSearchQuery("");
  setSearchResults([]);
  if (sourceMessageId) {
    router.replace("/orders");
  }
}
```

In `handleSubmit` success block (around line 241), add:
```typescript
toast.success(`주문이 생성되었습니다 (${result.orderNumber})`);
setIsOpen(false);
setHospitalId(null);
setSelectedItems([]);
setNotes("");
setDeliveryDate("");
setDeliveredAt("");
if (sourceMessageId) {
  router.replace("/orders");
}
```

**Step 4: Add visual indicator when creating from message**

In the CardHeader (around line 285), show a badge when creating from a message:

```tsx
<CardTitle className="text-base flex items-center gap-2">
  <PlusCircle className="h-4 w-4" />
  새 주문 생성
  {sourceMessageId && (
    <Badge variant="secondary" className="text-xs font-normal">
      메시지에서
    </Badge>
  )}
  <span className="text-xs text-muted-foreground font-normal ml-2">
    주문번호: 자동생성
  </span>
</CardTitle>
```

Note: `Badge` is already imported in this file.

**Step 5: Commit**

```bash
git add apps/web/src/components/order-inline-form.tsx
git commit -m "feat: support initialNotes and sourceMessageId in OrderInlineForm"
```

---

### Task 6: Update orders page to handle `create_from_message` query param

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx:33-94`

**Step 1: Add `create_from_message` to searchParams type**

Update the Props interface (line 33-43):

```typescript
interface Props {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
    view?: string;
    month?: string;
    create_from_message?: string;
  }>;
}
```

**Step 2: Fetch message when param is present**

After `const params = await searchParams;` (line 46), add the import and fetch logic. First add the import at the top of the file:

```typescript
import { getMessageById } from "@/lib/queries/messages";
```

Then in the function body, after the existing `Promise.all` block (after line 74), add:

```typescript
  // Fetch source message if creating from message
  let initialMessageContent: string | undefined;
  let sourceMessageId: string | undefined;
  if (params.create_from_message) {
    const msg = await getMessageById(params.create_from_message);
    if (msg) {
      initialMessageContent = msg.content;
      sourceMessageId = msg.id;
    }
  }
```

**Step 3: Pass props to OrderInlineForm**

Update the `OrderInlineForm` usage (line 94):

```tsx
<OrderInlineForm
  displayColumns={displayColumns}
  initialNotes={initialMessageContent}
  sourceMessageId={sourceMessageId}
/>
```

**Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/orders/page.tsx
git commit -m "feat: handle create_from_message query param in orders page"
```

---

### Task 7: Add "주문 생성" button to message detail panel

**Files:**
- Modify: `apps/web/src/components/message-inbox/detail-panel.tsx:19-20,204-214`

**Step 1: Add ShoppingCart import**

Update the lucide-react import (line 19) to include `ShoppingCart`:

```typescript
import {
  Trash2, Pin, PinOff, Copy, Pencil, MessageSquare, X, ShoppingCart,
} from "lucide-react";
```

**Step 2: Add the button to the action bar**

In the sticky bottom action bar (after the Copy button on line 213, before the AlertDialog on line 215), add:

```tsx
<Button variant="ghost" size="sm" className="h-7 w-7 p-0"
  onClick={() => router.push(`/orders?create_from_message=${msg.id}`)}
  title="주문 생성">
  <ShoppingCart className="h-3.5 w-3.5" />
</Button>
```

Note: `router` is already available via `useRouter()` at line 32.

**Step 3: Commit**

```bash
git add apps/web/src/components/message-inbox/detail-panel.tsx
git commit -m "feat: add order creation button to message detail panel"
```

---

### Task 8: Verify the full flow

**Step 1: Start dev server**

Run: `cd /mnt/d/Project/09_NotiFlow && npm run dev:web`

**Step 2: Manual testing checklist**

1. Navigate to `/notifications` → select a message → verify ShoppingCart button appears in bottom action bar
2. Click ShoppingCart button → verify navigation to `/orders?create_from_message=<id>`
3. On orders page → verify OrderInlineForm is auto-opened with message content in notes field
4. Verify "메시지에서" badge appears next to form title
5. Fill in hospital and at least one item → click "주문 생성"
6. Verify order is created successfully with toast notification
7. Verify URL is cleaned to `/orders` after successful creation
8. Click "취소" → verify URL is cleaned to `/orders`
9. Navigate directly to `/orders` (no query param) → verify normal behavior (form closed)

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

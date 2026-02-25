# Calendar Forecast & Message Matching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add order forecast functionality to the Messages calendar so users can pre-enter expected orders per day and match them with incoming messages.

**Architecture:** New `order_forecasts`, `forecast_items`, and `order_patterns` tables store forecast data. A discriminated union type merges forecasts and messages into the existing `DataCalendar` component. Server Actions handle CRUD, and matching logic finds forecast candidates when viewing message details.

**Tech Stack:** Supabase (PostgreSQL), Next.js 16 Server Components + Server Actions, shadcn/ui, DataCalendar generic component

---

## Task 1: Database Migration

**Files:**
- Create: `packages/supabase/migrations/00020_forecast_tables.sql`

**Step 1: Write migration SQL**

Create `packages/supabase/migrations/00020_forecast_tables.sql`:

```sql
-- 00020_forecast_tables.sql
-- Add order forecast tables for pre-entering expected orders and matching with messages

-- Enum for forecast status
DO $$ BEGIN
  CREATE TYPE forecast_status_enum AS ENUM ('pending', 'matched', 'partial', 'missed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Order patterns table (recurring order schedules)
CREATE TABLE IF NOT EXISTS order_patterns (
  id              SERIAL PRIMARY KEY,
  hospital_id     INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name            VARCHAR(100),
  recurrence      JSONB NOT NULL,
  default_items   JSONB,
  notes           TEXT,
  is_active       BOOLEAN DEFAULT true,
  last_generated  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order forecasts table (expected orders per day)
CREATE TABLE IF NOT EXISTS order_forecasts (
  id              SERIAL PRIMARY KEY,
  hospital_id     INT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  forecast_date   DATE NOT NULL,
  notes           TEXT,
  status          forecast_status_enum NOT NULL DEFAULT 'pending',
  source          VARCHAR(20) DEFAULT 'manual',
  pattern_id      INT REFERENCES order_patterns(id) ON DELETE SET NULL,
  message_id      INT REFERENCES raw_messages(id) ON DELETE SET NULL,
  matched_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, forecast_date)
);

-- Forecast items table (expected products)
CREATE TABLE IF NOT EXISTS forecast_items (
  id              SERIAL PRIMARY KEY,
  forecast_id     INT NOT NULL REFERENCES order_forecasts(id) ON DELETE CASCADE,
  product_id      INT REFERENCES products(id) ON DELETE SET NULL,
  product_name    VARCHAR(255),
  quantity        INT,
  unit_type       VARCHAR(20) DEFAULT 'piece',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add forecast_id FK to raw_messages
DO $$ BEGIN
  ALTER TABLE raw_messages ADD COLUMN forecast_id INT REFERENCES order_forecasts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_forecasts_date ON order_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_order_forecasts_hospital ON order_forecasts(hospital_id);
CREATE INDEX IF NOT EXISTS idx_order_forecasts_status ON order_forecasts(status);
CREATE INDEX IF NOT EXISTS idx_forecast_items_forecast ON forecast_items(forecast_id);
CREATE INDEX IF NOT EXISTS idx_order_patterns_hospital ON order_patterns(hospital_id);
CREATE INDEX IF NOT EXISTS idx_raw_messages_forecast ON raw_messages(forecast_id);

-- RLS policies (dashboard users have full access)
ALTER TABLE order_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_forecasts_all" ON order_forecasts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "dashboard_forecast_items_all" ON forecast_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "dashboard_order_patterns_all" ON order_patterns
  FOR ALL USING (true) WITH CHECK (true);
```

**Step 2: Apply migration to Supabase**

Run: `cd packages/supabase && npx supabase db push`

If using remote Supabase, apply via Supabase Dashboard SQL editor or CLI.

**Step 3: Commit**

```bash
git add packages/supabase/migrations/00020_forecast_tables.sql
git commit -m "feat(db): add forecast tables for order prediction and matching"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `apps/web/src/lib/types.ts` (append after line 305)

**Step 1: Add forecast types**

Append to `apps/web/src/lib/types.ts`:

```typescript
// --- Order Forecasts ---

export type ForecastStatus = 'pending' | 'matched' | 'partial' | 'missed' | 'cancelled';

export interface OrderForecast {
  id: number;
  hospital_id: number;
  hospital_name?: string;
  forecast_date: string;
  notes: string | null;
  status: ForecastStatus;
  source: 'manual' | 'pattern';
  pattern_id: number | null;
  message_id: number | null;
  matched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastItem {
  id: number;
  forecast_id: number;
  product_id: number | null;
  product_name: string | null;
  quantity: number | null;
  unit_type: string;
  notes: string | null;
}

export interface OrderForecastDetail extends OrderForecast {
  items: ForecastItem[];
}

export interface OrderPattern {
  id: number;
  hospital_id: number;
  hospital_name?: string;
  name: string | null;
  recurrence: { type: string; days: number[]; interval: number };
  default_items: Array<{ product_id: number; product_name?: string; quantity: number }> | null;
  notes: string | null;
  is_active: boolean;
  last_generated: string | null;
}

/** Discriminated union for calendar items (messages + forecasts) */
export type MessageCalendarItem =
  | { kind: 'message'; data: RawMessage }
  | { kind: 'forecast'; data: OrderForecast };
```

**Step 2: Update RawMessage to include forecast_id**

In `apps/web/src/lib/types.ts`, add `forecast_id` to the `RawMessage` interface (after `synced_at` field, line 162):

```typescript
  forecast_id: number | null;
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat(types): add OrderForecast, ForecastItem, and MessageCalendarItem types"
```

---

## Task 3: Query Functions

**Files:**
- Create: `apps/web/src/lib/queries/forecasts.ts`

**Step 1: Write query functions**

Create `apps/web/src/lib/queries/forecasts.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import type { OrderForecast, OrderForecastDetail, ForecastItem } from "@/lib/types";

/**
 * Get all forecasts in a date range (for calendar view).
 * Includes hospital_name via join.
 */
export async function getForecastsForCalendar(params: {
  from: string;
  to: string;
}): Promise<OrderForecast[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_forecasts")
    .select("*, hospitals(name)")
    .gte("forecast_date", params.from)
    .lt("forecast_date", params.to)
    .order("forecast_date", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    hospital_name: (row.hospitals as { name: string } | null)?.name ?? undefined,
    hospitals: undefined,
  })) as OrderForecast[];
}

/**
 * Get a single forecast with its items.
 */
export async function getForecast(id: number): Promise<OrderForecastDetail | null> {
  const supabase = await createClient();
  const { data: forecast, error } = await supabase
    .from("order_forecasts")
    .select("*, hospitals(name)")
    .eq("id", id)
    .single();
  if (error) return null;

  const { data: items } = await supabase
    .from("forecast_items")
    .select("*")
    .eq("forecast_id", id)
    .order("id");

  const result = {
    ...forecast,
    hospital_name: (forecast.hospitals as { name: string } | null)?.name ?? undefined,
    hospitals: undefined,
    items: (items ?? []) as ForecastItem[],
  };
  return result as OrderForecastDetail;
}

/**
 * Find matching forecasts for a given message.
 * Criteria: same hospital_id, forecast_date within ±1 day of message received_at, status=pending.
 */
export async function findMatchingForecasts(params: {
  hospitalId: number | null;
  receivedAt: string;
}): Promise<OrderForecast[]> {
  if (!params.hospitalId) return [];

  const supabase = await createClient();
  const msgDate = new Date(params.receivedAt);
  const dayBefore = new Date(msgDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayAfter = new Date(msgDate);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const from = dayBefore.toISOString().split("T")[0];
  const to = dayAfter.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("order_forecasts")
    .select("*, hospitals(name)")
    .eq("hospital_id", params.hospitalId)
    .eq("status", "pending")
    .gte("forecast_date", from)
    .lte("forecast_date", to)
    .order("forecast_date");

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    hospital_name: (row.hospitals as { name: string } | null)?.name ?? undefined,
    hospitals: undefined,
  })) as OrderForecast[];
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/queries/forecasts.ts
git commit -m "feat(queries): add forecast query functions for calendar and matching"
```

---

## Task 4: Server Actions for Forecast CRUD

**Files:**
- Create: `apps/web/src/app/(dashboard)/messages/forecast-actions.ts`

**Step 1: Write forecast server actions**

Create `apps/web/src/app/(dashboard)/messages/forecast-actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createForecast(data: {
  hospital_id: number;
  forecast_date: string;
  notes?: string;
  items?: Array<{
    product_id?: number | null;
    product_name?: string;
    quantity?: number;
    unit_type?: string;
  }>;
}) {
  const supabase = await createClient();

  const { data: forecast, error } = await supabase
    .from("order_forecasts")
    .insert({
      hospital_id: data.hospital_id,
      forecast_date: data.forecast_date,
      notes: data.notes || null,
      source: "manual",
    })
    .select("id")
    .single();
  if (error) throw error;

  if (data.items && data.items.length > 0) {
    const itemRows = data.items.map((item) => ({
      forecast_id: forecast.id,
      product_id: item.product_id ?? null,
      product_name: item.product_name ?? null,
      quantity: item.quantity ?? null,
      unit_type: item.unit_type ?? "piece",
    }));
    const { error: itemErr } = await supabase
      .from("forecast_items")
      .insert(itemRows);
    if (itemErr) throw itemErr;
  }

  revalidatePath("/messages");
  return { success: true, id: forecast.id };
}

export async function createForecastBatch(data: {
  hospital_id: number;
  dates: string[];
  notes?: string;
  items?: Array<{
    product_id?: number | null;
    product_name?: string;
    quantity?: number;
    unit_type?: string;
  }>;
}) {
  const supabase = await createClient();
  const results: { date: string; id: number }[] = [];

  for (const date of data.dates) {
    const { data: forecast, error } = await supabase
      .from("order_forecasts")
      .insert({
        hospital_id: data.hospital_id,
        forecast_date: date,
        notes: data.notes || null,
        source: "manual",
      })
      .select("id")
      .single();

    if (error) {
      // Skip duplicates (UNIQUE constraint violation)
      if (error.code === "23505") continue;
      throw error;
    }

    if (data.items && data.items.length > 0) {
      const itemRows = data.items.map((item) => ({
        forecast_id: forecast.id,
        product_id: item.product_id ?? null,
        product_name: item.product_name ?? null,
        quantity: item.quantity ?? null,
        unit_type: item.unit_type ?? "piece",
      }));
      await supabase.from("forecast_items").insert(itemRows);
    }

    results.push({ date, id: forecast.id });
  }

  revalidatePath("/messages");
  return { success: true, created: results.length, results };
}

export async function updateForecast(id: number, data: {
  notes?: string;
  status?: string;
  forecast_date?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("order_forecasts")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/messages");
  return { success: true };
}

export async function deleteForecast(id: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("order_forecasts")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/messages");
  return { success: true };
}

export async function matchForecast(forecastId: number, messageId: number) {
  const supabase = await createClient();

  // Update forecast
  const { error: fErr } = await supabase
    .from("order_forecasts")
    .update({
      status: "matched",
      message_id: messageId,
      matched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", forecastId);
  if (fErr) throw fErr;

  // Update message with forecast_id
  const { error: mErr } = await supabase
    .from("raw_messages")
    .update({ forecast_id: forecastId })
    .eq("id", messageId);
  if (mErr) throw mErr;

  revalidatePath("/messages");
  return { success: true };
}

export async function unmatchForecast(forecastId: number) {
  const supabase = await createClient();

  // Clear message's forecast_id
  const { data: forecast } = await supabase
    .from("order_forecasts")
    .select("message_id")
    .eq("id", forecastId)
    .single();

  if (forecast?.message_id) {
    await supabase
      .from("raw_messages")
      .update({ forecast_id: null })
      .eq("id", forecast.message_id);
  }

  // Reset forecast
  const { error } = await supabase
    .from("order_forecasts")
    .update({
      status: "pending",
      message_id: null,
      matched_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", forecastId);
  if (error) throw error;

  revalidatePath("/messages");
  return { success: true };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/(dashboard)/messages/forecast-actions.ts
git commit -m "feat(actions): add forecast CRUD and matching server actions"
```

---

## Task 5: Forecast Input Dialog (Single)

**Files:**
- Create: `apps/web/src/components/forecast-dialog.tsx`

**Step 1: Write forecast creation dialog**

Create `apps/web/src/components/forecast-dialog.tsx`. This dialog is used for creating/editing a single forecast. It reuses the hospital combobox pattern from `manual-parse-form.tsx` and the product combobox pattern from the order detail.

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { createForecast } from "@/app/(dashboard)/messages/forecast-actions";
import type { Hospital, Product } from "@/lib/types";

interface ForecastItem {
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_type: string;
}

interface ForecastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitals: Hospital[];
  products: Product[];
  initialDate?: string; // "YYYY-MM-DD"
}

export function ForecastDialog({
  open, onOpenChange, hospitals, products, initialDate,
}: ForecastDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const [forecastDate, setForecastDate] = useState(initialDate ?? "");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ForecastItem[]>([]);

  const selectedHospital = hospitals.find((h) => h.id === hospitalId);

  function addItem() {
    setItems([...items, { product_id: null, product_name: "", quantity: 1, unit_type: "piece" }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, update: Partial<ForecastItem>) {
    setItems(items.map((item, i) => (i === index ? { ...item, ...update } : item)));
  }

  function handleSubmit() {
    if (!hospitalId || !forecastDate) {
      toast.error("거래처와 날짜를 선택해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        await createForecast({
          hospital_id: hospitalId,
          forecast_date: forecastDate,
          notes: notes || undefined,
          items: items.length > 0
            ? items.map((i) => ({
                product_id: i.product_id,
                product_name: i.product_name || undefined,
                quantity: i.quantity,
                unit_type: i.unit_type,
              }))
            : undefined,
        });
        toast.success("예상 주문이 등록되었습니다.");
        onOpenChange(false);
        resetForm();
        router.refresh();
      } catch (err) {
        toast.error(`등록 실패: ${(err as Error).message}`);
      }
    });
  }

  function resetForm() {
    setHospitalId(null);
    setForecastDate(initialDate ?? "");
    setNotes("");
    setItems([]);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>예상 주문 등록</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date */}
          <div className="space-y-1.5">
            <Label>날짜</Label>
            <Input
              type="date"
              value={forecastDate}
              onChange={(e) => setForecastDate(e.target.value)}
            />
          </div>

          {/* Hospital */}
          <div className="space-y-1.5">
            <Label>거래처</Label>
            <Popover open={hospitalOpen} onOpenChange={setHospitalOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {selectedHospital ? selectedHospital.name : "거래처 검색..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="거래처명 검색..." />
                  <CommandList>
                    <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                    <CommandGroup>
                      {hospitals.filter((h) => h.is_active).map((h) => (
                        <CommandItem
                          key={h.id}
                          value={`${h.name} ${h.short_name ?? ""}`}
                          onSelect={() => { setHospitalId(h.id); setHospitalOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", hospitalId === h.id ? "opacity-100" : "opacity-0")} />
                          {h.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Items */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>예상 품목</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />품목 추가
              </Button>
            </div>
            {items.map((item, i) => (
              <ForecastItemRow
                key={i}
                item={item}
                products={products}
                onChange={(update) => updateItem(i, update)}
                onRemove={() => removeItem(i)}
              />
            ))}
            {items.length === 0 && (
              <p className="text-xs text-muted-foreground">품목 없이 노트만으로도 등록할 수 있습니다.</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>노트</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="메모 (선택사항)"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "등록중..." : "등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Item row with product combobox ---

function ForecastItemRow({
  item, products, onChange, onRemove,
}: {
  item: ForecastItem;
  products: Product[];
  onChange: (update: Partial<ForecastItem>) => void;
  onRemove: () => void;
}) {
  const [productOpen, setProductOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Popover open={productOpen} onOpenChange={setProductOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal text-xs h-8">
            {item.product_id
              ? products.find((p) => p.id === item.product_id)?.name ?? item.product_name
              : item.product_name || "품목 선택..."}
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="품목 검색..." />
            <CommandList>
              <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
              <CommandGroup>
                {products.filter((p) => p.is_active).map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.name} ${p.short_name ?? ""} ${p.official_name ?? ""}`}
                    onSelect={() => {
                      onChange({ product_id: p.id, product_name: p.name });
                      setProductOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-3 w-3", item.product_id === p.id ? "opacity-100" : "opacity-0")} />
                    <span className="text-xs">{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        type="number"
        min={1}
        value={item.quantity}
        onChange={(e) => onChange({ quantity: parseInt(e.target.value) || 1 })}
        className="w-20 h-8 text-xs"
        placeholder="수량"
      />

      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/forecast-dialog.tsx
git commit -m "feat(ui): add forecast creation dialog with hospital and product combobox"
```

---

## Task 6: Weekly Batch Forecast Dialog

**Files:**
- Create: `apps/web/src/components/forecast-batch-dialog.tsx`

**Step 1: Write weekly batch dialog**

Create `apps/web/src/components/forecast-batch-dialog.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { createForecastBatch } from "@/app/(dashboard)/messages/forecast-actions";
import { getWeekMonday, getWeekDates, toLocalDateStr } from "@/lib/schedule-utils";
import type { Hospital, Product } from "@/lib/types";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

interface ForecastBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitals: Hospital[];
  products: Product[];
  referenceDate: Date;
}

export function ForecastBatchDialog({
  open, onOpenChange, hospitals, products, referenceDate,
}: ForecastBatchDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const monday = getWeekMonday(referenceDate);
  const weekDates = getWeekDates(monday);

  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Array<{ product_id: number | null; product_name: string; quantity: number }>>([]);

  const selectedHospital = hospitals.find((h) => h.id === hospitalId);

  function toggleDay(index: number) {
    const next = [...selectedDays];
    next[index] = !next[index];
    setSelectedDays(next);
  }

  function addItem() {
    setItems([...items, { product_id: null, product_name: "", quantity: 1 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, update: Partial<typeof items[number]>) {
    setItems(items.map((item, i) => (i === index ? { ...item, ...update } : item)));
  }

  function handleSubmit() {
    if (!hospitalId) {
      toast.error("거래처를 선택해주세요.");
      return;
    }

    const dates = weekDates
      .filter((_, i) => selectedDays[i])
      .map((d) => toLocalDateStr(d));

    if (dates.length === 0) {
      toast.error("최소 1일을 선택해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createForecastBatch({
          hospital_id: hospitalId,
          dates,
          notes: notes || undefined,
          items: items.length > 0 ? items : undefined,
        });
        toast.success(`${result.created}건의 예상 주문이 등록되었습니다.`);
        onOpenChange(false);
        resetForm();
        router.refresh();
      } catch (err) {
        toast.error(`등록 실패: ${(err as Error).message}`);
      }
    });
  }

  function resetForm() {
    setHospitalId(null);
    setSelectedDays([true, true, true, true, true, false, false]);
    setNotes("");
    setItems([]);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>주간 예상 일괄 등록</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hospital */}
          <div className="space-y-1.5">
            <Label>거래처</Label>
            <Popover open={hospitalOpen} onOpenChange={setHospitalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedHospital ? selectedHospital.name : "거래처 검색..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="거래처명 검색..." />
                  <CommandList>
                    <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                    <CommandGroup>
                      {hospitals.filter((h) => h.is_active).map((h) => (
                        <CommandItem
                          key={h.id}
                          value={`${h.name} ${h.short_name ?? ""}`}
                          onSelect={() => { setHospitalId(h.id); setHospitalOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", hospitalId === h.id ? "opacity-100" : "opacity-0")} />
                          {h.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Day selection */}
          <div className="space-y-1.5">
            <Label>요일 선택</Label>
            <div className="flex gap-2">
              {weekDates.map((date, i) => (
                <label
                  key={i}
                  className={cn(
                    "flex flex-col items-center gap-1 px-2 py-1.5 rounded-md border cursor-pointer transition-colors",
                    selectedDays[i] ? "bg-primary/10 border-primary" : "hover:bg-muted",
                  )}
                >
                  <Checkbox
                    checked={selectedDays[i]}
                    onCheckedChange={() => toggleDay(i)}
                    className="sr-only"
                  />
                  <span className="text-xs font-medium">{DAY_LABELS[i]}</span>
                  <span className="text-[10px] text-muted-foreground">{date.getDate()}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>공통 품목</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />품목 추가
              </Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal text-xs h-8">
                      {item.product_id
                        ? products.find((p) => p.id === item.product_id)?.name ?? item.product_name
                        : "품목 선택..."}
                      <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="품목 검색..." />
                      <CommandList>
                        <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                        <CommandGroup>
                          {products.filter((p) => p.is_active).map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.name} ${p.short_name ?? ""}`}
                              onSelect={() => updateItem(i, { product_id: p.id, product_name: p.name })}
                            >
                              <Check className={cn("mr-2 h-3 w-3", item.product_id === p.id ? "opacity-100" : "opacity-0")} />
                              <span className="text-xs">{p.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(i, { quantity: parseInt(e.target.value) || 1 })}
                  className="w-20 h-8 text-xs"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeItem(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>노트</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="메모 (선택사항)"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "등록중..." : `${selectedDays.filter(Boolean).length}일 일괄 등록`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/forecast-batch-dialog.tsx
git commit -m "feat(ui): add weekly batch forecast dialog with day selection"
```

---

## Task 7: Update MessageCalendar to Display Forecasts

**Files:**
- Modify: `apps/web/src/components/message-calendar.tsx`

This is the key change. The MessageCalendar must now accept both messages and forecasts, merge them into a unified list using the `MessageCalendarItem` discriminated union, and render each type differently.

**Step 1: Rewrite message-calendar.tsx to support forecasts**

Replace the entire file with the updated version that:
1. Accepts `forecasts: OrderForecast[]` prop
2. Merges messages and forecasts into `MessageCalendarItem[]`
3. Provides separate renderers for each kind
4. Shows matching UI in detail panel for messages

Key changes:
- Props: add `forecasts`, `hospitals`, `products`, callback for creating forecasts
- `items` becomes `MessageCalendarItem[]` (discriminated union)
- `dateAccessor`: switch on `kind` — message uses `received_at`, forecast uses `forecast_date`
- `idAccessor`: prefix with kind to avoid ID collisions (e.g., `"msg-123"` vs `"fc-45"`)
- Renderers: separate MonthItem/WeekItem/DayItem for each kind
- DetailContent: for messages, show matching forecast candidates; for forecasts, show items and notes

Refer to:
- Existing renderers in `message-calendar.tsx:34-148` for message rendering style
- Forecast status colors from design doc
- `findMatchingForecasts` query for matching candidates

The rendered forecast items in month/week views should use a clipboard icon (📋) prefix and show hospital name + status badge.

**Step 2: Commit**

```bash
git add apps/web/src/components/message-calendar.tsx
git commit -m "feat(ui): integrate forecasts into message calendar with dual-type rendering"
```

---

## Task 8: Update Messages Page Server Component

**Files:**
- Modify: `apps/web/src/app/(dashboard)/messages/page.tsx`

**Step 1: Fetch forecasts alongside messages**

Add `getForecastsForCalendar` to the parallel fetch in `page.tsx`:

```typescript
import { getForecastsForCalendar } from "@/lib/queries/forecasts";
```

Add to the `Promise.all`:
```typescript
const [result, calendarMessages, hospitalsResult, productsResult, calendarForecasts] = await Promise.all([
  getMessages({ ... }),
  getMessagesForCalendar({ from: fromStr, to: toStr }).catch(() => []),
  getHospitals({ limit: 500 }).catch(() => ({ hospitals: [], total: 0 })),
  getProducts({ limit: 500 }).catch(() => ({ products: [], total: 0 })),
  getForecastsForCalendar({ from: fromStr, to: toStr }).catch(() => []),
]);
```

Pass `calendarForecasts` to `MessagesView`:
```typescript
<MessagesView
  ...existing props...
  calendarForecasts={calendarForecasts}
/>
```

**Step 2: Commit**

```bash
git add apps/web/src/app/(dashboard)/messages/page.tsx
git commit -m "feat(messages): fetch forecasts alongside messages for calendar view"
```

---

## Task 9: Update MessagesView for Forecast Integration

**Files:**
- Modify: `apps/web/src/components/messages-view.tsx`

**Step 1: Add forecast props and toolbar buttons**

1. Add to `MessagesViewProps`:
   - `calendarForecasts: OrderForecast[]`

2. Add state for dialogs:
   - `forecastDialogOpen` / `batchDialogOpen`

3. Add toolbar buttons in calendar mode (after the view switcher, before the create button):
   - "예상 등록" button → opens ForecastDialog
   - "주간 예상" button → opens ForecastBatchDialog

4. Pass forecasts to MessageCalendar:
   ```typescript
   <MessageCalendar
     messages={calendarMessages}
     forecasts={calendarForecasts}
     hospitals={hospitals}
     products={products}
     ...
   />
   ```

5. Render ForecastDialog and ForecastBatchDialog at the bottom of the component.

**Step 2: Handle double-click on calendar cell**

Add `onDateDoubleClick` callback to DataCalendar props (new optional prop). When a date cell is double-clicked in month/week view, open the ForecastDialog with that date pre-filled.

This requires a small change to `data-calendar.tsx`, `month-grid.tsx`, and `week-grid.tsx` to support `onDateDoubleClick`.

**Step 3: Commit**

```bash
git add apps/web/src/components/messages-view.tsx
git commit -m "feat(ui): add forecast toolbar buttons and dialog integration to messages view"
```

---

## Task 10: Add Double-Click Support to DataCalendar

**Files:**
- Modify: `apps/web/src/components/data-calendar/data-calendar.tsx`
- Modify: `apps/web/src/components/data-calendar/month-grid.tsx`
- Modify: `apps/web/src/components/data-calendar/week-grid.tsx`

**Step 1: Add onDateDoubleClick to DataCalendar props**

In `data-calendar.tsx`, add to `DataCalendarProps<T>`:
```typescript
onDateDoubleClick?: (date: Date) => void;
```

Pass it through to MonthGrid and WeekGrid.

**Step 2: Add double-click handler to month-grid and week-grid**

In `month-grid.tsx`, on each day cell `<div>`, add:
```typescript
onDoubleClick={() => onDateDoubleClick?.(cellDate)}
```

Same for `week-grid.tsx`.

**Step 3: Commit**

```bash
git add apps/web/src/components/data-calendar/
git commit -m "feat(calendar): add onDateDoubleClick support to DataCalendar"
```

---

## Task 11: Matching UI in Message Detail

**Files:**
- Modify: `apps/web/src/components/message-calendar.tsx` (DetailContent for messages)

**Step 1: Add matching section to message detail**

When a message's detail panel is opened:
1. If the message has `hospital_id`, show a "매칭 후보" section
2. Use `findMatchingForecasts` query (called from a client-side fetch or passed as prop)
3. Display each matching forecast with hospital name, date, items, notes
4. Show confidence level (high if same date, medium if ±1 day)
5. "매칭 확인" button calls `matchForecast` server action
6. If already matched (message.forecast_id is set), show matched forecast info instead

Since `findMatchingForecasts` is a server-side query, we have two options:
- **Option A**: Fetch matches on the server and pass them as part of the calendar data (pre-computed)
- **Option B**: Use a client-side API route or useEffect to fetch matches when detail opens

**Recommended: Option B** — fetch on detail open to avoid loading matches for all messages upfront.

Create a thin API route or use Server Action:

```typescript
// In forecast-actions.ts, add:
export async function getMatchingForecasts(messageId: number, hospitalId: number | null, receivedAt: string) {
  if (!hospitalId) return [];
  const { findMatchingForecasts } = await import("@/lib/queries/forecasts");
  return findMatchingForecasts({ hospitalId, receivedAt });
}
```

In the detail component, use `useEffect` + `startTransition` to fetch matches when `selectedItem` changes.

**Step 2: Commit**

```bash
git add apps/web/src/components/message-calendar.tsx apps/web/src/app/(dashboard)/messages/forecast-actions.ts
git commit -m "feat(ui): add forecast matching UI to message detail panel"
```

---

## Task 12: Forecast Detail in Calendar

**Files:**
- Modify: `apps/web/src/components/message-calendar.tsx` (DetailContent for forecasts)

**Step 1: Add forecast detail panel**

When a forecast item is clicked in the calendar, the detail panel should show:
1. Hospital name and forecast date
2. Status badge (pending/matched/missed/cancelled)
3. Items list (product + quantity)
4. Notes
5. Actions: "수정" / "삭제" / "취소" buttons
6. If matched, link to the matched message

**Step 2: Commit**

```bash
git add apps/web/src/components/message-calendar.tsx
git commit -m "feat(ui): add forecast detail view with status and actions"
```

---

## Task 13: Visual Verification

**Step 1: Start dev server and verify**

Run: `npm run dev:web` (from project root)

**Step 2: Manual test checklist**

1. **Messages 캘린더 표시**: 캘린더에 기존 메시지가 정상 표시되는지 확인
2. **예상 등록 버튼**: 툴바에 "예상 등록" 버튼이 보이는지
3. **단건 등록**: 거래처 선택 → 날짜 → 품목 → 노트 → 등록 → 캘린더에 표시
4. **주간 일괄 등록**: 거래처 → 요일 선택 → 등록 → 각 날짜에 표시
5. **더블클릭 등록**: 캘린더 셀 더블클릭 시 해당 날짜로 등록 다이얼로그
6. **매칭 제안**: 메시지 클릭 → 상세 패널에 매칭 후보 표시
7. **매칭 확인**: "매칭 확인" 클릭 → 예상 상태가 matched로 변경
8. **색상 구분**: pending(파란), matched(초록), missed(빨강) 상태 표시

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(messages): complete forecast calendar integration with matching"
```

---

## Summary of Files

| Action | File |
|--------|------|
| Create | `packages/supabase/migrations/00020_forecast_tables.sql` |
| Modify | `apps/web/src/lib/types.ts` |
| Create | `apps/web/src/lib/queries/forecasts.ts` |
| Create | `apps/web/src/app/(dashboard)/messages/forecast-actions.ts` |
| Create | `apps/web/src/components/forecast-dialog.tsx` |
| Create | `apps/web/src/components/forecast-batch-dialog.tsx` |
| Modify | `apps/web/src/components/message-calendar.tsx` |
| Modify | `apps/web/src/app/(dashboard)/messages/page.tsx` |
| Modify | `apps/web/src/components/messages-view.tsx` |
| Modify | `apps/web/src/components/data-calendar/data-calendar.tsx` |
| Modify | `apps/web/src/components/data-calendar/month-grid.tsx` |
| Modify | `apps/web/src/components/data-calendar/week-grid.tsx` |

## Phase 2 (Future — Not in This Plan)
- `order_patterns` CRUD UI
- Pattern-based auto-generation
- Pattern management screen

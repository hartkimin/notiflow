# Messages 3-Panel Inbox Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-column expandable-table messages UI with a 3-panel horizontal layout (list / detail / order) that completes the message→order workflow in one screen.

**Architecture:** Create a `MessageInbox` client component that renders 3 panels in a flex row. Each panel is a separate file under `components/message-inbox/`. The server component (`page.tsx`) stays unchanged — only the client rendering is restructured. Existing code from `message-list.tsx` is extracted and reorganized into panels. `ManualParseForm` is reused directly in OrderPanel.

**Tech Stack:** Next.js 16, React 19, shadcn/ui, Tailwind CSS v4, TypeScript

---

### Task 1: Create InboxFilterBar

The simplest component — a compressed 1-row filter bar replacing the 2-row `MessageFilters`.

**Files:**
- Create: `apps/web/src/components/message-inbox/filter-bar.tsx`

**Step 1: Create the component**

Extract filter logic from `message-list.tsx:96-158` (`MessageFilters`). Compress to single row with `h-8` inputs, add count display.

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface FilterBarProps {
  totalCount: number;
  pendingCount: number;
}

export function InboxFilterBar({ totalCount, pendingCount }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const from = fd.get("from") as string;
    const to = fd.get("to") as string;
    const parse_status = fd.get("parse_status") as string;
    const source_app = fd.get("source_app") as string;
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (parse_status && parse_status !== "all") params.set("parse_status", parse_status);
    if (source_app && source_app !== "all") params.set("source_app", source_app);
    router.push(`/messages?${params}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 py-1.5">
      <Input type="date" name="from" defaultValue={searchParams.get("from") || ""} className="h-8 w-[120px] text-xs" />
      <Input type="date" name="to" defaultValue={searchParams.get("to") || ""} className="h-8 w-[120px] text-xs" />
      <Select name="parse_status" defaultValue={searchParams.get("parse_status") || "all"}>
        <SelectTrigger className="h-8 w-[100px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 상태</SelectItem>
          <SelectItem value="parsed">파싱완료</SelectItem>
          <SelectItem value="pending">대기</SelectItem>
          <SelectItem value="failed">실패</SelectItem>
          <SelectItem value="skipped">건너뜀</SelectItem>
        </SelectContent>
      </Select>
      <Select name="source_app" defaultValue={searchParams.get("source_app") || "all"}>
        <SelectTrigger className="h-8 w-[100px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 출처</SelectItem>
          <SelectItem value="kakaotalk">카카오톡</SelectItem>
          <SelectItem value="sms">SMS</SelectItem>
          <SelectItem value="telegram">텔레그램</SelectItem>
          <SelectItem value="manual">수동</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" variant="outline" className="h-8 px-2">
        <Search className="h-3.5 w-3.5" />
      </Button>
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
        <span>전체 <strong className="text-foreground">{totalCount}</strong>건</span>
        {pendingCount > 0 && (
          <span>· 미처리 <strong className="text-orange-600">{pendingCount}</strong>건</span>
        )}
      </div>
    </form>
  );
}
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add apps/web/src/components/message-inbox/filter-bar.tsx
git commit -m "feat(web): add InboxFilterBar component for messages 3-panel"
```

---

### Task 2: Create MessageListPanel

Card-based message list replacing the 7-column table.

**Files:**
- Create: `apps/web/src/components/message-inbox/list-panel.tsx`

**Step 1: Create the component**

Migrates sorting logic from `message-list.tsx:426-441` into a card-based list. Each card shows sender, time, content preview, status badge, pin icon, source.

```typescript
"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pin } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { cn } from "@/lib/utils";
import type { RawMessage } from "@/lib/types";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";
import type { RowSelectionHook } from "@/hooks/use-row-selection";

const SOURCE_LABEL: Record<string, string> = {
  kakaotalk: "카카오톡", sms: "SMS", telegram: "텔레그램", manual: "수동",
};

type SortKey = "received_at" | "sender" | "parse_status";

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

interface ListPanelProps {
  messages: RawMessage[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  localState: MessageLocalStateHook;
  rowSelection: RowSelectionHook;
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function MessageListPanel({
  messages, selectedId, onSelect, localState, rowSelection,
  currentPage, totalPages, totalCount,
}: ListPanelProps) {
  const [sortKey, setSortKey] = useState<SortKey>("received_at");

  const sorted = useMemo(() => {
    return [...messages].sort((a, b) => {
      const aPinned = localState.getState(a.id).isPinned ? 1 : 0;
      const bPinned = localState.getState(b.id).isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      if (sortKey === "received_at") {
        return new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
      }
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      return String(av).localeCompare(String(bv), "ko");
    });
  }, [messages, sortKey, localState]);

  return (
    <div className="flex flex-col w-[300px] shrink-0 border-r">
      {/* Sort selector */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="received_at">수신시간↓</SelectItem>
            <SelectItem value="sender">발신자</SelectItem>
            <SelectItem value="parse_status">상태</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((msg) => {
          const msgLocal = localState.getState(msg.id);
          const statusStep = localState.steps.find((s) => s.id === msgLocal.statusId);
          const isSelected = selectedId === msg.id;

          return (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-2 px-3 py-2.5 border-b cursor-pointer transition-colors",
                "hover:bg-muted/50",
                isSelected && "bg-primary/5 ring-2 ring-inset ring-primary",
              )}
              onClick={() => onSelect(msg.id)}
            >
              <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={rowSelection.selected.has(msg.id)}
                  onCheckedChange={() => rowSelection.toggle(msg.id)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{msg.sender || "(발신자 없음)"}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{formatTime(msg.received_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.content}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {statusStep ? (
                    <span className="inline-flex items-center gap-1 text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStep.color }} />
                      {statusStep.name}
                    </span>
                  ) : (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                      {msg.parse_status === "parsed" ? "파싱완료" : msg.parse_status === "pending" ? "대기" : msg.parse_status === "failed" ? "실패" : "건너뜀"}
                    </Badge>
                  )}
                  {msgLocal.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-auto">
                    {SOURCE_LABEL[msg.source_app] || msg.source_app}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">수신된 메시지가 없습니다.</p>
        )}
      </div>

      {/* Pagination */}
      <div className="border-t px-2 py-1.5">
        <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} />
      </div>
    </div>
  );
}
```

**Note:** This requires exporting types from the hooks. Before creating this file, add type exports:

In `apps/web/src/hooks/use-message-local-state.ts`, add at the bottom:
```typescript
export type MessageLocalStateHook = ReturnType<typeof useMessageLocalState>;
```

In `apps/web/src/hooks/use-row-selection.ts`, add at the bottom:
```typescript
export type RowSelectionHook = ReturnType<typeof useRowSelection>;
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add apps/web/src/components/message-inbox/list-panel.tsx apps/web/src/hooks/use-message-local-state.ts apps/web/src/hooks/use-row-selection.ts
git commit -m "feat(web): add MessageListPanel with card-based message list"
```

---

### Task 3: Create MessageDetailPanel

Center panel showing full message detail, parse results, AI test, comments, and sticky action bar.

**Files:**
- Create: `apps/web/src/components/message-inbox/detail-panel.tsx`

**Step 1: Create the component**

Extract from `message-list.tsx:539-735` (expanded row content). Key sections:
- Meta bar (sender, time, source, device, status dropdown)
- Message content (chat bubble, editable)
- ParseResultTable (extracted from message-list.tsx:254-313)
- AI test result display
- Comments
- Sticky bottom action bar

This is the largest component (~350 lines). Extract `ParseResultTable` as a shared function and the constants `STATUS_LABEL`, `SOURCE_LABEL` into a shared `message-inbox/constants.ts` file.

**Create `apps/web/src/components/message-inbox/constants.ts`:**

```typescript
export const STATUS_LABEL: Record<string, string> = {
  parsed: "파싱완료", pending: "대기", failed: "실패", skipped: "건너뜀",
};

export const SOURCE_LABEL: Record<string, string> = {
  kakaotalk: "카카오톡", sms: "SMS", telegram: "텔레그램", manual: "수동",
};

export function formatDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}
```

**Create `apps/web/src/components/message-inbox/parse-result-table.tsx`:**

Extract `ParseResultTable` from `message-list.tsx:254-313` as-is into its own file, exporting it.

**Create `apps/web/src/components/message-inbox/detail-panel.tsx`:**

The detail panel component. Contains:
- Meta section with status dropdown (from lines 624-655)
- Editable message content (from lines 546-567)
- ParseResultTable
- AI test result (from lines 573-613)
- Comments section (from lines 714-735)
- Sticky action bar with AI/Parse/Pin/Copy/Delete buttons (from lines 657-710)
- EmptyState when no message selected

Full implementation: Port the expanded-row code from `message-list.tsx` into a standalone panel component. Props:

```typescript
interface DetailPanelProps {
  message: RawMessage | null;
  localState: MessageLocalStateHook;
}
```

State managed internally:
- `editingMsgId`, `editDraft` (message editing)
- `commentDraft` (comment input)
- `aiTestResult` (AI test cache)
- `aiTestLoading` (loading state)
- `isPending` (transition state for server actions)

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add apps/web/src/components/message-inbox/detail-panel.tsx apps/web/src/components/message-inbox/parse-result-table.tsx apps/web/src/components/message-inbox/constants.ts
git commit -m "feat(web): add MessageDetailPanel with actions, AI test, comments"
```

---

### Task 4: Create OrderPanel

Right panel wrapping `ManualParseForm` with order info display.

**Files:**
- Create: `apps/web/src/components/message-inbox/order-panel.tsx`

**Step 1: Create the component**

3 states:
1. No message selected → greyed placeholder
2. Message has order → show order info + link
3. Message has no order → render `ManualParseForm`

```typescript
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManualParseForm } from "@/components/manual-parse-form";
import type { RawMessage, Hospital, Product } from "@/lib/types";

interface OrderPanelProps {
  message: RawMessage | null;
  hospitals: Hospital[];
  products: Product[];
}

export function OrderPanel({ message, hospitals, products }: OrderPanelProps) {
  const router = useRouter();

  if (!message) {
    return (
      <div className="flex flex-col w-[280px] shrink-0 border-l">
        <div className="px-3 py-2 border-b">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">주문</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">메시지를 선택하세요</p>
        </div>
      </div>
    );
  }

  if (message.order_id) {
    return (
      <div className="flex flex-col w-[280px] shrink-0 border-l">
        <div className="px-3 py-2 border-b">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">주문 정보</h3>
        </div>
        <div className="flex-1 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">주문 #{message.order_id}</span>
          </div>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={`/orders/${message.order_id}`}>주문 상세 보기</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[280px] shrink-0 border-l">
      <div className="px-3 py-2 border-b">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">주문 생성</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <ManualParseForm
          messageId={message.id}
          hospitals={hospitals}
          products={products}
          onSuccess={() => router.refresh()}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add apps/web/src/components/message-inbox/order-panel.tsx
git commit -m "feat(web): add OrderPanel for messages 3-panel inbox"
```

---

### Task 5: Create MessageInbox orchestrator

Main container that connects all 3 panels + BulkActionBar.

**Files:**
- Create: `apps/web/src/components/message-inbox/index.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Bot, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { InboxFilterBar } from "./filter-bar";
import { MessageListPanel } from "./list-panel";
import { MessageDetailPanel } from "./detail-panel";
import { OrderPanel } from "./order-panel";
import { useMessageLocalState } from "@/hooks/use-message-local-state";
import { useRowSelection } from "@/hooks/use-row-selection";
import { reparseMessages, deleteMessages } from "@/lib/actions";
import type { RawMessage, Hospital, Product } from "@/lib/types";

interface MessageInboxProps {
  messages: RawMessage[];
  hospitals: Hospital[];
  products: Product[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function MessageInbox({
  messages, hospitals, products, currentPage, totalPages, totalCount,
}: MessageInboxProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const localState = useMessageLocalState();
  const allIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const rowSelection = useRowSelection(allIds);

  const selectedMsg = messages.find((m) => m.id === selectedId) ?? null;
  const pendingCount = messages.filter((m) => m.parse_status === "pending" || m.parse_status === "failed").length;

  return (
    <div className="flex flex-col">
      <InboxFilterBar totalCount={totalCount} pendingCount={pendingCount} />

      <div className="flex h-[calc(100vh-13rem)] rounded-lg border overflow-hidden">
        <MessageListPanel
          messages={messages}
          selectedId={selectedId}
          onSelect={setSelectedId}
          localState={localState}
          rowSelection={rowSelection}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
        />
        <MessageDetailPanel
          message={selectedMsg}
          localState={localState}
        />
        <OrderPanel
          message={selectedMsg}
          hospitals={hospitals}
          products={products}
        />
      </div>

      {/* Bulk action bar */}
      {rowSelection.count > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background/95 backdrop-blur px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium whitespace-nowrap">{rowSelection.count}개 선택됨</span>
          <Button size="sm" disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                try {
                  const result = await reparseMessages(Array.from(rowSelection.selected));
                  const successCount = result.results.filter((r) => r.data && !r.error).length;
                  const failCount = result.results.filter((r) => r.error).length;
                  toast.success(`일괄 파싱 완료: ${successCount}개 성공${failCount > 0 ? `, ${failCount}개 실패` : ""}`);
                  rowSelection.clear();
                  router.refresh();
                } catch { toast.error("일괄 파싱에 실패했습니다."); }
              });
            }}
          >
            <Bot className="h-4 w-4 mr-1" />일괄 파싱
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={isPending}>
                <Trash2 className="h-4 w-4 mr-1" />삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{rowSelection.count}개 메시지를 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await deleteMessages(Array.from(rowSelection.selected));
                        toast.success(`${rowSelection.count}개 메시지가 삭제되었습니다.`);
                        rowSelection.clear();
                        router.refresh();
                      } catch (err) { toast.error(`삭제 실패: ${err instanceof Error ? err.message : String(err)}`); }
                    });
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button size="sm" variant="ghost" onClick={rowSelection.clear} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add apps/web/src/components/message-inbox/index.tsx
git commit -m "feat(web): add MessageInbox orchestrator connecting 3 panels"
```

---

### Task 6: Wire up page.tsx

Replace `MessageTable` with `MessageInbox` in the list tab.

**Files:**
- Modify: `apps/web/src/app/(dashboard)/messages/page.tsx`

**Step 1: Update imports and tab content**

Replace the Card-wrapped `MessageTable` with `MessageInbox`:

```typescript
// Change imports
import { CreateMessageDialog } from "@/components/message-list";  // keep only this
import { MessageInbox } from "@/components/message-inbox";        // new
// Remove: MessageFilters, MessageTable, Card*, Pagination imports

// Replace list tab content (lines 78-91):
{
  value: "list",
  label: "목록",
  content: (
    <MessageInbox
      messages={result.messages}
      hospitals={hospitalsResult.hospitals}
      products={productsResult.products}
      currentPage={page}
      totalPages={totalPages}
      totalCount={result.total}
    />
  ),
},
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: Compiled successfully. No errors.

**Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/messages/page.tsx
git commit -m "feat(web): wire MessageInbox into messages page, replacing table layout"
```

---

### Task 7: Clean up message-list.tsx

Remove `MessageTable`, `MessageFilters`, `ParseResultTable` and helper functions from `message-list.tsx`. Keep only `CreateMessageDialog` since it's still used in the page header.

**Files:**
- Modify: `apps/web/src/components/message-list.tsx`

**Step 1: Reduce to CreateMessageDialog only**

Keep lines 1-250 (imports + constants + CreateMessageDialog). Delete everything else (MessageFilters, ParseResultTable, MessageTable — lines 96-157, 254-814).

Actually, since `CreateMessageDialog` is the only export needed, it's cleaner to keep only that and its dependencies. Remove unused imports (`Table*`, `ResizableTh`, `useResizableColumns`, `useRowSelection`, `useMessageLocalState`, `ManualParseForm`, sort icons, etc.).

The resulting file should be ~100 lines: just `CreateMessageDialog` with its imports.

**Step 2: Verify no other files import the removed exports**

Search for `MessageFilters`, `MessageTable` imports — they should only be in `page.tsx` (already updated in Task 6).

**Step 3: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "refactor(web): remove old table-based message components, keep CreateMessageDialog"
```

---

### Task 8: Build verification and visual test

**Step 1: Full build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Compiled successfully with all routes.

**Step 2: Dev server smoke test**

Run: `cd apps/web && npm run dev`

Verify in browser:
1. `/messages` — 3-panel layout visible (list | detail | order)
2. Click a message card → detail panel shows content, parse result, actions
3. Click AI 파싱 button → test result appears in detail panel
4. Order panel shows ManualParseForm for messages without orders
5. Order panel shows order info for messages with orders
6. Filter bar works (date, status, source filters)
7. Multi-select → bulk action bar appears at bottom
8. Calendar tab still works unchanged
9. 메시지 등록 button still opens CreateMessageDialog

**Step 3: Final commit**

```bash
git commit -m "feat(web): complete messages 3-panel inbox redesign"
```

---

## File Summary

| Action | File | Lines (est.) |
|--------|------|-------------|
| CREATE | `components/message-inbox/constants.ts` | ~25 |
| CREATE | `components/message-inbox/filter-bar.tsx` | ~60 |
| CREATE | `components/message-inbox/list-panel.tsx` | ~140 |
| CREATE | `components/message-inbox/parse-result-table.tsx` | ~60 |
| CREATE | `components/message-inbox/detail-panel.tsx` | ~350 |
| CREATE | `components/message-inbox/order-panel.tsx` | ~70 |
| CREATE | `components/message-inbox/index.tsx` | ~120 |
| MODIFY | `app/(dashboard)/messages/page.tsx` | ~15 lines changed |
| MODIFY | `message-list.tsx` | ~700 lines removed |
| MODIFY | `hooks/use-message-local-state.ts` | +1 line (type export) |
| MODIFY | `hooks/use-row-selection.ts` | +1 line (type export) |

**Net effect:** ~825 lines new, ~700 lines removed. Code is more modular with clear separation of concerns.

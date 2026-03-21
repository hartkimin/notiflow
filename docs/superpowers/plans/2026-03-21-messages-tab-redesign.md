# Messages Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the messages tab 3-panel layout with a table+accordion view, add multi-select order creation, remove all AI parsing code, and add bidirectional calendar sync.

**Architecture:** The messages tab will use a data table with expandable accordion rows. Selected messages can be sent to the existing `orders/new` page with notes auto-generated from message content. All AI parsing infrastructure (UI, API routes, server logic) will be removed. The calendar tab will share URL filters with the list tab and support click-to-navigate.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, shadcn/ui, Tailwind CSS 4, Supabase

**Spec:** `docs/superpowers/specs/2026-03-21-messages-tab-redesign-design.md`

---

## File Structure

### Files to Delete
- `apps/web/src/components/message-inbox/list-panel.tsx`
- `apps/web/src/components/message-inbox/detail-panel.tsx`
- `apps/web/src/components/message-inbox/order-panel.tsx`
- `apps/web/src/components/message-inbox/parse-result-table.tsx`
- `apps/web/src/components/message-inbox/filter-bar.tsx`
- `apps/web/src/components/manual-parse-form.tsx`
- `apps/web/src/lib/parse-service.ts`
- `apps/web/src/lib/parser.ts`
- `apps/web/src/lib/ai-client.ts`
- `apps/web/src/app/api/test-parse/route.ts`
- `apps/web/src/app/api/parse/route.ts`

### Files to Create
- `apps/web/src/components/message-inbox/message-table.tsx` — Table header + row mapping
- `apps/web/src/components/message-inbox/message-row.tsx` — Individual row + accordion toggle
- `apps/web/src/components/message-inbox/accordion-detail.tsx` — Expanded detail (content, meta, comments, actions)
- `apps/web/src/components/message-inbox/bulk-action-bar.tsx` — Floating bottom bar for multi-select actions

### Files to Modify
- `apps/web/src/hooks/use-row-selection.ts` — Change ID type from `number` to `string`
- `apps/web/src/lib/types.ts` — Remove `RawMessage` parse fields, change `UnifiedMessage.id` to `string`
- `apps/web/src/lib/queries/messages.ts` — Remove parse legacy mapping, add filter params to calendar query, clean up `parse_status` param from `getMessages`
- `apps/web/src/lib/actions.ts` — Remove `reparseMessage`, `reparseMessages`
- `apps/web/src/components/message-inbox/index.tsx` — Replace 3-panel with table, remove sidebar collapse
- `apps/web/src/components/message-inbox/constants.ts` — Remove `STATUS_LABEL` (parse-status based)
- `apps/web/src/components/messages-view.tsx` — Remove parse_status filter, add highlight param, remove pendingCount (keep hospitals/products for ForecastDialog)
- `apps/web/src/app/(dashboard)/messages/page.tsx` — Remove parse_status param, pass filters to calendar query (keep getHospitals/getProductsCatalog for forecast dialogs)
- `apps/web/src/app/(dashboard)/messages/actions.ts` — Clean up `createManualOrder` (remove parse-related refs)
- `apps/web/src/components/message-calendar.tsx` — Remove parse_status/parse_result from STATUS_VARIANTS, MessageDetailContent, parseStatusLabel; add click-to-list navigation
- `apps/web/src/app/(dashboard)/orders/new/page.tsx` — Handle `source_message_ids` param, fetch messages, generate notes
- `apps/web/src/app/(dashboard)/orders/actions.ts` — Verify `source_message_id` handling with string IDs
- `apps/web/src/components/purchase-order-form.tsx` — Accept `initialNotes` prop

---

## Task 1: Remove AI Parsing Server Logic & API Routes

Delete parsing infrastructure that other tasks depend on being gone.

**Files:**
- Delete: `apps/web/src/lib/parse-service.ts`
- Delete: `apps/web/src/lib/parser.ts`
- Delete: `apps/web/src/lib/ai-client.ts`
- Delete: `apps/web/src/app/api/test-parse/route.ts`
- Delete: `apps/web/src/app/api/parse/route.ts`
- Modify: `apps/web/src/lib/actions.ts`

- [ ] **Step 1: Delete parse-service.ts, parser.ts, ai-client.ts**

```bash
rm apps/web/src/lib/parse-service.ts
rm apps/web/src/lib/parser.ts
rm apps/web/src/lib/ai-client.ts
```

- [ ] **Step 2: Delete API routes**

```bash
rm -rf apps/web/src/app/api/test-parse
rm -rf apps/web/src/app/api/parse
```

- [ ] **Step 3: Remove reparseMessage and reparseMessages from lib/actions.ts**

In `apps/web/src/lib/actions.ts`, find and remove the `reparseMessage` and `reparseMessages` functions entirely. These are stubs returning "unsupported". Also remove any imports that are no longer referenced (e.g., `parseMessageCore` from `parse-service`).

Search for: `export async function reparseMessage` and `export async function reparseMessages` — delete both functions completely.

- [ ] **Step 4: Verify no remaining imports of deleted files**

Run:
```bash
cd apps/web && grep -r "parse-service\|ai-client\|test-parse\|/api/parse\|from.*parser" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
```
Expected: No matches (or only `parser` in unrelated contexts). Fix any remaining imports.

- [ ] **Step 5: Verify build compiles**

Run: `cd apps/web && npx next build 2>&1 | head -50`
Expected: Build starts without import errors. (Full build may fail until later tasks complete.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove AI parsing server logic and API routes

Delete parse-service.ts, parser.ts, ai-client.ts, /api/parse,
/api/test-parse. Remove reparseMessage/reparseMessages stubs
from lib/actions.ts."
```

---

## Task 2: Clean Up Types and ID System

Change ID types from `number` to `string` to match `captured_messages.id` (TEXT in DB).

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/queries/messages.ts`
- Modify: `apps/web/src/hooks/use-row-selection.ts`
- Modify: `apps/web/src/components/message-inbox/constants.ts`

- [ ] **Step 1: Update RawMessage in types.ts**

In `apps/web/src/lib/types.ts`, find the `RawMessage` interface (around line 244) and update:

```typescript
export interface RawMessage {
  id: string;
  content: string;
  received_at: string;
  sender: string | null;
  source_app: string;
  hospital_id: number | null;
  order_id: number | null;
  device_name: string | null;
  is_order_message: boolean | null;
  forecast_id?: number | null;
}
```

Remove: `parse_status`, `parse_result`, `parse_method` fields.

- [ ] **Step 2: Update UnifiedMessage in queries/messages.ts**

In `apps/web/src/lib/queries/messages.ts`, update the `UnifiedMessage` interface:

```typescript
export interface UnifiedMessage extends RawMessage {
  is_captured: boolean;
  app_name: string;
  room_name: string | null;
  category_id?: string | null;
  status_id?: string | null;
}
```

Update `mapCaptured` to set `id: m.id` (string, no `Number()` conversion) and remove `parse_status`, `parse_result`, `parse_method` mappings:

```typescript
function mapCaptured(m: CapturedMessage): UnifiedMessage {
  return {
    id: m.id,
    content: m.content,
    received_at: new Date(m.received_at).toISOString(),
    sender: m.sender,
    source_app: m.app_name,
    hospital_id: null,
    order_id: null,
    device_name: m.device_id,
    is_order_message: null,
    is_captured: true,
    app_name: m.app_name,
    room_name: m.room_name,
    category_id: m.category_id,
    status_id: m.status_id,
  };
}
```

- [ ] **Step 3: Update useRowSelection to use string IDs**

In `apps/web/src/hooks/use-row-selection.ts`, change all `number` types to `string`:

```typescript
export function useRowSelection(allIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === allIds.length && allIds.every((id) => prev.has(id))) {
        return new Set();
      }
      return new Set(allIds);
    });
  }, [allIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const count = useMemo(
    () => allIds.filter((id) => selected.has(id)).length,
    [allIds, selected],
  );

  const allSelected = count > 0 && count === allIds.length;
  const someSelected = count > 0 && count < allIds.length;

  return { selected, toggle, toggleAll, clear, count, allSelected, someSelected };
}
```

- [ ] **Step 4: Clean up constants.ts**

In `apps/web/src/components/message-inbox/constants.ts`, remove `STATUS_LABEL` (parse-status based). Keep `SOURCE_LABEL`, `formatDate`, `formatDateTime`.

- [ ] **Step 5: Fix any TypeScript errors caused by ID type change**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -80`

The main callers using `number` IDs will be `message-inbox/index.tsx` (which will be rewritten in Task 4) and `lib/actions.ts` (`deleteMessage`/`deleteMessages` which already accept `number | string`). Fix any type errors in files that will persist.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: change message ID type to string, remove parse fields

UnifiedMessage.id is now string to match captured_messages.id (TEXT).
Removed parse_status/parse_result/parse_method from RawMessage.
Updated useRowSelection to use string IDs."
```

---

## Task 3: Replace 3-Panel with Table+Accordion Components

Delete old panel files and create new table components in the same task to avoid a broken intermediate state (index.tsx imports panels that no longer exist).

**Files:**
- Delete: `apps/web/src/components/message-inbox/list-panel.tsx`
- Delete: `apps/web/src/components/message-inbox/detail-panel.tsx`
- Delete: `apps/web/src/components/message-inbox/order-panel.tsx`
- Delete: `apps/web/src/components/message-inbox/parse-result-table.tsx`
- Delete: `apps/web/src/components/message-inbox/filter-bar.tsx`
- Delete: `apps/web/src/components/manual-parse-form.tsx`
- Create: `apps/web/src/components/message-inbox/message-table.tsx`
- Create: `apps/web/src/components/message-inbox/message-row.tsx`
- Create: `apps/web/src/components/message-inbox/accordion-detail.tsx`
- Create: `apps/web/src/components/message-inbox/bulk-action-bar.tsx`
- Modify: `apps/web/src/components/message-inbox/index.tsx`

- [ ] **Step 1: Delete old panel components and parse UI**

```bash
rm apps/web/src/components/message-inbox/list-panel.tsx
rm apps/web/src/components/message-inbox/detail-panel.tsx
rm apps/web/src/components/message-inbox/order-panel.tsx
rm apps/web/src/components/message-inbox/parse-result-table.tsx
rm apps/web/src/components/message-inbox/filter-bar.tsx
rm apps/web/src/components/manual-parse-form.tsx
```

- [ ] **Step 1: Create accordion-detail.tsx**

This component renders the expanded content when a row is clicked. Two-column layout: left (full message content + meta info), right (comments + action buttons).

Create `apps/web/src/components/message-inbox/accordion-detail.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pin, PinOff, Copy, Pencil, Trash2, X } from "lucide-react";
import { deleteMessage } from "@/lib/actions";
import { formatDateTime } from "./constants";
import type { UnifiedMessage } from "@/lib/queries/messages";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";

interface AccordionDetailProps {
  message: UnifiedMessage;
  localState: MessageLocalStateHook;
}

export function AccordionDetail({ message, localState }: AccordionDetailProps) {
  const router = useRouter();
  const msg = message;
  const msgLocal = localState.getState(msg.id);
  const displayContent = msgLocal.editedContent ?? msg.content;

  const [editingMsg, setEditingMsg] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [deleting, setDeleting] = useState(false);

  function handleStartEdit() {
    setEditingMsg(true);
    setEditDraft(msgLocal.editedContent ?? msg.content);
  }

  function handleSaveEdit() {
    const trimmed = editDraft.trim();
    const content = trimmed === msg.content.trim() ? null : trimmed;
    localState.setEditedContent(msg.id, content);
    setEditingMsg(false);
    setEditDraft("");
    toast.success("메모가 저장되었습니다.");
  }

  function handleCancelEdit() {
    setEditingMsg(false);
    setEditDraft("");
  }

  function handleAddComment() {
    const text = commentDraft.trim();
    if (!text) return;
    localState.addComment(msg.id, text);
    setCommentDraft("");
  }

  function handleCopyContent() {
    navigator.clipboard.writeText(displayContent);
    toast.success("클립보드에 복사되었습니다.");
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMessage(msg.id);
      toast.success("메시지가 삭제되었습니다.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid grid-cols-[1fr_280px] gap-4 px-12 py-3 border-t border-blue-100 bg-blue-50/30">
      {/* Left: Content + Meta */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase">
            메시지 내용 {msgLocal.editedContent !== null && <span className="text-orange-500">(편집됨)</span>}
          </span>
          {!editingMsg && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleStartEdit}>
              <Pencil className="h-3 w-3 mr-1" />편집
            </Button>
          )}
        </div>
        {editingMsg ? (
          <div className="space-y-1.5">
            <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={4} className="text-sm font-sans" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="h-7" onClick={handleCancelEdit}>취소</Button>
              <Button size="sm" className="h-7" onClick={handleSaveEdit}>저장</Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-white border p-3">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-snug">{displayContent}</pre>
          </div>
        )}
        <div className="flex gap-3 mt-2 flex-wrap">
          {msg.device_name && <span className="text-[10px] text-muted-foreground">기기: {msg.device_name}</span>}
          {msg.category_id && <span className="text-[10px] text-muted-foreground">카테고리: {msg.category_id}</span>}
          <span className="text-[10px] text-muted-foreground">수신: {formatDateTime(msg.received_at)}</span>
        </div>
      </div>

      {/* Right: Comments + Actions */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase">코멘트</span>
        {msgLocal.comments.length > 0 && (
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {msgLocal.comments.map((comment) => (
              <div key={comment.id} className="flex items-center justify-between gap-2 rounded border bg-white px-2 py-1">
                <p className="text-xs break-words min-w-0 flex-1">{comment.text}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(comment.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => localState.deleteComment(msg.id, comment.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          <Input
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
            placeholder="코멘트 추가..."
            className="text-xs h-7 flex-1"
          />
          <Button size="sm" variant="secondary" className="h-7 text-xs px-2"
            onClick={handleAddComment} disabled={!commentDraft.trim()}>추가</Button>
        </div>
        <div className="flex gap-1 mt-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-1"
            onClick={() => localState.togglePin(msg.id)}>
            {msgLocal.isPinned ? <PinOff className="h-3 w-3 mr-1" /> : <Pin className="h-3 w-3 mr-1" />}
            {msgLocal.isPinned ? "핀 해제" : "핀 고정"}
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleCopyContent}>
            <Copy className="h-3 w-3 mr-1" />복사
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-destructive border-destructive/30" disabled={deleting}>
                <Trash2 className="h-3 w-3 mr-1" />삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>메시지를 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create message-row.tsx**

Individual table row with click-to-expand accordion behavior.

Create `apps/web/src/components/message-inbox/message-row.tsx`:

```tsx
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccordionDetail } from "./accordion-detail";
import { SOURCE_LABEL, formatDateTime } from "./constants";
import type { UnifiedMessage } from "@/lib/queries/messages";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";
import type { RowSelectionHook } from "@/hooks/use-row-selection";

const SOURCE_COLOR: Record<string, string> = {
  kakaotalk: "bg-yellow-300 text-yellow-900",
  sms: "bg-gray-200 text-gray-700",
  telegram: "bg-sky-500 text-white",
  manual: "bg-gray-100 text-gray-600",
};

interface MessageRowProps {
  message: UnifiedMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  localState: MessageLocalStateHook;
  rowSelection: RowSelectionHook;
  ref?: React.Ref<HTMLDivElement>;
}

export function MessageRow({ message, isExpanded, onToggleExpand, localState, rowSelection, ref }: MessageRowProps) {
    const msg = message;
    const msgLocal = localState.getState(msg.id);
    const statusStep = localState.steps.find((s) => s.id === msgLocal.statusId);
    const isChecked = rowSelection.selected.has(msg.id);

    return (
      <div
        ref={ref}
        className={cn(
          isChecked && "bg-blue-50/60",
          isExpanded && "bg-blue-50/40",
          isChecked && isExpanded && "border-l-3 border-l-blue-500",
        )}
      >
        <div
          className="grid grid-cols-[36px_130px_80px_120px_120px_1fr_80px] items-center px-3 py-2 border-b cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={onToggleExpand}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => rowSelection.toggle(msg.id)}
            />
          </div>
          <div className="text-xs text-muted-foreground">{formatDateTime(msg.received_at)}</div>
          <div>
            <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium", SOURCE_COLOR[msg.source_app] || "bg-gray-100")}>
              {SOURCE_LABEL[msg.source_app] || msg.source_app}
            </span>
          </div>
          <div className="text-xs font-medium truncate">{msg.sender || "(발신자 없음)"}</div>
          <div className="text-xs text-muted-foreground truncate">{msg.room_name || "-"}</div>
          <div className="text-xs text-muted-foreground truncate">{msg.content}</div>
          <div className="flex items-center justify-center gap-1">
            {statusStep ? (
              <span className="inline-flex items-center gap-1 text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStep.color }} />
                {statusStep.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                미지정
              </span>
            )}
            {msgLocal.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
          </div>
        </div>
        {isExpanded && (
          <AccordionDetail message={msg} localState={localState} />
        )}
      </div>
    );
}
```

- [ ] **Step 3: Create message-table.tsx**

Table header + row list.

Create `apps/web/src/components/message-inbox/message-table.tsx`:

```tsx
"use client";

import { useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageRow } from "./message-row";
import { Pagination } from "@/components/pagination";
import type { RawMessage } from "@/lib/types";
import type { MessageLocalStateHook } from "@/hooks/use-message-local-state";
import type { RowSelectionHook } from "@/hooks/use-row-selection";

interface MessageTableProps {
  messages: RawMessage[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  localState: MessageLocalStateHook;
  rowSelection: RowSelectionHook;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  highlightId?: string | null;
}

export function MessageTable({
  messages, expandedId, onToggleExpand,
  localState, rowSelection,
  currentPage, totalPages, totalCount,
  highlightId,
}: MessageTableProps) {
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to highlighted row on mount
  useEffect(() => {
    if (highlightId) {
      const el = rowRefs.current.get(highlightId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightId]);

  return (
    <div className="flex flex-col h-full">
      {/* Table Header */}
      <div className="grid grid-cols-[36px_130px_80px_120px_120px_1fr_80px] items-center px-3 py-1.5 border-b-2 text-[11px] font-semibold text-muted-foreground bg-muted/30">
        <div>
          <Checkbox
            checked={rowSelection.allSelected}
            onCheckedChange={rowSelection.toggleAll}
            aria-label="전체 선택"
          />
        </div>
        <div>수신시간</div>
        <div>출처</div>
        <div>발신자</div>
        <div>채팅방</div>
        <div>내용</div>
        <div className="text-center">상태</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((msg) => (
          <MessageRow
            key={msg.id}
            ref={(el) => {
              if (el) rowRefs.current.set(msg.id, el);
              else rowRefs.current.delete(msg.id);
            }}
            message={msg}
            isExpanded={expandedId === msg.id}
            onToggleExpand={() => onToggleExpand(msg.id)}
            localState={localState}
            rowSelection={rowSelection}
          />
        ))}
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

- [ ] **Step 4: Create bulk-action-bar.tsx**

Floating bottom action bar for multi-select.

Create `apps/web/src/components/message-inbox/bulk-action-bar.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ClipboardList, Trash2, X } from "lucide-react";
import { deleteMessages } from "@/lib/actions";
import type { RowSelectionHook } from "@/hooks/use-row-selection";

interface BulkActionBarProps {
  rowSelection: RowSelectionHook;
}

export function BulkActionBar({ rowSelection }: BulkActionBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (rowSelection.count === 0) return null;

  function handleCreateOrder() {
    const ids = Array.from(rowSelection.selected).join(",");
    router.push(`/orders/new?source_message_ids=${ids}`);
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border-2 border-blue-500 bg-background/95 backdrop-blur px-4 py-2.5 shadow-lg">
      <span className="text-sm font-semibold whitespace-nowrap">{rowSelection.count}개 선택됨</span>
      <Button size="sm" onClick={handleCreateOrder} disabled={isPending}>
        <ClipboardList className="h-4 w-4 mr-1" />주문 생성
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
  );
}
```

- [ ] **Step 5: Rewrite message-inbox/index.tsx**

Replace 3-panel layout with table + bulk action bar.

Rewrite `apps/web/src/components/message-inbox/index.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MessageTable } from "./message-table";
import { BulkActionBar } from "./bulk-action-bar";
import { useMessageLocalState } from "@/hooks/use-message-local-state";
import { useRowSelection } from "@/hooks/use-row-selection";
import type { RawMessage } from "@/lib/types";

interface MessageInboxProps {
  messages: RawMessage[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function MessageInbox({
  messages, currentPage, totalPages, totalCount,
}: MessageInboxProps) {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [expandedId, setExpandedId] = useState<string | null>(highlightId);
  const localState = useMessageLocalState();
  const allIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const rowSelection = useRowSelection(allIds);

  function handleToggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col border rounded-lg h-[calc(100vh-9rem)]">
      <MessageTable
        messages={messages}
        expandedId={expandedId}
        onToggleExpand={handleToggleExpand}
        localState={localState}
        rowSelection={rowSelection}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        highlightId={highlightId}
      />
      <BulkActionBar rowSelection={rowSelection} />
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -40`
Fix any type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add table+accordion message components

New components: message-table, message-row, accordion-detail,
bulk-action-bar. Rewrote message-inbox/index.tsx from 3-panel
to single table layout with expandable rows."
```

---

## Task 5: Update Messages View and Page

Update the parent view to remove parse_status filter, add highlight support, and pass correct props.

**Files:**
- Modify: `apps/web/src/components/messages-view.tsx`
- Modify: `apps/web/src/app/(dashboard)/messages/page.tsx`

- [ ] **Step 1: Update messages-view.tsx**

Key changes to `apps/web/src/components/messages-view.tsx`:

1. Remove `parse_status` from the filter form (remove the Select with "파싱완료/대기/실패/건너뜀" options).
2. Remove `pendingCount` calculation (lines 119-121).
3. Remove the `pendingCount` display from the toolbar summary.
4. Remove `hospitals` and `products` props from `MessageInbox` (no longer needed — order panel removed).
5. Add `highlight` searchParam pass-through.
6. Replace the `parse_status` filter with a `status_id` filter using `localState.steps` if available, or remove it entirely.

Update the `MessageInbox` component call — it now only takes `messages`, `currentPage`, `totalPages`, `totalCount`:

```tsx
<MessageInbox
  messages={messages}
  currentPage={currentPage}
  totalPages={totalPages}
  totalCount={totalCount}
/>
```

Remove `hospitals` and `products` imports from the `MessageInbox` props interface.

- [ ] **Step 2: Update messages/page.tsx**

Key changes to `apps/web/src/app/(dashboard)/messages/page.tsx`:

1. Remove `parse_status` from the `Props.searchParams` interface.
2. **Keep** `getHospitals` and `getProductsCatalog` — they are still needed by `ForecastDialog` and `ForecastBatchDialog` via `MessagesView`.
3. Pass `source_app` filter to `getMessagesForCalendar`:

```typescript
const [result, calendarMessages, hospitalsResult, productsResult, calendarForecasts] = await Promise.all([
  getMessages({ from: params.from, to: params.to, source_app: params.source_app, limit, offset })
    .catch(() => ({ messages: [], total: 0 })),
  getMessagesForCalendar({ from: fromStr, to: toStr, source_app: params.source_app }).catch(() => []),
  getHospitals({ limit: 500 }).catch(() => ({ hospitals: [], total: 0 })),
  getProductsCatalog().catch(() => []),
  getForecastsForCalendar({ from: fromStr, to: toStr }).catch(() => []),
]);
```

4. Keep `hospitals` and `products` props on `MessagesView` (forecast dialogs still need them). Only remove them from `MessageInbox`.

- [ ] **Step 3: Update getMessagesForCalendar in queries/messages.ts**

Add optional `source_app` param to `getMessagesForCalendar`:

```typescript
export async function getMessagesForCalendar(params: {
  from: string;
  to: string;
  source_app?: string;
}): Promise<UnifiedMessage[]> {
  const supabase = await createClient();

  const fromMs = new Date(params.from).getTime();
  const toMs = new Date(params.to).getTime();

  let query = supabase
    .from("captured_messages")
    .select("*")
    .gte("received_at", fromMs)
    .lt("received_at", toMs)
    .eq("is_deleted", false);

  if (params.source_app) {
    query = query.eq("app_name", params.source_app);
  }

  const { data, error } = await query.limit(200);

  if (error) console.error("captured_messages calendar query error:", JSON.stringify(error, null, 2));

  return (data ?? [] as CapturedMessage[]).map((m) => mapCaptured(m as CapturedMessage));
}
```

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -40`
Fix any type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: update messages view and page for table layout

Remove parse_status filter, pendingCount, hospitals/products props.
Add source_app filter to calendar query for bidirectional sync."
```

---

## Task 6: Calendar Bidirectional Sync

Add click-to-list navigation and remove parse_status badges from calendar.

**Files:**
- Modify: `apps/web/src/components/message-calendar.tsx`

- [ ] **Step 1: Remove all parse_status/parse_result references from message-calendar.tsx**

In `apps/web/src/components/message-calendar.tsx`, make these changes:

1. Remove the `STATUS_VARIANTS` constant (around line 35-39).
2. Remove the `parseStatusLabel()` function if it exists.
3. In `MessageDayItem` component: remove `<Badge variant={STATUS_VARIANTS[msg.parse_status]}>` and replace with a simple source badge or remove entirely.
4. In `MessageDetailContent` component (around line 200-334): remove the entire parse result display section that references `msg.parse_result`, `msg.parse_status`, and the parse result table. This is a substantial block — the whole "파싱 결과" section should be removed.
5. Remove any references to `msg.parse_method` as well.
6. For any `msg.id` passed to functions like `matchForecast(forecastId, msg.id)`, note that `msg.id` is now `string` — verify the `matchForecast` function in `messages/forecast-actions.ts` accepts string (it takes `messageId: number`, so update it to accept `number | string` or just `string`).

- [ ] **Step 2: Add click-to-list navigation**

When a message is clicked in the calendar view, navigate to the list tab with the message highlighted. The calendar uses `DataCalendar` which renders items via `renderDetail` or click handlers.

Add an `onMessageClick` callback prop to `MessageCalendar`:

```typescript
interface MessageCalendarProps {
  // ...existing props...
  onMessageClick?: (messageId: string) => void;
}
```

In the parent `MessagesView`, pass the handler:

```typescript
function handleCalendarMessageClick(messageId: string) {
  router.push(`/messages?tab=list&highlight=${messageId}`);
}

// In JSX:
<MessageCalendar
  // ...existing props...
  onMessageClick={handleCalendarMessageClick}
/>
```

Inside `MessageCalendar`, wire the callback to wherever messages are rendered (day cells, detail views). When a message item is clicked, call `onMessageClick(msg.id)` instead of showing inline detail.

- [ ] **Step 3: Verify calendar renders without errors**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -40`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: calendar bidirectional sync with list tab

Remove parse_status badges from calendar. Add click-to-list
navigation that highlights the clicked message in the table."
```

---

## Task 7: Clean Up Messages Actions and Orders Actions

Address spec items for `messages/actions.ts` and `orders/actions.ts`.

**Files:**
- Modify: `apps/web/src/app/(dashboard)/messages/actions.ts`
- Modify: `apps/web/src/app/(dashboard)/orders/actions.ts`
- Modify: `apps/web/src/app/(dashboard)/messages/forecast-actions.ts`

- [ ] **Step 1: Clean up messages/actions.ts**

In `apps/web/src/app/(dashboard)/messages/actions.ts`, review `createManualOrder`. This function creates orders from a single message. It can remain but verify it works with string message IDs (the `messageId` param is typed as `number` — update to `number | string`).

- [ ] **Step 2: Update forecast-actions.ts for string IDs**

In `apps/web/src/app/(dashboard)/messages/forecast-actions.ts`, the `matchForecast` function takes `messageId: number`. Update to accept `string`:

Find: `export async function matchForecast(forecastId: number, messageId: number)`
Replace: `export async function matchForecast(forecastId: number, messageId: string)`

The Supabase `.update()` call will handle the string value correctly since the DB column is TEXT.

- [ ] **Step 3: Verify orders/actions.ts handles string source_message_id**

In `apps/web/src/app/(dashboard)/orders/actions.ts`, check `createOrderWithDetailsAction`. It should already handle `source_message_id` as a string since the DB column is TEXT. Verify and fix if needed.

- [ ] **Step 4: Remove unused parse_status param from getMessages**

In `apps/web/src/lib/queries/messages.ts`, remove the `parse_status` param from the `getMessages` function signature since captured_messages has no such column.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: clean up messages/orders actions for string IDs

Update messageId params to string type. Remove unused parse_status
param from getMessages query."
```

---

## Task 8: Multi-Select Order Creation

Update the order creation flow to accept multiple message IDs and auto-generate notes.

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/new/page.tsx`
- Modify: `apps/web/src/components/purchase-order-form.tsx`
- Modify: `apps/web/src/lib/queries/messages.ts`

- [ ] **Step 1: Add getMessagesByIds to queries/messages.ts**

Add a new function to fetch multiple messages by their IDs:

```typescript
export async function getMessagesByIds(ids: string[]): Promise<UnifiedMessage[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("captured_messages")
    .select("*")
    .in("id", ids)
    .eq("is_deleted", false);

  if (error) console.error("captured_messages batch query error:", JSON.stringify(error, null, 2));

  return (data ?? [] as CapturedMessage[]).map((m) => mapCaptured(m as CapturedMessage));
}
```

- [ ] **Step 2: Add formatMessagesAsNotes helper**

Add to `apps/web/src/lib/queries/messages.ts`:

```typescript
export function formatMessagesAsNotes(messages: UnifiedMessage[]): string {
  return messages
    .map((m) => {
      const time = new Date(m.received_at).toLocaleString("ko-KR", {
        month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      });
      const source = m.app_name || m.source_app;
      return `[${source} | ${m.sender || "알 수 없음"} | ${time}]\n${m.content}`;
    })
    .join("\n---\n");
}
```

- [ ] **Step 3: Update orders/new/page.tsx**

Modify `apps/web/src/app/(dashboard)/orders/new/page.tsx` to handle `source_message_ids`:

```tsx
import { getOrderDisplayColumns, getOrderColumnWidths } from "@/lib/queries/settings";
import { getMessagesByIds, formatMessagesAsNotes } from "@/lib/queries/messages";
import { PurchaseOrderForm } from "@/components/purchase-order-form";

interface Props {
  searchParams: Promise<{ source_message_id?: string; source_message_ids?: string }>;
}

export default async function NewOrderPage({ searchParams }: Props) {
  const params = await searchParams;
  const [displayColumns, columnWidths] = await Promise.all([
    getOrderDisplayColumns(),
    getOrderColumnWidths(),
  ]);

  // Handle both single and multiple message IDs
  let sourceMessageIds: string[] = [];
  let initialNotes = "";

  if (params.source_message_ids) {
    sourceMessageIds = params.source_message_ids.split(",").filter(Boolean);
  } else if (params.source_message_id) {
    sourceMessageIds = [params.source_message_id];
  }

  if (sourceMessageIds.length > 0) {
    const messages = await getMessagesByIds(sourceMessageIds);
    initialNotes = formatMessagesAsNotes(messages);
  }

  return (
    <div className="space-y-4">
      <PurchaseOrderForm
        displayColumns={displayColumns}
        columnWidths={columnWidths}
        sourceMessageId={sourceMessageIds[0] || undefined}
        initialNotes={initialNotes}
      />
    </div>
  );
}
```

- [ ] **Step 4: Update PurchaseOrderForm to accept initialNotes**

In `apps/web/src/components/purchase-order-form.tsx`:

1. Add `initialNotes?: string` to the Props interface (around line 85-89).
2. Update the `notes` state initialization to use `initialNotes`:

Find: `const [notes, setNotes] = useState("");`
Replace: `const [notes, setNotes] = useState(initialNotes || "");`

3. Add `initialNotes` to the destructured props:

Find: `export function PurchaseOrderForm({ displayColumns, columnWidths, sourceMessageId }: Props)`
Replace: `export function PurchaseOrderForm({ displayColumns, columnWidths, sourceMessageId, initialNotes }: Props)`

- [ ] **Step 5: Verify build**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -40`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: multi-select order creation with auto-generated notes

Add getMessagesByIds and formatMessagesAsNotes helpers.
Update orders/new page to handle source_message_ids param.
PurchaseOrderForm now accepts initialNotes prop."
```

---

## Task 9: Final Cleanup and Verification

Remove remaining dead code, verify full build, and test.

**Files:**
- Modify: Various cleanup

- [ ] **Step 1: Remove dead imports across the codebase**

Run:
```bash
cd apps/web && grep -rn "parse-result-table\|manual-parse-form\|order-panel\|list-panel\|detail-panel\|filter-bar" src/ --include="*.ts" --include="*.tsx"
```
Remove any remaining imports of deleted files.

- [ ] **Step 2: Check for remaining parse_status references in UI code**

Run:
```bash
cd apps/web && grep -rn "parse_status\|parse_result\|parse_method\|reparseMessage\|reparseMessages" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules\|.next"
```
Remove any remaining references (types.ts may still have it in comments — that's fine).

- [ ] **Step 3: Full build verification**

Run: `cd apps/web && npm run build:web`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Lint check**

Run: `cd apps/web && npm run lint:web`
Fix any lint errors.

- [ ] **Step 5: Commit final cleanup**

```bash
git add -A
git commit -m "chore: final cleanup for messages tab redesign

Remove dead imports, fix remaining parse_status references,
verify build and lint pass."
```

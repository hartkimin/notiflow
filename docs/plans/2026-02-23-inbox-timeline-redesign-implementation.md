# Inbox Timeline Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the web dashboard's inbox (수신메시지) tab to match mobile app Timeline functionality — accordion detail view, user-defined status system, comments, pin/snooze, edit, copy, and disabled AI parsing UI.

**Architecture:** Refactor `message-list.tsx` (1,492 lines) by removing grid view and side sheet, replacing the accordion detail area with new features (status management, comments, pin/snooze, edit, copy). All new state lives in localStorage via a custom `useMessageLocalState` hook. No database changes.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (Radix + Tailwind v4), Sonner toasts, localStorage for client state.

---

### Task 1: Add TypeScript types for local state

**Files:**
- Modify: `apps/web/src/lib/types.ts` (append after line 282)

**Step 1: Add new type definitions to types.ts**

Append these types at the end of the file:

```typescript
// --- Inbox Local State (frontend-only, localStorage) ---

export interface StatusStep {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
}

export interface StatusChangeItem {
  id: string;
  fromStatusId: string | null;
  fromStatusName: string | null;
  toStatusId: string;
  toStatusName: string;
  changedAt: string;
}

export interface MessageComment {
  id: string;
  text: string;
  createdAt: string;
}

export interface MessageLocalData {
  statusId: string | null;
  statusHistory: StatusChangeItem[];
  isPinned: boolean;
  snoozeAt: string | null;
  comments: MessageComment[];
  editedContent: string | null;
}

export type MessageLocalStateMap = Record<number, MessageLocalData>;
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/types.ts
git commit -m "feat(web): add TypeScript types for inbox local state"
```

---

### Task 2: Create useMessageLocalState hook

**Files:**
- Create: `apps/web/src/hooks/use-message-local-state.ts`

**Step 1: Create the hook file**

```typescript
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { StatusStep, MessageLocalData, MessageLocalStateMap, StatusChangeItem, MessageComment } from "@/lib/types";

const STEPS_KEY = "notiflow-status-steps";
const STATES_KEY = "notiflow-message-states";

const DEFAULT_STEPS: StatusStep[] = [
  { id: "step-접수", name: "접수", color: "#3B82F6", orderIndex: 0 },
  { id: "step-확인중", name: "확인중", color: "#F59E0B", orderIndex: 1 },
  { id: "step-처리중", name: "처리중", color: "#8B5CF6", orderIndex: 2 },
  { id: "step-완료", name: "완료", color: "#10B981", orderIndex: 3 },
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyLocal(): MessageLocalData {
  return {
    statusId: null,
    statusHistory: [],
    isPinned: false,
    snoozeAt: null,
    comments: [],
    editedContent: null,
  };
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useMessageLocalState() {
  const [steps, setSteps] = useState<StatusStep[]>(DEFAULT_STEPS);
  const [states, setStates] = useState<MessageLocalStateMap>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setSteps(readJSON(STEPS_KEY, DEFAULT_STEPS));
    setStates(readJSON(STATES_KEY, {}));
    setHydrated(true);
  }, []);

  // Persist steps
  useEffect(() => {
    if (hydrated) writeJSON(STEPS_KEY, steps);
  }, [steps, hydrated]);

  // Persist states
  useEffect(() => {
    if (hydrated) writeJSON(STATES_KEY, states);
  }, [states, hydrated]);

  const sortedSteps = useMemo(
    () => [...steps].sort((a, b) => a.orderIndex - b.orderIndex),
    [steps],
  );

  const getState = useCallback(
    (msgId: number): MessageLocalData => states[msgId] ?? emptyLocal(),
    [states],
  );

  const updateState = useCallback(
    (msgId: number, updater: (prev: MessageLocalData) => MessageLocalData) => {
      setStates((prev) => ({
        ...prev,
        [msgId]: updater(prev[msgId] ?? emptyLocal()),
      }));
    },
    [],
  );

  // --- Status ---

  const changeStatus = useCallback(
    (msgId: number, newStatusId: string) => {
      updateState(msgId, (prev) => {
        const fromStep = steps.find((s) => s.id === prev.statusId);
        const toStep = steps.find((s) => s.id === newStatusId);
        const change: StatusChangeItem = {
          id: generateId(),
          fromStatusId: prev.statusId,
          fromStatusName: fromStep?.name ?? null,
          toStatusId: newStatusId,
          toStatusName: toStep?.name ?? newStatusId,
          changedAt: new Date().toISOString(),
        };
        return {
          ...prev,
          statusId: newStatusId,
          statusHistory: [change, ...prev.statusHistory],
        };
      });
    },
    [updateState, steps],
  );

  const clearStatus = useCallback(
    (msgId: number) => {
      updateState(msgId, (prev) => ({
        ...prev,
        statusId: null,
      }));
    },
    [updateState],
  );

  // --- Pin ---

  const togglePin = useCallback(
    (msgId: number) => {
      updateState(msgId, (prev) => ({ ...prev, isPinned: !prev.isPinned }));
    },
    [updateState],
  );

  // --- Snooze ---

  const setSnooze = useCallback(
    (msgId: number, snoozeAt: string | null) => {
      updateState(msgId, (prev) => ({ ...prev, snoozeAt }));
    },
    [updateState],
  );

  // --- Comments ---

  const addComment = useCallback(
    (msgId: number, text: string) => {
      const comment: MessageComment = {
        id: generateId(),
        text,
        createdAt: new Date().toISOString(),
      };
      updateState(msgId, (prev) => ({
        ...prev,
        comments: [comment, ...prev.comments],
      }));
    },
    [updateState],
  );

  const deleteComment = useCallback(
    (msgId: number, commentId: string) => {
      updateState(msgId, (prev) => ({
        ...prev,
        comments: prev.comments.filter((c) => c.id !== commentId),
      }));
    },
    [updateState],
  );

  // --- Edit content ---

  const setEditedContent = useCallback(
    (msgId: number, content: string | null) => {
      updateState(msgId, (prev) => ({ ...prev, editedContent: content }));
    },
    [updateState],
  );

  // --- Steps management ---

  const updateSteps = useCallback((newSteps: StatusStep[]) => {
    setSteps(newSteps);
  }, []);

  return {
    hydrated,
    steps: sortedSteps,
    getState,
    changeStatus,
    clearStatus,
    togglePin,
    setSnooze,
    addComment,
    deleteComment,
    setEditedContent,
    updateSteps,
  };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/hooks/use-message-local-state.ts
git commit -m "feat(web): add useMessageLocalState hook for localStorage state"
```

---

### Task 3: Refactor message-list.tsx — remove grid view, side sheet, and unused columns

This task strips out the grid view, side sheet, view toggle buttons, and removes the Order/Synced columns from the table. It also removes all AI-parsing-related action buttons from the accordion (they'll be replaced with disabled UI in Task 5).

**Files:**
- Modify: `apps/web/src/components/message-list.tsx`

**Step 1: Remove unused imports and simplify the component**

The full refactored file replaces `message-list.tsx`. Here is the complete structure of changes:

1. **Remove imports:** `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `LayoutList`, `LayoutGrid`, `ManualParseForm`
2. **Remove state variables:** `view`, `selected`, `showManualParse`, `isEditing`, `aiResult`, `aiError`, `isAiParsing`, `inlineAiResult`, `inlineAiError`, `inlineAiParsing`, `reparseTarget`, `selectedHospitalId`, `editSender`, `editSourceApp`, `editContent`, `editParseStatus`
3. **Remove functions:** `switchView`, `openEdit`, `handleUpdate`, `handleAiParse`, `handleInlineReparse`, `handleReparse`, `triggerReparse`, `triggerBulkReparse`, `confirmHospitalAndReparse`, `executeBulkReparse`
4. **Remove from `MessageTable` props:** `hospitals`, `products` (they're only used by Sheet and ManualParseForm)
5. **Remove JSX:** View toggle buttons (lines 621-629), entire grid view block (lines 848-1009), entire Sheet block (lines 1129-1488), hospital selection dialog (lines 1058-1127), AI test results in expanded row (lines 770-838), AI action buttons in expanded row (lines 724-768)
6. **Remove table columns:** `동기화` (synced_at) column, `주문` (order_id) column
7. **Remove SortKey entries:** `synced_at` from the SortKey type
8. **Update colSpan:** from 10 to 8 (for the expanded row)
9. **Disable bulk parse button** in bulk action bar — keep bulk delete
10. **Keep:** MessageFilters, CreateMessageDialog, ParseStepper, ParseResultTable (these stay but ParseStepper/ParseResultTable will become read-only in expanded row)

For the expanded row, after removing AI action buttons, keep only:
- `ParseStepper` (read-only)
- `ParseResultTable` (read-only)
- A placeholder `div` with comment `{/* New accordion content will be added in Task 4-7 */}`

**Step 2: Update messages page to stop passing hospitals/products to MessageTable**

In `apps/web/src/app/(dashboard)/messages/page.tsx`, keep fetching hospitals/products (they're still used by CreateMessageDialog via the server actions) but remove them from the `MessageTable` props:

Change line 62-65:
```tsx
<MessageTable messages={result.messages} />
```

**Step 3: Run dev server to verify compilation**

```bash
cd apps/web && npx next build --no-lint 2>&1 | head -30
```

Expected: Build succeeds (or at least no TypeScript errors in message-list.tsx)

**Step 4: Commit**

```bash
git add apps/web/src/components/message-list.tsx apps/web/src/app/\(dashboard\)/messages/page.tsx
git commit -m "refactor(web): strip grid view, side sheet, and unused columns from inbox"
```

---

### Task 4: Add status management to accordion

**Files:**
- Modify: `apps/web/src/components/message-list.tsx`

**Step 1: Wire up useMessageLocalState hook and add status UI to accordion**

In `MessageTable`, add:

```typescript
import { useMessageLocalState } from "@/hooks/use-message-local-state";
import { Pin, PinOff, Clock, Copy, Pencil, MessageSquare } from "lucide-react";
```

Inside `MessageTable` component body:

```typescript
const localState = useMessageLocalState();
```

Replace the table's Status column content (currently showing `parse_status` badge) with the user-defined status:

```tsx
<TableCell>
  {(() => {
    const ls = localState.getState(msg.id);
    const step = localState.steps.find(s => s.id === ls.statusId);
    if (step) {
      return (
        <Badge
          variant="outline"
          style={{ borderColor: step.color, color: step.color, backgroundColor: `${step.color}15` }}
        >
          {step.name}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        미지정
      </Badge>
    );
  })()}
</TableCell>
```

In the expanded accordion area, add the status change section:

```tsx
{/* Status Management */}
<div className="flex items-center gap-3 flex-wrap">
  <span className="text-sm font-medium text-muted-foreground">상태:</span>
  <Select
    value={localState.getState(msg.id).statusId ?? "none"}
    onValueChange={(val) => {
      if (val === "none") localState.clearStatus(msg.id);
      else localState.changeStatus(msg.id, val);
    }}
  >
    <SelectTrigger className="w-40 h-8">
      <SelectValue placeholder="상태 선택" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">미지정</SelectItem>
      {localState.steps.map((step) => (
        <SelectItem key={step.id} value={step.id}>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: step.color }}
            />
            {step.name}
          </span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

{/* Status History */}
{localState.getState(msg.id).statusHistory.length > 0 && (
  <div className="space-y-1">
    <span className="text-xs font-medium text-muted-foreground">상태 변경 이력:</span>
    <div className="flex flex-wrap gap-1.5">
      {localState.getState(msg.id).statusHistory.slice(0, 5).map((h) => (
        <span key={h.id} className="text-xs text-muted-foreground">
          {h.fromStatusName ?? "미지정"} → {h.toStatusName}
          <span className="ml-1 opacity-60">
            ({new Date(h.changedAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })})
          </span>
        </span>
      ))}
    </div>
  </div>
)}
```

**Step 2: Add pin/snooze indicators to table row**

After the ID column (or before Sender), add inline indicators:

```tsx
<TableCell className="font-mono text-xs">
  <span className="inline-flex items-center gap-1">
    <ChevronRight className={`h-3 w-3 transition-transform ${expandedId === msg.id ? "rotate-90" : ""}`} />
    {msg.id}
    {localState.getState(msg.id).isPinned && <Pin className="h-3 w-3 text-amber-500" />}
    {localState.getState(msg.id).snoozeAt && new Date(localState.getState(msg.id).snoozeAt!) > new Date() && (
      <Clock className="h-3 w-3 text-blue-500" />
    )}
  </span>
</TableCell>
```

**Step 3: Sort pinned messages to top**

In the `sorted` useMemo, add pin-first sorting:

```typescript
const sorted = useMemo(() => {
  return [...messages].sort((a, b) => {
    // Pinned messages first
    const aPinned = localState.getState(a.id).isPinned ? 1 : 0;
    const bPinned = localState.getState(b.id).isPinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;

    // Then normal sort
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    if (typeof av === "number" && typeof bv === "number") {
      return sortDir === "asc" ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv), "ko");
    return sortDir === "asc" ? cmp : -cmp;
  });
}, [messages, sortKey, sortDir, localState]);
```

**Step 4: Commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "feat(web): add status management and pin indicators to inbox accordion"
```

---

### Task 5: Add disabled AI parsing UI to accordion

**Files:**
- Modify: `apps/web/src/components/message-list.tsx`

**Step 1: Replace active AI parse buttons with disabled UI**

In the expanded accordion area, after the status section, keep the existing `ParseStepper` and `ParseResultTable` but make them read-only with a disabled overlay:

```tsx
{/* AI Parsing — Disabled */}
<Separator />
<div className="space-y-2 opacity-60">
  <div className="flex items-center gap-2">
    <Bot className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm font-medium text-muted-foreground">AI 파싱</span>
    <Badge variant="outline" className="text-xs">추후 지원 예정</Badge>
  </div>
  <ParseStepper msg={msg} />
  {msg.parse_result && <ParseResultTable msg={msg} />}
  <div className="flex gap-2">
    <Button size="sm" variant="outline" disabled>
      <Bot className="h-3.5 w-3.5 mr-1" />AI 테스트
    </Button>
    <Button size="sm" disabled>
      <Bot className="h-3.5 w-3.5 mr-1" />파싱 실행
    </Button>
  </div>
</div>
```

**Step 2: Disable bulk parse button in bottom action bar**

Change the bulk parse button to disabled:

```tsx
<Button size="sm" disabled title="AI 파싱은 추후 지원 예정입니다">
  <Bot className="h-4 w-4 mr-1" />
  일괄 파싱
</Button>
```

**Step 3: Commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "feat(web): show disabled AI parsing UI in inbox accordion"
```

---

### Task 6: Add pin/snooze, edit, copy, delete actions to accordion

**Files:**
- Modify: `apps/web/src/components/message-list.tsx`

**Step 1: Add action buttons row to accordion**

At the bottom of the expanded accordion area, add the action buttons:

```tsx
{/* Action Buttons */}
<Separator />
<div className="flex items-center gap-2 flex-wrap">
  {/* Pin */}
  <Button
    size="sm"
    variant={localState.getState(msg.id).isPinned ? "default" : "outline"}
    onClick={(e) => { e.stopPropagation(); localState.togglePin(msg.id); }}
  >
    {localState.getState(msg.id).isPinned ? <PinOff className="h-3.5 w-3.5 mr-1" /> : <Pin className="h-3.5 w-3.5 mr-1" />}
    {localState.getState(msg.id).isPinned ? "핀 해제" : "핀 고정"}
  </Button>

  {/* Snooze */}
  <Select
    value=""
    onValueChange={(val) => {
      const now = new Date();
      let target: Date | null = null;
      if (val === "1h") target = new Date(now.getTime() + 60 * 60 * 1000);
      else if (val === "3h") target = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      else if (val === "tomorrow") {
        target = new Date(now);
        target.setDate(target.getDate() + 1);
        target.setHours(9, 0, 0, 0);
      } else if (val === "clear") {
        localState.setSnooze(msg.id, null);
        toast.success("스누즈가 해제되었습니다.");
        return;
      }
      if (target) {
        localState.setSnooze(msg.id, target.toISOString());
        toast.success(`${val === "1h" ? "1시간" : val === "3h" ? "3시간" : "내일 오전 9시"} 후로 스누즈 설정됨`);
      }
    }}
  >
    <SelectTrigger className="w-32 h-8">
      <SelectValue placeholder={localState.getState(msg.id).snoozeAt ? "⏰ 스누즈됨" : "⏰ 스누즈"} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="1h">1시간 후</SelectItem>
      <SelectItem value="3h">3시간 후</SelectItem>
      <SelectItem value="tomorrow">내일 오전 9시</SelectItem>
      {localState.getState(msg.id).snoozeAt && <SelectItem value="clear">스누즈 해제</SelectItem>}
    </SelectContent>
  </Select>

  {/* Copy */}
  <Button
    size="sm"
    variant="outline"
    onClick={(e) => {
      e.stopPropagation();
      const content = localState.getState(msg.id).editedContent ?? msg.content;
      navigator.clipboard.writeText(content);
      toast.success("복사됨");
    }}
  >
    <Copy className="h-3.5 w-3.5 mr-1" />복사
  </Button>

  {/* Delete */}
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button size="sm" variant="destructive" disabled={isPending}>
        <Trash2 className="h-3.5 w-3.5 mr-1" />삭제
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>메시지를 삭제하시겠습니까?</AlertDialogTitle>
        <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>취소</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => handleDelete(msg.id)}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          삭제
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</div>
```

**Step 2: Commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "feat(web): add pin, snooze, copy, delete actions to inbox accordion"
```

---

### Task 7: Add message content edit to accordion

**Files:**
- Modify: `apps/web/src/components/message-list.tsx`

**Step 1: Add inline content editing**

Add state for tracking which message is being edited inline:

```typescript
const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
const [editDraft, setEditDraft] = useState("");
```

In the accordion expanded area, replace the static content display with an editable version:

```tsx
{/* Message Content */}
<div>
  <div className="flex items-center justify-between mb-1">
    <span className="text-sm font-medium text-muted-foreground">메시지 내용</span>
    {editingMsgId !== msg.id && (
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2"
        onClick={(e) => {
          e.stopPropagation();
          setEditingMsgId(msg.id);
          setEditDraft(localState.getState(msg.id).editedContent ?? msg.content);
        }}
      >
        <Pencil className="h-3 w-3 mr-1" />편집
      </Button>
    )}
  </div>
  {editingMsgId === msg.id ? (
    <div className="space-y-2">
      <Textarea
        value={editDraft}
        onChange={(e) => setEditDraft(e.target.value)}
        rows={5}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => { e.stopPropagation(); setEditingMsgId(null); }}
        >
          취소
        </Button>
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            const newContent = editDraft.trim();
            localState.setEditedContent(msg.id, newContent === msg.content ? null : newContent);
            setEditingMsgId(null);
            toast.success("메시지 내용이 저장되었습니다.");
          }}
        >
          저장
        </Button>
      </div>
    </div>
  ) : (
    <div className="rounded-md border bg-muted/30 p-3">
      <pre className="text-sm whitespace-pre-wrap font-sans">
        {localState.getState(msg.id).editedContent ?? msg.content}
      </pre>
      {localState.getState(msg.id).editedContent && (
        <p className="text-xs text-muted-foreground mt-1 italic">편집됨 (원본과 다름)</p>
      )}
    </div>
  )}
</div>
```

**Step 2: Update the table content column to show edited indicator**

In the table row's content column, show a visual indicator when content is edited:

```tsx
<TableCell className="max-w-[250px] truncate text-sm text-muted-foreground">
  {truncate(localState.getState(msg.id).editedContent ?? msg.content)}
  {localState.getState(msg.id).editedContent && (
    <Pencil className="inline h-3 w-3 ml-1 text-amber-500" />
  )}
</TableCell>
```

**Step 3: Commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "feat(web): add inline message content editing to inbox accordion"
```

---

### Task 8: Add comments to accordion

**Files:**
- Modify: `apps/web/src/components/message-list.tsx`

**Step 1: Add comment section to accordion**

Add state for comment input:

```typescript
const [commentDraft, setCommentDraft] = useState("");
```

In the accordion expanded area, add the comments section:

```tsx
{/* Comments */}
<Separator />
<div className="space-y-2">
  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
    <MessageSquare className="h-3.5 w-3.5" />
    댓글 ({localState.getState(msg.id).comments.length})
  </span>
  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
    <Input
      placeholder="댓글을 입력하세요..."
      value={expandedId === msg.id ? commentDraft : ""}
      onChange={(e) => setCommentDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && commentDraft.trim()) {
          localState.addComment(msg.id, commentDraft.trim());
          setCommentDraft("");
          toast.success("댓글이 추가되었습니다.");
        }
      }}
      className="h-8"
    />
    <Button
      size="sm"
      disabled={!commentDraft.trim()}
      onClick={() => {
        localState.addComment(msg.id, commentDraft.trim());
        setCommentDraft("");
        toast.success("댓글이 추가되었습니다.");
      }}
    >
      추가
    </Button>
  </div>
  {localState.getState(msg.id).comments.length > 0 && (
    <div className="space-y-1.5 max-h-40 overflow-y-auto">
      {localState.getState(msg.id).comments.map((c) => (
        <div key={c.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5">
          <div>
            <p className="text-sm">{c.text}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(c.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              localState.deleteComment(msg.id, c.id);
              toast.success("댓글이 삭제되었습니다.");
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  )}
</div>
```

**Step 2: Commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "feat(web): add comments section to inbox accordion"
```

---

### Task 9: Update messages page and clean up unused imports

**Files:**
- Modify: `apps/web/src/app/(dashboard)/messages/page.tsx`
- Modify: `apps/web/src/components/message-list.tsx`

**Step 1: Clean up page.tsx**

Since `hospitals` and `products` are no longer passed to `MessageTable`, check if they're still needed anywhere in the page. They're used by the `createMessage` server action (which doesn't need them client-side) so remove the fetch calls:

```tsx
const [result] = await Promise.all([
  getMessages({
    from: params.from,
    to: params.to,
    parse_status: params.parse_status,
    source_app: params.source_app,
    limit,
    offset,
  }).catch(() => ({ messages: [], total: 0 })),
]);
```

Remove `getHospitals` and `getProducts` imports if no longer used.

**Step 2: Clean up message-list.tsx imports**

Remove all unused imports:
- `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`
- `LayoutList`, `LayoutGrid`
- `ManualParseForm`
- Any `Command`, `Popover` imports if no longer used
- Any Lucide icons no longer referenced

**Step 3: Verify build**

```bash
cd apps/web && npx next build --no-lint 2>&1 | tail -20
```

Expected: Build succeeds without errors.

**Step 4: Commit**

```bash
git add apps/web/src/components/message-list.tsx apps/web/src/app/\(dashboard\)/messages/page.tsx
git commit -m "chore(web): clean up unused imports and data fetches in inbox"
```

---

### Task 10: Visual verification and polish

**Files:**
- Modify: `apps/web/src/components/message-list.tsx` (if needed)

**Step 1: Start dev server and verify**

```bash
cd apps/web && npm run dev
```

Open `http://localhost:3000/messages` and verify:

1. Table displays with columns: ID, Sender, Content, Source, Device, Status, Received
2. Click a row → accordion expands below with:
   - Full message content (with edit button)
   - Status dropdown + change history
   - Comments section (add/delete)
   - AI parsing section (disabled, greyed out)
   - Action buttons: Pin, Snooze, Copy, Delete
3. Pin a message → it moves to top with pin icon
4. Change status → badge updates in table + history recorded
5. Add/delete comments
6. Copy button → clipboard + toast
7. Bulk selection → bottom bar with disabled parse + working delete
8. No grid view toggle visible
9. No side sheet opens

**Step 2: Fix any visual issues**

Apply fixes as needed. Common things to check:
- Accordion expansion/collapse animation
- Stop propagation on interactive elements inside accordion
- Dark mode compatibility (if supported)
- Responsive layout on smaller screens

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(web): complete inbox timeline redesign with accordion, status, comments, pin/snooze"
```

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/lib/types.ts` | Modify | Add 6 new interfaces for local state |
| `apps/web/src/hooks/use-message-local-state.ts` | Create | localStorage hook for status/pin/snooze/comments/edit |
| `apps/web/src/components/message-list.tsx` | Major refactor | Remove grid/sheet, add accordion features |
| `apps/web/src/app/(dashboard)/messages/page.tsx` | Minor modify | Remove unused data fetches and props |

## Task Dependencies

```
Task 1 (types) ──→ Task 2 (hook) ──→ Task 3 (strip grid/sheet)
                                          │
                                          ├──→ Task 4 (status in accordion)
                                          ├──→ Task 5 (disabled AI parsing)
                                          ├──→ Task 6 (pin/snooze/copy/delete)
                                          ├──→ Task 7 (edit content)
                                          └──→ Task 8 (comments)
                                                   │
                                               Task 9 (cleanup)
                                                   │
                                               Task 10 (verify & polish)
```

Tasks 4-8 can be done in any order after Task 3. Task 9 depends on all of 4-8 being done.

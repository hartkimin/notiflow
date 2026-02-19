# Parse Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add inline expandable rows to the message list showing the full AI parsing pipeline (stepper + items table + reparse button).

**Architecture:** Add 3 new components inside `message-list.tsx`: `ParseStepper` (4-step horizontal flow), `ParseResultTable` (items with confidence badges), and expand/collapse logic using state. Row click toggles expand instead of opening the Sheet; Sheet opens via a dedicated button.

**Tech Stack:** React, shadcn/ui (Badge, Table, Button), Lucide icons, existing Supabase client + test-parse Edge Function.

---

### Task 1: Add expand state and toggle logic

**Files:**
- Modify: `apps/web/src/components/message-list.tsx:252-260` (state declarations)
- Modify: `apps/web/src/components/message-list.tsx:400-437` (table row click handler)

**Step 1: Add expandedId state**

In the `MessageTable` component, after line 259 (`const [isPending, startTransition] = useTransition();`), add:

```tsx
// Expanded row for parse visibility
const [expandedId, setExpandedId] = useState<number | null>(null);
```

**Step 2: Change table row click to toggle expand**

Replace the `onClick` handler on `<TableRow>` (line 404):

From:
```tsx
onClick={() => { setSelected(msg); setIsEditing(false); setShowManualParse(false); setAiResult(null); setAiError(null); }}
```

To:
```tsx
onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
```

**Step 3: Do the same for grid view**

Replace the grid `Card` onClick (line 447):

From:
```tsx
onClick={() => { setSelected(msg); setIsEditing(false); setShowManualParse(false); setAiResult(null); setAiError(null); }}
```

To:
```tsx
onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
```

**Step 4: Verify the page still renders**

Run: `cd apps/web && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds (expanding rows won't show content yet, but no errors).

**Step 5: Commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "feat(web): add expand state for message parse visibility"
```

---

### Task 2: Build ParseStepper component

**Files:**
- Modify: `apps/web/src/components/message-list.tsx` (add component before `MessageTable`)

**Step 1: Add imports**

At line 33, add to the lucide-react import:

```tsx
import {
  LayoutList, LayoutGrid, ArrowUp, ArrowDown, ArrowUpDown,
  Trash2, Plus, Pencil, Smartphone, Bot, Loader2, CheckCircle, AlertTriangle,
  Inbox, Cpu, PackageSearch, ClipboardList, ChevronRight, XCircle, Circle,
} from "lucide-react";
```

**Step 2: Add ParseStepper component**

Insert before the `MessageTable` component (before line 243):

```tsx
// --- Parse Stepper ---

interface StepInfo {
  label: string;
  icon: React.ReactNode;
  status: "done" | "fail" | "pending" | "na";
  detail: string;
  sub: string;
}

function ParseStepper({ msg }: { msg: RawMessage }) {
  const parseResult = msg.parse_result as Record<string, unknown> | null;
  const items = Array.isArray(parseResult) ? parseResult : [];
  const hasParsed = msg.parse_status === "parsed";
  const hasFailed = msg.parse_status === "failed";

  // Count match statuses
  let matched = 0, review = 0, unmatched = 0;
  for (const it of items) {
    const r = it as Record<string, unknown>;
    if (r.match_status === "matched") matched++;
    else if (r.match_status === "review") review++;
    else unmatched++;
  }

  const steps: StepInfo[] = [
    {
      label: "메시지 수신",
      icon: <Inbox className="h-4 w-4" />,
      status: "done",
      detail: formatDate(msg.received_at),
      sub: SOURCE_LABEL[msg.source_app] || msg.source_app,
    },
    {
      label: "AI 파싱",
      icon: <Cpu className="h-4 w-4" />,
      status: hasFailed ? "fail" : hasParsed ? "done" : "pending",
      detail: hasParsed
        ? msg.parse_method === "llm" ? "AI" : msg.parse_method === "regex" ? "정규식" : (msg.parse_method || "-")
        : hasFailed ? "실패" : "대기중",
      sub: hasParsed && items.length > 0 ? `${items.length}개 항목` : "",
    },
    {
      label: "제품 매칭",
      icon: <PackageSearch className="h-4 w-4" />,
      status: !hasParsed ? (hasFailed ? "fail" : "na") : items.length > 0 ? "done" : "na",
      detail: hasParsed && items.length > 0
        ? `매칭 ${matched}`
        : "-",
      sub: hasParsed && (review > 0 || unmatched > 0)
        ? `검토 ${review} / 미매칭 ${unmatched}`
        : "",
    },
    {
      label: "주문 생성",
      icon: <ClipboardList className="h-4 w-4" />,
      status: msg.order_id ? "done" : "na",
      detail: msg.order_id ? `#${msg.order_id}` : "-",
      sub: "",
    },
  ];

  const statusColor: Record<string, string> = {
    done: "text-green-600 bg-green-50 border-green-200",
    fail: "text-red-600 bg-red-50 border-red-200",
    pending: "text-yellow-600 bg-yellow-50 border-yellow-200",
    na: "text-muted-foreground bg-muted/30 border-muted",
  };

  const statusIcon: Record<string, React.ReactNode> = {
    done: <CheckCircle className="h-3.5 w-3.5 text-green-600" />,
    fail: <XCircle className="h-3.5 w-3.5 text-red-600" />,
    pending: <Circle className="h-3.5 w-3.5 text-yellow-500" />,
    na: <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />,
  };

  return (
    <div className="flex items-start gap-1 overflow-x-auto py-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-start">
          <div className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 min-w-[120px] ${statusColor[step.status]}`}>
            <div className="flex items-center gap-1.5">
              {statusIcon[step.status]}
              <span className="text-xs font-medium">{step.label}</span>
            </div>
            <div className="flex items-center gap-1">
              {step.icon}
              <span className="text-xs">{step.detail}</span>
            </div>
            {step.sub && <span className="text-[10px] opacity-70">{step.sub}</span>}
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground mt-4 mx-0.5 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Verify build**

Run: `cd apps/web && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "feat(web): add ParseStepper component for parse flow visualization"
```

---

### Task 3: Build ParseResultTable component

**Files:**
- Modify: `apps/web/src/components/message-list.tsx` (add component after ParseStepper)

**Step 1: Add ParseResultTable component**

Insert after `ParseStepper`, before `MessageTable`:

```tsx
// --- Parse Result Table ---

function ParseResultTable({ msg }: { msg: RawMessage }) {
  const parseResult = msg.parse_result;
  const items = Array.isArray(parseResult) ? parseResult : [];

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        {msg.parse_status === "parsed" ? "파싱 결과가 없습니다." : "아직 파싱되지 않았습니다."}
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-2 font-medium">원문</th>
            <th className="text-left p-2 font-medium">매칭 제품</th>
            <th className="text-center p-2 font-medium">수량</th>
            <th className="text-center p-2 font-medium">단위</th>
            <th className="text-center p-2 font-medium">신뢰도</th>
          </tr>
        </thead>
        <tbody>
          {items.map((raw, i) => {
            const it = raw as Record<string, unknown>;
            const conf = Number(it.confidence ?? 0);
            const status = String(it.match_status ?? "unmatched");
            return (
              <tr key={i} className="border-b last:border-0">
                <td className="p-2 text-xs font-mono">{String(it.item ?? "")}</td>
                <td className="p-2 text-sm">
                  {it.product_name ? String(it.product_name) : (
                    <span className="text-muted-foreground italic">미매칭</span>
                  )}
                </td>
                <td className="p-2 text-center font-mono">{String(it.qty ?? "")}</td>
                <td className="p-2 text-center text-xs">{String(it.unit ?? "")}</td>
                <td className="p-2 text-center">
                  <Badge
                    variant={status === "matched" ? "default" : status === "review" ? "secondary" : "outline"}
                    className={
                      status === "matched" ? "bg-green-100 text-green-800 hover:bg-green-100" :
                      status === "review" ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" :
                      "bg-red-50 text-red-700"
                    }
                  >
                    {status === "matched" ? "매칭" : status === "review" ? "검토" : "미매칭"}
                    {conf > 0 && ` ${Math.round(conf * 100)}%`}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "feat(web): add ParseResultTable component with confidence badges"
```

---

### Task 4: Wire up expanded row in table view

**Files:**
- Modify: `apps/web/src/components/message-list.tsx:400-437` (table body rendering)

**Step 1: Add expanded row after each TableRow**

Replace the `{sorted.map((msg) => (` block inside `<TableBody>` (the single `<TableRow>` per message). After the closing `</TableRow>`, add the expansion row:

```tsx
{sorted.map((msg) => (
  <React.Fragment key={msg.id}>
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
    >
      {/* ... existing cells stay exactly the same ... */}
    </TableRow>
    {expandedId === msg.id && (
      <TableRow className="bg-muted/20 hover:bg-muted/20">
        <TableCell colSpan={9} className="p-4">
          <div className="space-y-3">
            <ParseStepper msg={msg} />
            <ParseResultTable msg={msg} />
            <div className="flex items-center gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(msg);
                  setIsEditing(false);
                  setShowManualParse(false);
                  setAiResult(null);
                  setAiError(null);
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                상세
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isAiParsing}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAiParse(msg.content, msg.hospital_id);
                }}
              >
                {isAiParsing ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />파싱중</>
                ) : (
                  <><Bot className="h-3.5 w-3.5 mr-1" />AI 재파싱</>
                )}
              </Button>
            </div>
          </div>
        </TableCell>
      </TableRow>
    )}
  </React.Fragment>
))}
```

**Step 2: Add React import**

At the top of the file, change:
```tsx
import { useState, useMemo, useTransition } from "react";
```
To:
```tsx
import React, { useState, useMemo, useTransition } from "react";
```

**Step 3: Verify build**

Run: `cd apps/web && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "feat(web): wire up expandable parse rows in table view"
```

---

### Task 5: Wire up expanded row in grid view

**Files:**
- Modify: `apps/web/src/components/message-list.tsx:442-481` (grid view rendering)

**Step 1: Add expansion below each grid Card**

Wrap each grid card in a div and add the expansion below:

```tsx
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {sorted.map((msg) => (
    <div key={msg.id} className={expandedId === msg.id ? "sm:col-span-2 lg:col-span-3" : ""}>
      <Card
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
      >
        {/* ... existing CardContent stays exactly the same ... */}
      </Card>
      {expandedId === msg.id && (
        <div className="mt-2 rounded-lg border bg-muted/20 p-4 space-y-3">
          <ParseStepper msg={msg} />
          <ParseResultTable msg={msg} />
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setSelected(msg);
                setIsEditing(false);
                setShowManualParse(false);
                setAiResult(null);
                setAiError(null);
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              상세
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isAiParsing}
              onClick={(e) => {
                e.stopPropagation();
                handleAiParse(msg.content, msg.hospital_id);
              }}
            >
              {isAiParsing ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />파싱중</>
              ) : (
                <><Bot className="h-3.5 w-3.5 mr-1" />AI 재파싱</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  ))}
</div>
```

**Step 2: Verify build**

Run: `cd apps/web && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "feat(web): wire up expandable parse rows in grid view"
```

---

### Task 6: Show inline AI reparse result

**Files:**
- Modify: `apps/web/src/components/message-list.tsx` (expand area)

**Step 1: Add per-row AI result state**

After the `expandedId` state declaration, add:

```tsx
const [inlineAiResult, setInlineAiResult] = useState<Record<string, unknown> | null>(null);
const [inlineAiError, setInlineAiError] = useState<string | null>(null);
const [inlineAiParsing, setInlineAiParsing] = useState(false);
```

**Step 2: Add inline reparse handler**

Add after `handleAiParse`:

```tsx
async function handleInlineReparse(content: string, hospitalId?: number | null) {
  setInlineAiParsing(true);
  setInlineAiResult(null);
  setInlineAiError(null);
  try {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("test-parse", {
      body: { message: content, hospital_id: hospitalId ?? undefined },
    });
    if (error) throw error;
    setInlineAiResult(data);
  } catch (err) {
    setInlineAiError(err instanceof Error ? err.message : "AI 파싱 실패");
  } finally {
    setInlineAiParsing(false);
  }
}
```

**Step 3: Update the reparse button in both table and grid expand areas**

Change the reparse Button `onClick` to use `handleInlineReparse`:

```tsx
onClick={(e) => {
  e.stopPropagation();
  handleInlineReparse(msg.content, msg.hospital_id);
}}
```

And change `disabled={isAiParsing}` to `disabled={inlineAiParsing}` and spinner condition accordingly.

**Step 4: Show inline result below the reparse button**

After the button row in the expand area, add:

```tsx
{inlineAiError && expandedId === msg.id && (
  <div className="rounded-md bg-destructive/10 p-3 flex items-start gap-2">
    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
    <p className="text-sm text-destructive">{inlineAiError}</p>
  </div>
)}
{inlineAiResult && expandedId === msg.id && (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <span className="text-sm font-medium">재파싱 결과</span>
      {inlineAiResult.ai_provider != null && (
        <Badge variant="secondary" className="text-xs">
          {String(inlineAiResult.ai_provider)}/{String(inlineAiResult.ai_model)}
        </Badge>
      )}
      {inlineAiResult.latency_ms != null && (
        <span className="text-xs text-muted-foreground">{String(inlineAiResult.latency_ms)}ms</span>
      )}
    </div>
    {Array.isArray(inlineAiResult.items) && inlineAiResult.items.length > 0 && (
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2 font-medium">원문</th>
              <th className="text-left p-2 font-medium">매칭 제품</th>
              <th className="text-center p-2 font-medium">수량</th>
              <th className="text-center p-2 font-medium">신뢰도</th>
            </tr>
          </thead>
          <tbody>
            {(inlineAiResult.items as Array<Record<string, unknown>>).map((item, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-2 text-xs font-mono">{String(item.original_text ?? item.product_name ?? "")}</td>
                <td className="p-2">{item.product_official_name ? String(item.product_official_name) : <span className="text-muted-foreground italic">미매칭</span>}</td>
                <td className="p-2 text-center font-mono">{String(item.quantity ?? "")}{item.unit ? ` ${item.unit}` : ""}</td>
                <td className="p-2 text-center">
                  <Badge variant={item.match_status === "matched" ? "default" : item.match_status === "review" ? "secondary" : "outline"}>
                    {item.match_status === "matched" ? "매칭" : item.match_status === "review" ? "검토" : "미매칭"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}
```

**Step 5: Clear inline state when expanding a different row**

Update `setExpandedId` calls to also clear inline state:

```tsx
onClick={() => {
  const newId = expandedId === msg.id ? null : msg.id;
  setExpandedId(newId);
  if (newId !== expandedId) {
    setInlineAiResult(null);
    setInlineAiError(null);
  }
}}
```

**Step 6: Verify build**

Run: `cd apps/web && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

**Step 7: Commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "feat(web): inline AI reparse result display in expanded rows"
```

---

### Task 7: Visual polish and final verification

**Files:**
- Modify: `apps/web/src/components/message-list.tsx`

**Step 1: Add visual expand indicator to table rows**

Add a small chevron icon in the ID cell that rotates when expanded:

In the ID `<TableCell>`, change:
```tsx
<TableCell className="font-mono text-xs">{msg.id}</TableCell>
```
To:
```tsx
<TableCell className="font-mono text-xs">
  <span className="inline-flex items-center gap-1">
    <ChevronRight className={`h-3 w-3 transition-transform ${expandedId === msg.id ? "rotate-90" : ""}`} />
    {msg.id}
  </span>
</TableCell>
```

**Step 2: Remove the raw JSON dump from the Sheet detail panel**

In the Sheet detail view (around line 671-680), remove or replace the raw JSON display:

From:
```tsx
{selected.parse_result && Object.keys(selected.parse_result).length > 0 && (
  <div>
    <span className="text-sm text-muted-foreground">파싱 결과</span>
    <div className="mt-1 rounded-md border bg-muted/30 p-3">
      <pre className="text-xs whitespace-pre-wrap font-mono">
        {JSON.stringify(selected.parse_result, null, 2)}
      </pre>
    </div>
  </div>
)}
```

To:
```tsx
{selected.parse_result && (
  <div>
    <span className="text-sm text-muted-foreground">파싱 결과</span>
    <div className="mt-2">
      <ParseResultTable msg={selected} />
    </div>
  </div>
)}
```

**Step 3: Full build verification**

Run: `cd apps/web && npx next build --no-lint 2>&1 | tail -10`
Expected: Build succeeds with no errors.

**Step 4: Final commit**

```bash
git add apps/web/src/components/message-list.tsx
git commit -m "feat(web): polish expand indicator and use ParseResultTable in sheet"
```

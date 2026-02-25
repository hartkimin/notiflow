# Messages 3-Panel Inbox Design — 2026-02-25

## Goal

Replace the single-column expandable-table messages page with a 3-panel horizontal layout (list / detail / order) that enables a complete workflow without scrolling: select message → review content → create order.

## Current State

- 814-line `message-list.tsx` with 7-column resizable table, inline row expansion
- Filters take ~2 rows
- Order creation form buried inside expanded row
- Actions at bottom of expanded row
- ~2,700 lines total across all message-related files

## Architecture

3 fixed panels in a `flex` row, wrapped by `MessageInbox` client component. Calendar tab preserved separately. Server data fetching unchanged — only client-side rendering restructured.

```
MessagesPage (Server)
├── ClientTabs
│   ├── tab="list" → MessageInbox (NEW)
│   │   ├── InboxFilterBar
│   │   ├── flex container (h-[calc(100vh-12rem)])
│   │   │   ├── MessageListPanel (w-[300px])
│   │   │   ├── MessageDetailPanel (flex-1)
│   │   │   └── OrderPanel (w-[280px])
│   │   └── BulkActionBar
│   └── tab="calendar" → MessageCalendar (existing)
```

## Panel Specifications

### Left Panel — Message List (w-[300px], border-r)

**Card layout per message:**
```
┌────────────────────────────┐
│ [✓] 홍길동          10:30  │
│     수량 확인 부탁...       │
│     🟡 대기  📌  카카오톡   │
└────────────────────────────┘
```

- Sender name (bold) + received time (right-aligned, muted)
- Content preview (1 line, truncated)
- Row 3: status badge (colored dot + label), pin icon (if pinned), source badge
- Selected card: `ring-2 ring-primary bg-primary/5`
- Checkbox on left for multi-select
- Pinned messages sort to top
- Sort dropdown at top: 수신시간↓, 발신자, 상태
- Footer: `Pagination` component
- Scrollable: `overflow-y-auto`

### Center Panel — Message Detail (flex-1, border-r)

**Sections (top to bottom):**

1. **Meta bar** — sender, time, source badge, device, status dropdown (existing StatusStep)
2. **Message content** — chat bubble style (`rounded-xl bg-muted p-4`), editable (pencil icon)
3. **Parse result** — `ParseResultTable` (reused), shows matched items
4. **AI test result** — method, latency, match summary (shown after AI button click)
5. **Comments** — local comments list + input field

**Sticky bottom action bar:**
```
[AI 파싱] [파싱 실행] [핀] [복사] [삭제]
```

**Empty state:** When no message selected → centered "메시지를 선택하세요" with MessageSquare icon

### Right Panel — Order Creation (w-[280px])

**Always visible, content depends on selected message state:**

**Case 1: No message selected** → disabled/greyed out

**Case 2: Message has no order (`!order_id`):**
- Hospital combobox with search
- Order items table (product combobox + quantity + unit price per row)
- Add row button
- Sticky bottom: `[주문 생성]` button

**Case 3: Message has order (`order_id`):**
- Order info display: order number, hospital, item count, status
- Link button → `/orders/{order_id}`

### Filter Bar (1 row, compressed)

```
[시작일] [종료일] [상태▾] [출처▾] [🔍]    전체 128건 · 미처리 5건
```

- All inputs: `h-8` compact size
- Date inputs: `w-[120px]`
- Select dropdowns: `w-[100px]`
- Right side: count badges (`text-sm text-muted-foreground`)
- Total height: single row (~40px)

## State Management

### MessageInbox State
```typescript
const [selectedId, setSelectedId] = useState<number | null>(null);
const selectedMsg = messages.find(m => m.id === selectedId);
```

### Preserved Patterns
- `useMessageLocalState()` — status, pin, comments (localStorage)
- `useRowSelection()` — multi-select for bulk actions
- `BulkActionBar` — appears when selection count > 0

### Removed Patterns
- `useResizableColumns` — not needed for card layout
- `expandedId` state — replaced by `selectedId` (panel selection, not row expansion)
- Inline editing textarea in table — moved to detail panel

## Props Flow

```
page.tsx passes:
  messages, hospitals, products
    ↓
MessageInbox receives all three
    ↓
├── MessageListPanel: messages, selectedId, onSelect, localState
├── MessageDetailPanel: selectedMsg, localState, onAction
└── OrderPanel: selectedMsg, hospitals, products
```

## Files Plan

| Action | File | Description |
|--------|------|-------------|
| CREATE | `components/message-inbox.tsx` | Main 3-panel container + state |
| CREATE | `components/message-inbox/list-panel.tsx` | Card list with sort/filter |
| CREATE | `components/message-inbox/detail-panel.tsx` | Message detail + actions |
| CREATE | `components/message-inbox/order-panel.tsx` | Order creation / info |
| CREATE | `components/message-inbox/filter-bar.tsx` | Compressed 1-row filters |
| MODIFY | `app/(dashboard)/messages/page.tsx` | Swap MessageTable → MessageInbox |
| KEEP | `message-list.tsx` | Keep CreateMessageDialog export; remove rest after migration |
| KEEP | `manual-parse-form.tsx` | Reuse in OrderPanel |
| KEEP | `message-calendar.tsx` | Unchanged |

## Mobile Behavior

On screens < md (768px):
- Show only list panel (full width)
- Clicking a card navigates to detail view (back button to return)
- Order panel accessible via bottom sheet or separate tab
- Filter bar wraps to 2 lines if needed

## Bulk Actions

When multi-select is active:
- Selection count + action buttons overlay bottom of list panel
- Detail panel shows "N개 메시지 선택됨" summary instead of single message
- Order panel disabled during multi-select

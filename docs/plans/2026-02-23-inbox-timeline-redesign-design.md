# Inbox Timeline Redesign Design

## Date: 2026-02-23

## Overview

웹 대시보드의 수신메시지(Inbox) 탭을 모바일 앱의 타임라인 탭과 동일한 기능을 제공하도록 개선한다. 핵심 변경: 아코디언 상세보기, 사용자 정의 상태 시스템, AI 파싱 비활성화.

## Goals

1. 수신 메시지 클릭 시 아코디언 형태로 상세 정보 표시 (사이드 시트/그리드 뷰 제거)
2. 모바일 앱과 동일한 사용자 정의 상태(StatusStep) 시스템 도입 (프론트엔드 전용)
3. AI 파싱 기능을 비활성화 UI로 전환 (추후 적용 대비)
4. 핀/스누즈, 메시지 편집, 댓글, 클립보드 복사 기능 추가

## Approach

**방식 A: 기존 컴포넌트 리팩토링** — `message-list.tsx`를 직접 수정하여 그리드 뷰/사이드 시트를 제거하고, 아코디언 상세 영역을 새 기능으로 교체.

## Architecture

### 1. Layout: Table + Accordion

```
┌─────────────────────────────────────────────────────────────────┐
│ ☐ │ Sender │ Content (truncated) │ Source │ Status │ Received  │
├─────────────────────────────────────────────────────────────────┤
│  ▼ 아코디언 확장 영역                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [전체 메시지 내용]                                           ││
│  │ ─────────────────────────────────────────────────           ││
│  │ 상태 변경: [접수 ▼]  상태 이력: 접수 → 확인중 → ...           ││
│  │ ─────────────────────────────────────────────────           ││
│  │ 댓글: [입력...] [추가]                                       ││
│  │ ─────────────────────────────────────────────────           ││
│  │ AI 파싱: [비활성화됨 - 추후 지원 예정]                         ││
│  │ ─────────────────────────────────────────────────           ││
│  │ [핀] [스누즈] [편집] [복사] [삭제]                             ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│ ☐ │ Sender │ Content (truncated) │ Source │ Status │ Received  │
└─────────────────────────────────────────────────────────────────┘
```

**Removed:**
- Grid view (card layout)
- Side sheet (Sheet component)
- View mode toggle (list/grid button)

**Retained:**
- Sortable table headers
- Filter bar (date, status, source app)
- Checkbox selection + bulk action bar
- Pagination
- Real-time subscriptions

**Table Column Changes:**
- Remove: Order column, Synced column
- Change: Status column → user-defined status display
- Add: Pin icon, Snooze icon indicators

### 2. Frontend State Management (localStorage)

No database changes. All new state is managed client-side.

```typescript
// localStorage key: "notiflow-status-steps"
interface StatusStep {
  id: string;          // UUID
  name: string;        // "접수", "확인중", "처리완료"
  color: string;       // "#3B82F6" (hex)
  orderIndex: number;  // sort order
}

// localStorage key: "notiflow-message-states"
interface MessageLocalState {
  [messageId: number]: {
    statusId: string | null;
    statusHistory: StatusChangeItem[];
    isPinned: boolean;
    snoozeAt: string | null;     // ISO timestamp
    comments: Comment[];
    editedContent: string | null; // null = use original
  }
}

interface StatusChangeItem {
  id: string;
  fromStatusId: string | null;
  fromStatusName: string | null;
  toStatusId: string;
  toStatusName: string;
  changedAt: string;            // ISO timestamp
}

interface Comment {
  id: string;
  text: string;
  createdAt: string;            // ISO timestamp
}
```

**Default Status Steps (initial):**

| Order | Name | Color |
|-------|------|-------|
| 0 | 접수 | #3B82F6 (blue) |
| 1 | 확인중 | #F59E0B (yellow) |
| 2 | 처리중 | #8B5CF6 (purple) |
| 3 | 완료 | #10B981 (green) |

**Custom Hook:** `useMessageLocalState()` — reads/writes localStorage, syncs with React state, SSR-compatible (useEffect for localStorage access).

### 3. Feature Details

#### 3-1. Manual Status Change
- Status dropdown (Select component) in accordion
- Current status shown as colored badge
- On change: auto-record in statusHistory (from → to + timestamp)
- Real-time reflection in table row Status column

#### 3-2. Status Change History
- Timeline display inside accordion
- Each item: `[StatusName] - YYYY-MM-DD HH:mm`
- Arrow (→) visualizing change flow
- Latest change shown at top

#### 3-3. AI Parsing Disabled
- Existing ParseStepper and parse buttons shown as **disabled UI**
- "AI 파싱 (추후 지원 예정)" text + disabled button
- Existing parse results displayed read-only if available
- Bulk parse button also disabled

#### 3-4. Pin/Snooze
- **Pin:** Toggle button, pinned messages fixed at top of table + 📌 icon
- **Snooze:** Time picker dialog (1hr / 3hr / tomorrow / custom)
- Snoozed messages show ⏰ icon + remaining time

#### 3-5. Message Content Edit
- Edit button on message content area in accordion
- Click to switch to textarea
- Original content preserved; editedContent shown when not null
- Save/Cancel buttons

#### 3-6. Comments
- Input field + Add button
- Comment list (newest first, chronological)
- Delete button per comment

#### 3-7. Clipboard Copy
- Copy icon in action button area
- Click copies full message content to clipboard
- Sonner toast feedback "복사됨"

## Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/components/message-list.tsx` | Major refactor: remove grid/sheet, redesign accordion, add new features |
| `apps/web/src/hooks/use-message-local-state.ts` | NEW: Custom hook for localStorage state management |
| `apps/web/src/lib/types.ts` | Add StatusStep, MessageLocalState, Comment types |
| `apps/web/src/app/(dashboard)/messages/page.tsx` | Minor: adjust imports if needed |

## Out of Scope

- Database schema changes (Supabase)
- Mobile app sync
- AI parsing implementation
- Status step management UI in Settings page (can be added later)
- Category/archive features

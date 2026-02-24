# Data Calendar Redesign

## Goal

기존 캘린더(/calendar) 페이지를 제거하고, 수신메시지(/messages)와 주문관리(/orders) 각 페이지에 캘린더 탭을 추가한다. 일/주/월 뷰 전환이 가능하고, 아이템 클릭 시 우측 사이드 패널에 상세내역을 표시한다.

## Architecture

공유 제네릭 `DataCalendar<T>` 컴포넌트를 만들어 양쪽 페이지에서 재사용한다. 캘린더 레이아웃(그리드, 네비게이션, 뷰 전환)은 공통이고, 셀 렌더링과 상세 패널만 각 페이지에서 커스텀한다.

## Changes Overview

### 1. Remove Existing Calendar

**Delete completely:**
- `/calendar` route (`src/app/(dashboard)/calendar/`)
- ScheduleView (`src/components/schedule-view.tsx`)
- Calendar components (`src/components/calendar/`):
  - view-switcher.tsx, week-view.tsx, day-view.tsx, month-view.tsx
  - side-panel.tsx, category-manager.tsx, filter-rule-editor.tsx
- Schedule queries (`src/lib/queries/schedule.ts`)
- Schedule utils functions only used by old calendar
- Schedule actions in `src/lib/actions.ts` (plan CRUD, day-category CRUD, etc.)
- Sidebar nav item for Calendar

### 2. New Shared Components

```
src/components/data-calendar/
├── data-calendar.tsx        # Main generic component
├── calendar-header.tsx      # View switch (일/주/월) + date nav
├── month-grid.tsx           # 7×5~6 grid
├── week-grid.tsx            # 7-column layout
├── day-list.tsx             # Single-day time-ordered list
└── detail-panel.tsx         # Right slide-over (shadcn Sheet)
```

### 3. Page Integration

**Messages page (`/messages`):**
- Add `목록 | 캘린더` tab switcher
- `?tab=calendar&view=day|week|month&date=YYYY-MM-DD`
- Data: `raw_messages` by `received_at`
- Month cell: sender + content preview (all items, small text)
- Detail panel: sender, time, content, source, parse_status, parse_result table

**Orders page (`/orders`):**
- Add `캘린더` tab alongside existing status tabs
- `?tab=calendar&view=day|week|month&date=YYYY-MM-DD`
- Data: grouped orders by `order_date`
- Month cell: order_number + hospital + status badge (all items)
- Detail panel: order info, items table, status controls

## DataCalendar Component Design

```typescript
interface DataCalendarProps<T> {
  items: T[];
  dateAccessor: (item: T) => number;  // epoch ms
  idAccessor: (item: T) => string;
  renderMonthCell: (items: T[], date: Date) => ReactNode;
  renderWeekItem: (item: T) => ReactNode;
  renderDayItem: (item: T) => ReactNode;
  renderDetail: (item: T, onClose: () => void) => ReactNode;
  view: "day" | "week" | "month";
  referenceDate: Date;
  basePath: string;
  tabParam: string;  // "calendar"
}
```

## View Layouts

### Month View
- 7×5~6 grid (Mon–Sun)
- Each cell: date number + all items as small text list
- Click item → open detail panel
- Click date number → switch to day view

### Week View
- 7 columns (Mon–Sun)
- Each column: date header + chronological item cards
- Click item → open detail panel

### Day View
- Single date, full-width item cards
- Time-ordered list with more detail per card
- Click item → open detail panel

### Detail Panel (Right Sheet)
- shadcn/ui Sheet component, right side
- Content varies by page (message detail vs order detail)
- Close button + click-outside to dismiss

## URL Parameters

| Param | Values | Default |
|-------|--------|---------|
| tab | (none), calendar | (none) = list view |
| view | day, week, month | week |
| date | YYYY-MM-DD | today |
| month | YYYY-MM | current month |
| week | YYYY-MM-DD (Monday) | current week |

## Data Fetching

### Messages Calendar
```
getMessages({ from, to }) → RawMessage[]
- dateAccessor: new Date(m.received_at).getTime()
- Reuse existing getMessages query with date range
```

### Orders Calendar
```
getOrderItems({ from, to }) → OrderItemFlat[]
- Group by order_id, then dateAccessor from order_date
- Reuse existing getOrderItems query
```

## Deleted Code

### Actions to remove from actions.ts:
- createPlan, updatePlan, togglePlanCompletion, deletePlan
- linkPlanToMessage, updatePlanOrderNumber
- addCategoryToDay, removeCategoryFromDay
- addAllCategoriesToWeek, copyPreviousWeekPlans, copyCurrentWeekToNext
- createCategory, updateCategory, deleteCategory
- createFilterRule, updateFilterRule, deleteFilterRule

### Types to remove from types.ts:
- Plan, DayCategory, FilterRule (keep MobileCategory if used elsewhere)

### Queries to remove:
- getCategories, getAllCategories, getPlans, getDayCategories
- getFilterRules, schedule.ts getMessages (different from messages.ts)

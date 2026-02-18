# Calendar → Schedule View Redesign

## Context

Replace the existing web dashboard calendar (order-centric month/week/day views) with a weekly schedule view matching the mobile app's WeeklyPlanner. The web version shares the same Supabase data (categories, plans, day_categories, captured_messages) and adds desktop-optimized wide column layout.

## Decisions

- **Data**: Share mobile tables (categories, plans, day_categories, captured_messages), all user_id scoped
- **Layout**: Approach A — sidebar (mini calendar + category filter + actions) + 7-column weekly grid
- **Messages**: Use mobile `captured_messages` (not web `raw_messages`)
- **Existing calendar**: Fully replaced (not kept as tab)

## Data Layer

### Tables (existing, mobile-synced)

| Table | Key Fields | Notes |
|-------|-----------|-------|
| `categories` | id(text), user_id, name, color(bigint), order_index, is_active, is_deleted | ARGB int color |
| `plans` | id(text), user_id, category_id, date(bigint/epoch ms), title, is_completed, linked_message_id, order_number, order_index, is_deleted | Soft delete |
| `day_categories` | id(text), user_id, date(bigint/epoch ms), category_id | Unique(date, category_id) |
| `captured_messages` | id(text), user_id, app_name, sender, content, received_at(bigint/epoch ms), category_id | From mobile notifications |

### New Queries (`queries/schedule.ts`)

- `getCategories()` → active categories ordered by order_index
- `getWeekPlans(weekStartMs)` → plans where date in [weekStart, weekStart+7days), not deleted
- `getWeekDayCategories(weekStartMs)` → day_categories for the 7-day range
- `getWeekMessages(weekStartMs)` → captured_messages for the 7-day range

### New Server Actions

- `createPlan(data)`, `updatePlan(id, data)`, `deletePlan(id)` — plan CRUD
- `togglePlanCompletion(id, completed)` — checkbox toggle
- `addCategoryToDay(date, categoryId)`, `removeCategoryFromDay(dayCategoryId)` — day category mgmt
- `copyPreviousWeekPlans(targetWeekStart)` — copy plans + day_categories from prev week
- `copyCurrentWeekToNext(sourceWeekStart)` — copy to next week
- `addAllCategoriesToWeek(weekStart)` — add all active categories to all 7 days
- `linkPlanToMessage(planId, messageId)` — link plan ↔ message

### New Types (`types.ts`)

```typescript
interface Category { id: string; name: string; color: number; order_index: number; is_active: boolean; }
interface Plan { id: string; category_id: string | null; date: number; title: string; is_completed: boolean; linked_message_id: string | null; order_number: string | null; order_index: number; }
interface DayCategory { id: string; date: number; category_id: string; }
interface CapturedMessage { id: string; app_name: string; sender: string; content: string; received_at: number; category_id: string | null; }
```

## Component Architecture

```
calendar/page.tsx (Server Component)
└── ScheduleView (Client, main layout: flex)
    ├── Sidebar (w-64, shrink-0, border-r, flex-col, gap-4)
    │   ├── MiniCalendar (week selection)
    │   ├── CategoryList (color dots + filter checkboxes)
    │   └── WeekActions (copy prev, add all, copy next)
    └── Main (flex-1, overflow-auto)
        ├── WeekHeader (title + ◀▶ + day labels)
        └── WeekColumns (grid-cols-7, gap-2)
            └── DayColumn × 7
                ├── CategorySection × N
                │   ├── Header (color dot + name + msg count + [+plan] + [×remove])
                │   └── PlanItem × M (checkbox + title + msg link + order#)
                └── AddCategoryButton
```

## Date Handling

Mobile stores dates as epoch milliseconds (BIGINT). Web conversions:
- **Query range**: `startOfDay(date).getTime()` for epoch ms filters
- **Display**: `new Date(epochMs).toLocaleString("ko-KR")`
- **Create**: `new Date(year, month, day).getTime()` for date field
- **Week start**: Monday-based (matching mobile WeeklyPlanner)

## Key Interactions

1. **Week navigation**: Mini calendar week click or ◀▶ → URL param `?week=2026-02-16`
2. **Plan CRUD**: Inline input for quick add, dialog for edit
3. **Plan completion**: Checkbox → server action → optimistic UI
4. **Message linking**: 🔗 button → Popover with day's captured_messages
5. **Category management**: Per-day add/remove, bulk "add all to week"
6. **Week copy**: Previous week → current, current → next week
7. **Message count badge**: Click → Popover showing category messages for the day

## Color Handling

Mobile stores colors as ARGB integers (e.g., -16776961 = blue). Web conversion:
```typescript
function argbToHex(argb: number): string {
  const hex = (argb & 0x00FFFFFF).toString(16).padStart(6, '0');
  return `#${hex}`;
}
```

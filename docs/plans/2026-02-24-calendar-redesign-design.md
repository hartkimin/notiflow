# Calendar Tab Redesign: Day/Week/Month Views + Category Management

**Date:** 2026-02-24
**Status:** Approved
**Approach:** A - Extend existing ScheduleView

## Summary

Enhance the web dashboard's calendar tab with:
1. Day/Week/Month view switching (currently week-only)
2. Bidirectional category management (web ↔ mobile sync)
3. Filter rule management for automatic message categorization
4. Side panel for category and rule administration

## Requirements

| Item | Detail |
|------|--------|
| **View switching** | Day/Week/Month calendar views (keep existing week view, add day + month) |
| **Categories** | Bidirectional sync with mobile; full CRUD on web |
| **Auto-assignment** | Leverage existing `filter_rules` table; web provides rule editing UI |
| **Rule UI** | Side panel inside the calendar tab |

## Architecture

### URL Structure

```
/calendar?view=week&week=2026-02-23   (default: week)
/calendar?view=day&date=2026-02-24    (day)
/calendar?view=month&month=2026-02    (month)
```

### Component Hierarchy

```
CalendarPage (Server Component - data fetching)
└── ScheduleView (Client Component - state management)
    ├── ViewSwitcher (day/week/month tab + navigation)
    ├── WeekView (extract existing weekly rendering)
    ├── DayView (new - single date detail)
    ├── MonthView (new - grid with color dots)
    └── CalendarSidePanel (new - category/rule management)
```

### Data Fetching Strategy

Refactor range-based queries from week-specific to generic:
- `getPlans(startMs, endMs)` (replaces `getWeekPlans`)
- `getDayCategories(startMs, endMs)` (replaces `getWeekDayCategories`)
- `getMessages(startMs, endMs)` (replaces `getWeekMessages`)
- `getCategories()` - unchanged

Server component calculates range based on `view` parameter:
- `week`: 7-day range from Monday
- `day`: single day (startOfDay to startOfDay + 24h)
- `month`: first day of month to first day of next month

### View Navigation

- Month view: click date → day view
- Day view: "Week view" button → week view of that date's week
- Week view: click date header → day view

## View Designs

### Month View

- Calendar grid (Mon-Sun columns, 4-6 rows)
- Each cell shows: date number, category color dots, message count badge
- Today highlighted with ring
- Click date → navigate to day view

### Week View

- **Identical to current ScheduleView** - minimal code changes
- Only add ViewSwitcher header component

### Day View

- Single column layout
- Category sections (collapsible, same as week view columns but expanded)
- Plans with checkbox/edit/delete (same actions as week view)
- Message list expanded inline (not just badge count)
- Each message shows: sender, content preview, time
- Add plan/category buttons

## Side Panel

### Tab 1: Category Manager

- List all categories (active + inactive) with color dots
- Drag-to-reorder (update order_index)
- Edit: name, color (predefined palette), active toggle
- Create new category
- Soft delete (is_deleted = true)

Server actions to add:
```
createCategory({ name, color, order_index })
updateCategory(id, { name?, color?, is_active?, order_index? })
deleteCategory(id)  // soft delete
reorderCategories(orderedIds: string[])
```

### Tab 2: Filter Rule Editor

- List existing rules with category color, summary text
- Create/Edit form:
  - Target category (dropdown)
  - Sender keywords (comma-separated)
  - Sender match type (CONTAINS/EXACT/REGEX)
  - Include words (comma-separated)
  - Exclude words (comma-separated)
  - Include match type (OR/AND)
  - Condition type (AND/OR)
  - Target apps (multi-select)
  - Active toggle
- Soft delete

Server actions to add:
```
getFilterRules(): Promise<FilterRule[]>
createFilterRule(data)
updateFilterRule(id, data)
deleteFilterRule(id)  // soft delete
```

### Bidirectional Sync

- Web edits → Supabase tables directly
- Mobile SyncManager detects changes via Realtime → updates local Room DB
- Existing RealtimeListener already subscribes to `categories` table → web UI auto-refreshes
- Add `filter_rules` to RealtimeListener subscription

### Auto-Assignment Flow

1. Web edits filter_rules → Supabase table updated
2. Mobile detects rule change via Realtime → local DB updated
3. New messages evaluated against updated rules **on mobile device**
4. Assignment result synced to Supabase → web dashboard reflects it

**No server-side assignment engine needed.** Mobile handles the actual matching logic.

## New Types

```typescript
export interface FilterRule {
  id: string;
  category_id: string;
  sender_keywords: string[];
  sender_match_type: 'CONTAINS' | 'EXACT' | 'REGEX';
  sms_phone_number: string | null;
  include_words: string[];
  exclude_words: string[];
  include_match_type: 'OR' | 'AND';
  condition_type: 'AND' | 'OR';
  target_app_packages: string[];
  is_active: boolean;
}
```

## Files to Create/Modify

### New Files
- `src/components/calendar/view-switcher.tsx` - Tab switching + navigation
- `src/components/calendar/week-view.tsx` - Extract from schedule-view.tsx
- `src/components/calendar/day-view.tsx` - New day view
- `src/components/calendar/month-view.tsx` - New month view
- `src/components/calendar/side-panel.tsx` - Category + rule management
- `src/components/calendar/category-manager.tsx` - Category CRUD UI
- `src/components/calendar/filter-rule-editor.tsx` - Filter rule CRUD UI

### Modified Files
- `src/app/(dashboard)/calendar/page.tsx` - Add view param handling, range-based fetching
- `src/components/schedule-view.tsx` - Refactor: extract week view, add view switching
- `src/lib/queries/schedule.ts` - Generalize to range-based queries, add filter_rules query
- `src/lib/actions.ts` - Add category CRUD + filter rule CRUD actions
- `src/lib/types.ts` - Add FilterRule type
- `src/lib/schedule-utils.ts` - Add month-related date utilities
- `src/components/realtime-listener.tsx` - Add filter_rules to subscription

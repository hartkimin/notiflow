# Order Form Improvements Design

## Overview

Improve the order creation UX in both `PurchaseOrderForm` (full page) and `OrderInlineForm` (sheet) with portal-style search, tabbed product source selection, fixed-width resizable columns with DB persistence, and a sales rep column.

## Scope

Both `PurchaseOrderForm` (`/orders/new`) and `OrderInlineForm` (sheet-based inline form).

### Form Convergence

`OrderInlineForm` currently uses a different data model (`SelectedItem` + `createOrderAction`) than `PurchaseOrderForm` (`LineItem` + `createOrderWithDetailsAction`). As part of this work, `OrderInlineForm` will be migrated to use `LineItem` and `createOrderWithDetailsAction` so both forms share the same data model and submit path.

## Feature 1: Portal-Style Search (거래처 + 품목)

### Shared Component: `PortalSearchBox`

A reusable dropdown search component that shows a list immediately on focus, with live filtering as the user types.

**Behavior:**
- On focus/click: show 10 most recently used items (no typing required)
- On typing: filter results in real-time, combining recent items + search results
- Dropdown stays open while typing (search input + list visible simultaneously)
- Korean chosung (초성) search supported (extract existing utilities from `purchase-order-form.tsx` to `lib/chosung.ts`)
- Keyboard navigation: arrow keys to move, Enter to select, Escape to close

**Props:**
```ts
interface PortalSearchBoxProps<T extends { id: number; name: string }> {
  placeholder: string;
  onSelect: (item: T) => void;
  fetchRecent: () => Promise<T[]>;
  searchAction: (query: string) => Promise<T[]>;
  renderItem?: (item: T) => React.ReactNode;
  className?: string;
}
```

**Cache invalidation:** When `fetchRecent` function identity changes (e.g., `hospitalId` changes), the component resets its cached recent items and re-fetches.

### Hospital Search

- `fetchRecent`: new server action `getRecentHospitalsAction()` — queries `orders` table, groups by `hospital_id`, orders by `MAX(created_at) DESC`, limit 10
- `searchAction`: existing `searchHospitalsAction` (with chosung filtering on client)
- Replaces current hospital search UI in both forms

### Product Search (Tabbed)

Two tabs within the product add section:
1. **거래처 품목** — partner products registered for the selected hospital
2. **식약처 아이템** — items from `mfds_items` table

Each tab uses the same portal-style pattern:
- `fetchRecent` for 거래처 품목: recent partner products used in orders for this hospital
- `fetchRecent` for 식약처: recent mfds items used in orders
- `searchAction` for 거래처 품목: wraps client-side filtering of pre-loaded partner products in a promise (already loaded into state when hospital is selected)
- `searchAction` for 식약처: new server action `searchMfdsItemsAction(query)` — queries `mfds_items` by name/code

### New Server Actions (in `orders/actions.ts`)

```ts
getRecentHospitalsAction(): Promise<Array<{ id: number; name: string }>>
getRecentPartnerProductsAction(hospitalId: number): Promise<PartnerProduct[]>
getRecentMfdsItemsAction(): Promise<Array<{ id: number; name: string; code: string; source_type: "drug" | "device_std" }>>
searchMfdsItemsAction(query: string): Promise<Array<{ id: number; name: string; code: string; source_type: "drug" | "device_std" }>>
```

Note: `mfds_items.source_type` uses `'drug' | 'device_std'` in the DB. Map `device_std` → `"device"` only in the UI display layer, not in the data layer.

## Feature 2: Tabbed Product Source Selection

Replace the current toggle-button approach with `Tabs` component (shadcn/ui):

```
[ 거래처 품목 | 식약처 아이템 ]
┌─────────────────────────────┐
│ 🔍 검색...                  │
│ ─────────────────────────── │
│ 최근 사용 항목 10개 리스트   │
└─────────────────────────────┘
```

- Tab selection persists during the session
- When hospital is not selected, both tabs show "먼저 거래처를 선택하세요"
- 식약처 tab is always available (not dependent on hospital selection for browsing)

### Adding MFDS Items to Line Items

When selecting an mfds item, map to `LineItem`:
- `product_name`: mfds item `product_name`
- `standard_code`: from mfds item data (BAR_CODE for drug, UDIDI_CD for device_std)
- `source_type`: "drug" or "device" (mapped from DB's "device_std")
- `product_id`: mfds item id
- Other fields default (quantity: 1, prices: null)

## Feature 3: Table Column Management

### Fixed Layout + Overflow Prevention

- Apply `table-layout: fixed` on the items table
- Each column has a defined default width
- Cell content: `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
- Add `title` attribute on cells for hover tooltip

### Column Width Resize + DB Persistence

- Drag handle on column borders (already exists in `PurchaseOrderForm`, extend to `OrderInlineForm`)
- On resize end (mouseup): debounce 500ms, compare with last-saved widths (via `useRef`), skip save if unchanged
- Storage: `settings` table, key `order_column_widths`, value `{ "name": 200, "qty": 70, ... }`
- This is a global setting (all users share the same column widths) — matches the existing `settings` table pattern
- On page load: fetch saved widths alongside `getOrderDisplayColumns` and pass as prop

### New functions:

```ts
// settings.ts
getOrderColumnWidths(): Promise<Record<string, number>>

// settings/actions.ts — bypasses requireAdmin() since this is a layout preference
saveColumnWidthsAction(widths: Record<string, number>): Promise<void>
```

Add `order_column_widths` to `ALLOWED_SETTING_KEYS` in `settings/actions.ts`. Since column widths are a shared layout preference (not security-sensitive), the admin check can be bypassed for this specific action.

### Page component changes

Both `/orders/new/page.tsx` and `/orders/page.tsx` will fetch `getOrderColumnWidths()` and pass as a prop to the form components.

## Feature 4: Sales Rep Column

### Database Migration

```sql
-- 00044_order_items_sales_rep.sql
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sales_rep VARCHAR(100);
```

### UI Changes

- Add to `OPTIONAL_COLUMNS` array: `{ id: "sales_rep", label: "영업담당자", matchKeys: [] }`
- Render as free-text `Input` in the table row
- Include in `createOrderWithDetailsAction` and `createOrderAction` payloads
- Default visibility: hidden (user enables via column settings)

## Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/components/portal-search-box.tsx` | **NEW** — shared portal-style search component with generic type |
| `apps/web/src/lib/chosung.ts` | **NEW** — extracted chosung search utilities |
| `apps/web/src/components/purchase-order-form.tsx` | Refactor hospital search, add tabs, use PortalSearchBox, fix table layout, add sales_rep column |
| `apps/web/src/components/order-inline-form.tsx` | Migrate to LineItem/createOrderWithDetailsAction, same refactor as PurchaseOrderForm |
| `apps/web/src/app/(dashboard)/orders/actions.ts` | Add recent/search server actions for hospitals, mfds items, sales_rep in submit |
| `apps/web/src/app/(dashboard)/orders/new/page.tsx` | Fetch and pass column widths |
| `apps/web/src/app/(dashboard)/orders/page.tsx` | Fetch and pass column widths |
| `apps/web/src/lib/queries/settings.ts` | Add `getOrderColumnWidths` |
| `apps/web/src/app/(dashboard)/settings/actions.ts` | Add `saveColumnWidthsAction`, update `ALLOWED_SETTING_KEYS` |
| `packages/supabase/migrations/00044_order_items_sales_rep.sql` | **NEW** — add sales_rep column |

## Out of Scope

- Mobile app changes
- Order list/detail page changes
- Changing existing order status workflow
- Per-user column width preferences (use global settings for now)

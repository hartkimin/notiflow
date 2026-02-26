# MFDS 품목 검색 UI/UX 개선 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the MFDS item search page with column-targeted search, extended filters with AND/OR logic, repositioned toolbar elements, auto-fit columns, and full-field accordion detail with copy buttons.

**Architecture:** Progressively enhance 6 existing components — no new files. Replace `detectSearchFields()` with a column dropdown, extend `FilterChip` with an `operator` field, reposition toolbar elements, add double-click auto-fit to table headers, and expand row-detail to show all fields with copy buttons.

**Tech Stack:** Next.js 16, React 19, TanStack React Table, shadcn/ui (Select, DropdownMenu, Button, Badge, Input), Tailwind CSS, Clipboard API

---

## Task 1: Extend FilterChip type and add column metadata utilities

**Files:**
- Modify: `apps/web/src/lib/mfds-search-utils.ts` (全体 rewrite)

**Step 1: Replace `mfds-search-utils.ts` with new utility functions**

Replace the entire file contents. Remove `detectSearchFields()` and related regex constants. Add:

```typescript
import type { MfdsApiSource } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FilterOperator =
  | "contains"
  | "equals"
  | "startsWith"
  | "notContains"
  | "before"
  | "after"
  | "between";

export interface FilterChip {
  field: string;
  label: string;
  value: string;
  /** Secondary value for "between" operator */
  valueTo?: string;
  operator: FilterOperator;
}

export type ColumnType = "text" | "date" | "status";

export interface SearchableColumn {
  field: string;
  label: string;
  type: ColumnType;
}

// ---------------------------------------------------------------------------
// Searchable column definitions per tab (used by search dropdown)
// ---------------------------------------------------------------------------

const DRUG_SEARCHABLE_COLUMNS: SearchableColumn[] = [
  { field: "ITEM_NAME", label: "품목명", type: "text" },
  { field: "ENTP_NAME", label: "업체명", type: "text" },
  { field: "BAR_CODE", label: "표준코드", type: "text" },
  { field: "EDI_CODE", label: "보험코드", type: "text" },
  { field: "ATC_CODE", label: "ATC코드", type: "text" },
  { field: "ITEM_SEQ", label: "품목기준코드", type: "text" },
  { field: "PERMIT_KIND_NAME", label: "허가종류", type: "text" },
  { field: "CANCEL_NAME", label: "상태", type: "status" },
];

const DEVICE_SEARCHABLE_COLUMNS: SearchableColumn[] = [
  { field: "PRDLST_NM", label: "품목명", type: "text" },
  { field: "MNFT_IPRT_ENTP_NM", label: "업체명", type: "text" },
  { field: "UDIDI_CD", label: "UDI-DI", type: "text" },
  { field: "PERMIT_NO", label: "품목허가번호", type: "text" },
  { field: "MDEQ_CLSF_NO", label: "분류번호", type: "text" },
  { field: "CLSF_NO_GRAD_CD", label: "등급", type: "status" },
  { field: "FOML_INFO", label: "모델명", type: "text" },
];

/** Get searchable columns for search field dropdown */
export function getSearchableColumns(tab: MfdsApiSource): SearchableColumn[] {
  return tab === "drug" ? DRUG_SEARCHABLE_COLUMNS : DEVICE_SEARCHABLE_COLUMNS;
}

// ---------------------------------------------------------------------------
// Filterable column definitions per tab (used by filter builder)
// ---------------------------------------------------------------------------

const DRUG_FILTERABLE_COLUMNS: SearchableColumn[] = [
  { field: "ITEM_NAME", label: "품목명", type: "text" },
  { field: "ENTP_NAME", label: "업체명", type: "text" },
  { field: "BAR_CODE", label: "표준코드", type: "text" },
  { field: "EDI_CODE", label: "보험코드", type: "text" },
  { field: "ATC_CODE", label: "ATC코드", type: "text" },
  { field: "ITEM_SEQ", label: "품목기준코드", type: "text" },
  { field: "ITEM_ENG_NAME", label: "영문명", type: "text" },
  { field: "ENTP_NO", label: "업체허가번호", type: "text" },
  { field: "CNSGN_MANUF", label: "위탁제조업체", type: "text" },
  { field: "MATERIAL_NAME", label: "성분", type: "text" },
  { field: "CHART", label: "성상", type: "text" },
  { field: "STORAGE_METHOD", label: "저장방법", type: "text" },
  { field: "VALID_TERM", label: "유효기간", type: "text" },
  { field: "PACK_UNIT", label: "포장단위", type: "text" },
  { field: "PERMIT_KIND_NAME", label: "허가구분", type: "text" },
  { field: "ETC_OTC_CODE", label: "전문/일반", type: "status" },
  { field: "CANCEL_NAME", label: "상태", type: "status" },
  { field: "RARE_DRUG_YN", label: "희귀의약품", type: "text" },
  { field: "ITEM_PERMIT_DATE", label: "허가일자", type: "date" },
  { field: "CANCEL_DATE", label: "취소일자", type: "date" },
  { field: "CHANGE_DATE", label: "변경일자", type: "date" },
];

const DEVICE_FILTERABLE_COLUMNS: SearchableColumn[] = [
  { field: "PRDLST_NM", label: "품목명", type: "text" },
  { field: "MNFT_IPRT_ENTP_NM", label: "제조수입업체명", type: "text" },
  { field: "UDIDI_CD", label: "UDI-DI코드", type: "text" },
  { field: "PERMIT_NO", label: "품목허가번호", type: "text" },
  { field: "MDEQ_CLSF_NO", label: "분류번호", type: "text" },
  { field: "FOML_INFO", label: "모델명", type: "text" },
  { field: "PRDT_NM_INFO", label: "제품명", type: "text" },
  { field: "USE_PURPS_CONT", label: "사용목적", type: "text" },
  { field: "STERILIZATION_METHOD_NM", label: "멸균방법", type: "text" },
  { field: "STRG_CND_INFO", label: "저장조건", type: "text" },
  { field: "CIRC_CND_INFO", label: "유통취급조건", type: "text" },
  { field: "CLSF_NO_GRAD_CD", label: "등급", type: "status" },
  { field: "DSPSBL_MDEQ_YN", label: "일회용여부", type: "status" },
  { field: "HMBD_TRSPT_MDEQ_YN", label: "인체이식형여부", type: "status" },
  { field: "TRCK_MNG_TRGT_YN", label: "추적관리대상", type: "status" },
  { field: "TOTAL_DEV", label: "한벌구성여부", type: "status" },
  { field: "CMBNMD_YN", label: "조합의료기기", type: "status" },
  { field: "RCPRSLRY_TRGT_YN", label: "요양급여대상", type: "status" },
  { field: "USE_BEFORE_STRLZT_NEED_YN", label: "사전멸균필요", type: "status" },
  { field: "PRMSN_YMD", label: "허가일자", type: "date" },
];

/** Get filterable columns for filter builder */
export function getFilterableColumns(tab: MfdsApiSource): SearchableColumn[] {
  return tab === "drug" ? DRUG_FILTERABLE_COLUMNS : DEVICE_FILTERABLE_COLUMNS;
}

// ---------------------------------------------------------------------------
// Operators per column type
// ---------------------------------------------------------------------------

const OPERATOR_OPTIONS: Record<ColumnType, { value: FilterOperator; label: string }[]> = {
  text: [
    { value: "contains", label: "포함" },
    { value: "equals", label: "일치" },
    { value: "startsWith", label: "시작" },
    { value: "notContains", label: "제외" },
  ],
  date: [
    { value: "before", label: "이전" },
    { value: "after", label: "이후" },
    { value: "between", label: "범위" },
  ],
  status: [
    { value: "equals", label: "일치" },
  ],
};

export function getOperatorsForType(type: ColumnType) {
  return OPERATOR_OPTIONS[type];
}

// ---------------------------------------------------------------------------
// "전체" search fallback sequence
// ---------------------------------------------------------------------------

const DRUG_FALLBACK_FIELDS = ["ITEM_NAME", "ENTP_NAME", "BAR_CODE"];
const DEVICE_FALLBACK_FIELDS = ["PRDLST_NM", "MNFT_IPRT_ENTP_NM", "UDIDI_CD"];

/** Get fallback field sequence for "전체" search mode */
export function getFallbackFields(tab: MfdsApiSource): string[] {
  return tab === "drug" ? DRUG_FALLBACK_FIELDS : DEVICE_FALLBACK_FIELDS;
}

// ---------------------------------------------------------------------------
// Client-side filter matching
// ---------------------------------------------------------------------------

/** Check if a single row value matches a filter chip (client-side) */
export function matchesFilter(
  rowValue: unknown,
  chip: FilterChip,
): boolean {
  const val = String(rowValue ?? "").toLowerCase();
  const target = chip.value.toLowerCase();

  switch (chip.operator) {
    case "contains":
      return val.includes(target);
    case "equals":
      return val === target;
    case "startsWith":
      return val.startsWith(target);
    case "notContains":
      return !val.includes(target);
    case "before":
      return val !== "" && val < target;
    case "after":
      return val !== "" && val > target;
    case "between": {
      const to = (chip.valueTo ?? "").toLowerCase();
      return val !== "" && val >= target && val <= to;
    }
    default:
      return true;
  }
}
```

**Step 2: Verify the file compiles**

Run: `cd /mnt/d/Project/09_NotiFlow && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`

Expected: No errors related to `mfds-search-utils.ts` (there may be existing errors in other files that import `detectSearchFields` or old `FilterChip` — those will be fixed in subsequent tasks).

**Step 3: Commit**

```bash
git add apps/web/src/lib/mfds-search-utils.ts
git commit -m "refactor: replace detectSearchFields with column metadata utilities

Add getSearchableColumns, getFilterableColumns, getOperatorsForType,
getFallbackFields, matchesFilter. Extend FilterChip with operator field."
```

---

## Task 2: Update MfdsSearchPanel to use new search logic

**Files:**
- Modify: `apps/web/src/components/mfds-search-panel.tsx`

**Step 1: Update imports and state**

At line 36, change the import:
```typescript
// OLD
import { detectSearchFields, type FilterChip } from "@/lib/mfds-search-utils";

// NEW
import { getFallbackFields, type FilterChip } from "@/lib/mfds-search-utils";
```

Add new state after `activeFilters` (around line 70):
```typescript
const [searchField, setSearchField] = useState<string>("_all");
const [filterLogic, setFilterLogic] = useState<"and" | "or">("and");
```

**Step 2: Rewrite `doSearch` callback to use column dropdown instead of detectSearchFields**

Replace the `doSearch` callback (lines 280–333) with:

```typescript
const doSearch = useCallback(
  (targetPage = 1) => {
    const q = query.trim();

    startTransition(async () => {
      setIsLoading(true);
      try {
        // Build chip-based filters (only API-compatible operators: contains/equals)
        const chipFilters: Record<string, string> = {};
        for (const chip of activeFilters) {
          if (chip.operator === "contains" || chip.operator === "equals") {
            chipFilters[chip.field] = chip.value;
          }
        }

        const searchFn = tab === "drug" ? searchMfdsDrug : searchMfdsDevice;

        let result: { items: Record<string, unknown>[]; totalCount: number };

        if (searchField === "_all" && q) {
          // "전체" mode: try fallback fields sequentially
          const fallbackFields = getFallbackFields(tab);
          result = { items: [], totalCount: 0 };
          for (const field of fallbackFields) {
            result = await searchFn({ [field]: q, ...chipFilters }, targetPage);
            if (result.totalCount > 0) break;
          }
        } else if (q) {
          // Specific column selected
          result = await searchFn({ [searchField]: q, ...chipFilters }, targetPage);
        } else {
          // No query text — use only chip filters (list all if empty)
          result = await searchFn(chipFilters, targetPage);
        }

        setResults(result.items as Record<string, unknown>[]);
        setTotalCount(result.totalCount);
        setPage(targetPage);
        setHasSearched(true);
        setExpandedRowId(null);

        if (q) {
          recentSearches.add(q, tab);
        }
      } catch (err) {
        toast.error(
          `검색 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
          {
            action: {
              label: "재시도",
              onClick: () => doSearch(targetPage),
            },
          },
        );
      } finally {
        setIsLoading(false);
      }
    });
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [query, activeFilters, tab, searchField],
);
```

**Step 3: Pass new props to MfdsSearchBar**

In the render section where `<MfdsSearchBar>` is rendered (around line 504), add new props:

```tsx
<MfdsSearchBar
  tab={tab}
  onTabChange={handleTabChange}
  query={query}
  onQueryChange={setQuery}
  searchField={searchField}
  onSearchFieldChange={setSearchField}
  activeFilters={activeFilters}
  onFiltersChange={setActiveFilters}
  filterLogic={filterLogic}
  onFilterLogicChange={setFilterLogic}
  onSearch={() => {
    if (mode === "manage") {
      setGlobalFilter(query);
    } else {
      doSearch(1);
    }
  }}
  isPending={isPending}
  recentSearches={recentSearches.items}
  onRecentClick={handleRecentClick}
  hasSearched={hasSearched}
/>
```

**Step 4: Reset searchField on tab change**

In `handleTabChange` function, add after `setActiveFilters([])`:
```typescript
setSearchField("_all");
setFilterLogic("and");
```

**Step 5: Commit**

```bash
git add apps/web/src/components/mfds-search-panel.tsx
git commit -m "feat: integrate column search dropdown and filter logic state

Replace detectSearchFields with dropdown-driven search in doSearch.
Add searchField and filterLogic state, pass to MfdsSearchBar."
```

---

## Task 3: Update MfdsSearchBar with column dropdown and extended filters

**Files:**
- Modify: `apps/web/src/components/mfds/mfds-search-bar.tsx`

**Step 1: Replace filter field constants and update imports**

Replace lines 1–18 with:
```typescript
"use client";

import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from "react";
import { Search, Loader2, Plus, X, Clock } from "lucide-react";

import type { MfdsApiSource } from "@/lib/types";
import {
  type FilterChip,
  type FilterOperator,
  getSearchableColumns,
  getFilterableColumns,
  getOperatorsForType,
} from "@/lib/mfds-search-utils";
import type { RecentSearch } from "@/hooks/use-recent-searches";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
```

Remove the old `DRUG_FILTER_FIELDS` and `DEVICE_FILTER_FIELDS` constants entirely (old lines 24–39).

**Step 2: Update props interface**

Replace `MfdsSearchBarProps` with:
```typescript
export interface MfdsSearchBarProps {
  tab: MfdsApiSource;
  onTabChange: (tab: MfdsApiSource) => void;
  query: string;
  onQueryChange: (q: string) => void;
  searchField: string;
  onSearchFieldChange: (field: string) => void;
  activeFilters: FilterChip[];
  onFiltersChange: (filters: FilterChip[]) => void;
  filterLogic: "and" | "or";
  onFilterLogicChange: (logic: "and" | "or") => void;
  onSearch: () => void;
  isPending: boolean;
  recentSearches: RecentSearch[];
  onRecentClick: (item: RecentSearch) => void;
  hasSearched: boolean;
}
```

**Step 3: Update component destructuring and state**

Add `searchField`, `onSearchFieldChange`, `filterLogic`, `onFilterLogicChange` to destructuring.

Update the filter state to track operator:
```typescript
const [editingFilter, setEditingFilter] = useState<{
  field: string;
  label: string;
  type: "text" | "date" | "status";
} | null>(null);
const [editingValue, setEditingValue] = useState("");
const [editingValueTo, setEditingValueTo] = useState("");
const [editingOperator, setEditingOperator] = useState<FilterOperator>("contains");
const filterInputRef = useRef<HTMLInputElement>(null);
```

Replace `filterFields` / `availableFilterFields` computation:
```typescript
const searchableColumns = getSearchableColumns(tab);
const filterableColumns = getFilterableColumns(tab);
const activeFieldSet = new Set(activeFilters.map((f) => f.field));
const availableFilterFields = filterableColumns.filter(
  (f) => !activeFieldSet.has(f.field),
);
```

**Step 4: Update filter handlers**

Update `handleStartAddFilter`:
```typescript
const handleStartAddFilter = useCallback(
  (filterDef: { field: string; label: string; type: "text" | "date" | "status" }) => {
    setEditingFilter(filterDef);
    setEditingValue("");
    setEditingValueTo("");
    const defaultOp = getOperatorsForType(filterDef.type)[0].value;
    setEditingOperator(defaultOp);
    setTimeout(() => filterInputRef.current?.focus(), 0);
  },
  [],
);
```

Update `handleConfirmFilter`:
```typescript
const handleConfirmFilter = useCallback(() => {
  if (!editingFilter || !editingValue.trim()) {
    setEditingFilter(null);
    setEditingValue("");
    setEditingValueTo("");
    return;
  }
  const operatorLabels: Record<FilterOperator, string> = {
    contains: "포함",
    equals: "일치",
    startsWith: "시작",
    notContains: "제외",
    before: "이전",
    after: "이후",
    between: "범위",
  };
  const opLabel = operatorLabels[editingOperator];
  const newChip: FilterChip = {
    field: editingFilter.field,
    label: editingFilter.label,
    value: editingValue.trim(),
    ...(editingOperator === "between" && editingValueTo.trim()
      ? { valueTo: editingValueTo.trim() }
      : {}),
    operator: editingOperator,
  };
  onFiltersChange([...activeFilters, newChip]);
  setEditingFilter(null);
  setEditingValue("");
  setEditingValueTo("");
}, [editingFilter, editingValue, editingValueTo, editingOperator, activeFilters, onFiltersChange]);
```

**Step 5: Update search form render — add column dropdown**

Replace the `{/* 2. Search Form */}` section with:
```tsx
{/* 2. Search Form */}
<form onSubmit={handleSubmit} className="flex items-center gap-2">
  <Select value={searchField} onValueChange={onSearchFieldChange}>
    <SelectTrigger className="h-11 w-[140px] shrink-0">
      <SelectValue placeholder="전체" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="_all">전체</SelectItem>
      {searchableColumns.map((col) => (
        <SelectItem key={col.field} value={col.field}>
          {col.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <div className="relative flex-1">
    <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
    <Input
      value={query}
      onChange={(e) => onQueryChange(e.target.value)}
      placeholder="검색어를 입력하세요..."
      className="h-11 pl-9 pr-9"
    />
    {query && (
      <button
        type="button"
        onClick={handleClearQuery}
        className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
      >
        <X className="size-4" />
      </button>
    )}
  </div>
  <Button type="submit" disabled={isPending} className="h-11">
    {isPending ? (
      <Loader2 className="size-4 animate-spin" />
    ) : (
      <Search className="size-4" />
    )}
    검색
  </Button>
</form>
```

**Step 6: Update filter chip area — add AND/OR toggle and operator display**

Replace the `{/* 3. Filter Chips Area */}` section with:
```tsx
{/* 3. Filter Chips Area */}
<div className="flex flex-wrap items-center gap-2">
  {/* AND/OR toggle (show when 2+ filters) */}
  {activeFilters.length >= 2 && (
    <div className="bg-muted inline-flex rounded-md p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onFilterLogicChange("and")}
        className={`rounded px-2 py-0.5 font-medium transition-colors ${
          filterLogic === "and"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground"
        }`}
      >
        AND
      </button>
      <button
        type="button"
        onClick={() => onFilterLogicChange("or")}
        className={`rounded px-2 py-0.5 font-medium transition-colors ${
          filterLogic === "or"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground"
        }`}
      >
        OR
      </button>
    </div>
  )}

  {/* Active filters */}
  {activeFilters.map((chip) => {
    const operatorLabels: Record<string, string> = {
      contains: "포함",
      equals: "=",
      startsWith: "시작",
      notContains: "제외",
      before: "이전",
      after: "이후",
      between: "범위",
    };
    const opLabel = operatorLabels[chip.operator] ?? chip.operator;
    return (
      <Badge
        key={chip.field}
        variant="secondary"
        className="gap-1 pl-2.5 pr-1.5 py-1"
      >
        <span className="text-xs">
          {chip.label} {opLabel} &quot;{chip.value}&quot;
          {chip.valueTo ? `~"${chip.valueTo}"` : ""}
        </span>
        <button
          type="button"
          onClick={() => handleRemoveFilter(chip.field)}
          className="text-muted-foreground hover:text-foreground ml-0.5 rounded-full"
        >
          <X className="size-3" />
        </button>
      </Badge>
    );
  })}

  {/* Inline editing for new filter */}
  {editingFilter && (
    <Badge variant="outline" className="gap-1 py-0.5 pl-2.5 pr-1">
      <span className="text-xs font-medium">{editingFilter.label}:</span>
      {/* Operator selector (for types with multiple operators) */}
      {getOperatorsForType(editingFilter.type).length > 1 && (
        <select
          value={editingOperator}
          onChange={(e) => setEditingOperator(e.target.value as FilterOperator)}
          className="h-5 border-none bg-transparent text-xs outline-none"
        >
          {getOperatorsForType(editingFilter.type).map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      )}
      <input
        ref={filterInputRef}
        type={editingFilter.type === "date" ? "date" : "text"}
        value={editingValue}
        onChange={(e) => setEditingValue(e.target.value)}
        onKeyDown={handleFilterKeyDown}
        onBlur={handleConfirmFilter}
        className="h-5 w-24 border-none bg-transparent text-xs outline-none"
        placeholder={editingFilter.type === "date" ? "YYYY-MM-DD" : "값 입력..."}
      />
      {editingOperator === "between" && (
        <>
          <span className="text-xs">~</span>
          <input
            type={editingFilter.type === "date" ? "date" : "text"}
            value={editingValueTo}
            onChange={(e) => setEditingValueTo(e.target.value)}
            onKeyDown={handleFilterKeyDown}
            className="h-5 w-24 border-none bg-transparent text-xs outline-none"
            placeholder={editingFilter.type === "date" ? "YYYY-MM-DD" : "값 입력..."}
          />
        </>
      )}
    </Badge>
  )}

  {/* Add filter dropdown — show all filterable columns */}
  {!editingFilter && availableFilterFields.length > 0 && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="text-muted-foreground gap-1">
          <Plus className="size-3" />
          필터 추가
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        {availableFilterFields.map((f) => (
          <DropdownMenuItem
            key={f.field}
            onClick={() => handleStartAddFilter(f)}
          >
            {f.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )}
</div>
```

**Step 7: Verify compilation**

Run: `cd /mnt/d/Project/09_NotiFlow && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30`

Expected: No type errors.

**Step 8: Commit**

```bash
git add apps/web/src/components/mfds/mfds-search-bar.tsx
git commit -m "feat: add column search dropdown and extended filter builder

Add Select dropdown for column-targeted search with per-tab options.
Extend filter chips with operator selection (text/date/status types).
Add AND/OR toggle for multiple filter logic."
```

---

## Task 4: Update MfdsResultToolbar — reposition global filter + rename column button

**Files:**
- Modify: `apps/web/src/components/mfds/mfds-result-toolbar.tsx`

**Step 1: Rearrange layout and rename button**

Replace the entire component render (lines 39–103) with:

```tsx
return (
  <div className="flex items-center justify-between gap-2 flex-wrap">
    {/* Left side — result summary + global filter */}
    <div className="flex items-center gap-3">
      <p className="text-sm text-muted-foreground whitespace-nowrap">
        총 {totalCount.toLocaleString()}건 (페이지 {page}/{totalPages || 1})
        {globalFilter && (
          <span className="ml-2">· 필터 적용: {filteredCount}건 표시</span>
        )}
      </p>

      {/* Global filter input — repositioned to left side */}
      <div className="relative">
        <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder="결과 내 검색..."
          value={globalFilter}
          onChange={(e) => onGlobalFilterChange(e.target.value)}
          className="pl-7 h-8 w-48 text-xs"
        />
        {globalFilter && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => onGlobalFilterChange("")}
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>

    {/* Right side — column visibility toggle (renamed) */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Settings2 className="h-3 w-3 mr-1" />
          표시 항목
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 max-h-80 overflow-y-auto"
      >
        <DropdownMenuLabel>표시할 항목</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllLeafColumns()
          .filter((col) => col.id !== "_action" && col.id !== "_expand")
          .map((col) => (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={col.getIsVisible()}
              onCheckedChange={(v: boolean) => col.toggleVisibility(v)}
            >
              {typeof col.columnDef.header === "string"
                ? col.columnDef.header
                : col.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
```

**Step 2: Commit**

```bash
git add apps/web/src/components/mfds/mfds-result-toolbar.tsx
git commit -m "feat: reposition global filter to left, rename column button to 표시 항목

Move 결과 내 검색 next to total count for natural flow.
Rename 컬럼 button to 표시 항목 and dropdown title to 표시할 항목."
```

---

## Task 5: Add double-click auto-fit to table header

**Files:**
- Modify: `apps/web/src/components/mfds/mfds-result-table.tsx`

**Step 1: Add auto-fit handler and apply to `<th>` elements**

In the header rendering section (inside the `headerGroup.headers.map`), find the `<th>` element (around line 153) and add `onDoubleClick`:

Replace the `<th>` opening and its inner `<div>` (lines 153–184) with the version below. Only the `onDoubleClick` on the outer `<div>` is added:

```tsx
<th
  key={header.id}
  className={`relative px-3 py-2 text-left whitespace-nowrap select-none ${
    isUtility ? "w-12" : ""
  }`}
  style={
    isUtility ? undefined : { width: header.getSize() }
  }
>
  <div
    className={`flex items-center gap-1 ${
      header.column.getCanSort()
        ? "cursor-pointer hover:text-foreground"
        : ""
    }`}
    onClick={header.column.getToggleSortingHandler()}
    onDoubleClick={
      !isUtility
        ? (e) => {
            e.stopPropagation();
            // Auto-fit: measure all visible cells for this column
            const colId = header.column.id;
            const cells = document.querySelectorAll(
              `td[data-col-id="${colId}"]`,
            );
            let maxWidth = 100; // minimum
            cells.forEach((cell) => {
              const textWidth = cell.scrollWidth;
              if (textWidth > maxWidth) maxWidth = textWidth;
            });
            // Include header text width
            const headerEl = e.currentTarget;
            if (headerEl.scrollWidth > maxWidth) {
              maxWidth = headerEl.scrollWidth;
            }
            header.column.setSize(
              Math.min(Math.max(maxWidth + 16, 100), 500),
            );
          }
        : undefined
    }
  >
```

**Step 2: Add `data-col-id` attribute to `<td>` elements**

In the body rows section (around line 228), update the `<td>` to include a data attribute:

Find:
```tsx
<td
  key={cell.id}
  className="px-3 py-2 whitespace-nowrap max-w-[300px] truncate"
  style={{ width: cell.column.getSize() }}
```

Replace with:
```tsx
<td
  key={cell.id}
  data-col-id={cell.column.id}
  className="px-3 py-2 whitespace-nowrap max-w-[300px] truncate"
  style={{ width: cell.column.getSize() }}
```

**Step 3: Commit**

```bash
git add apps/web/src/components/mfds/mfds-result-table.tsx
git commit -m "feat: add double-click auto-fit for column headers

Double-click a column header to auto-resize to content width.
Measures all visible cell widths, clamps between 100-500px."
```

---

## Task 6: Expand accordion row detail with all fields + copy buttons

**Files:**
- Modify: `apps/web/src/components/mfds/mfds-row-detail.tsx`

**Step 1: Rewrite field group definitions to include all fields**

Replace the entire `DRUG_GROUPS` and `DEVICE_STD_GROUPS` constants (lines 37–98) with:

```typescript
const DRUG_GROUPS: FieldGroup[] = [
  {
    title: "기본 정보",
    fields: [
      { key: "ITEM_SEQ", label: "품목기준코드" },
      { key: "ITEM_NAME", label: "품목명" },
      { key: "ITEM_ENG_NAME", label: "품목영문명" },
      { key: "ENTP_NAME", label: "업체명" },
      { key: "ENTP_NO", label: "업체허가번호" },
      { key: "CNSGN_MANUF", label: "위탁제조업체" },
      { key: "PACK_UNIT", label: "포장단위" },
    ],
  },
  {
    title: "분류/허가",
    fields: [
      { key: "ETC_OTC_CODE", label: "전문/일반" },
      { key: "PERMIT_KIND_NAME", label: "허가/신고구분" },
      { key: "BAR_CODE", label: "표준코드" },
      { key: "EDI_CODE", label: "보험코드" },
      { key: "ATC_CODE", label: "ATC코드" },
      { key: "CANCEL_NAME", label: "상태" },
      { key: "CANCEL_DATE", label: "취소일자" },
      { key: "ITEM_PERMIT_DATE", label: "허가일자" },
      { key: "CHANGE_DATE", label: "변경일자" },
      { key: "RARE_DRUG_YN", label: "희귀의약품" },
    ],
  },
  {
    title: "상세 정보",
    fields: [
      { key: "MATERIAL_NAME", label: "성분" },
      { key: "CHART", label: "성상" },
      { key: "STORAGE_METHOD", label: "저장방법" },
      { key: "VALID_TERM", label: "유효기간" },
      { key: "EE_DOC_ID", label: "효능효과" },
      { key: "UD_DOC_ID", label: "용법용량" },
      { key: "NB_DOC_ID", label: "주의사항" },
    ],
  },
];

const DEVICE_STD_GROUPS: FieldGroup[] = [
  {
    title: "기본 정보",
    fields: [
      { key: "PRDLST_NM", label: "품목명" },
      { key: "PRDT_NM_INFO", label: "제품명" },
      { key: "MNFT_IPRT_ENTP_NM", label: "제조수입업체명" },
      { key: "FOML_INFO", label: "모델명" },
      { key: "TOTAL_DEV", label: "한벌구성의료기기여부" },
    ],
  },
  {
    title: "분류/허가",
    fields: [
      { key: "MDEQ_CLSF_NO", label: "분류번호" },
      { key: "CLSF_NO_GRAD_CD", label: "등급" },
      { key: "UDIDI_CD", label: "UDI-DI코드" },
      { key: "PERMIT_NO", label: "품목허가번호" },
      { key: "PRMSN_YMD", label: "허가일자" },
      { key: "USE_PURPS_CONT", label: "사용목적" },
    ],
  },
  {
    title: "관리/보관",
    fields: [
      { key: "DSPSBL_MDEQ_YN", label: "일회용여부" },
      { key: "HMBD_TRSPT_MDEQ_YN", label: "인체이식형여부" },
      { key: "TRCK_MNG_TRGT_YN", label: "추적관리대상여부" },
      { key: "CMBNMD_YN", label: "조합의료기기여부" },
      { key: "RCPRSLRY_TRGT_YN", label: "요양급여대상여부" },
      { key: "USE_BEFORE_STRLZT_NEED_YN", label: "사용전멸균필요여부" },
      { key: "STERILIZATION_METHOD_NM", label: "멸균방법" },
      { key: "STRG_CND_INFO", label: "저장조건" },
      { key: "CIRC_CND_INFO", label: "유통취급조건" },
    ],
  },
];
```

**Step 2: Add copy button and update field rendering**

Add `Copy` and `Check` from lucide imports (update line 5):
```typescript
import { Plus, Loader2, Check, Copy } from "lucide-react";
```

Add a `CopyButton` component inside the file (before the main component):

```typescript
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for non-HTTPS
      const textarea = document.createElement("textarea");
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded"
      title="복사"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}
```

Add `useState` and `useCallback` to imports (update line 1 area):
```typescript
import { useState, useCallback } from "react";
```

**Step 3: Update field rendering to show all fields (including empty) + copy buttons + wrapping**

In the `content` JSX (around line 131), replace the field groups rendering:

Replace the group mapping (lines 135–160) with:
```tsx
{groups.map((group) => (
  <div key={group.title}>
    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
      {group.title}
    </h4>
    <dl className="space-y-1">
      {group.fields.map((field) => {
        const rawValue = item[field.key];
        const displayValue = isNonEmpty(rawValue) ? String(rawValue) : "-";
        return (
          <div key={field.key} className="flex gap-2 text-sm items-start">
            <dt className="text-muted-foreground shrink-0 w-28 text-right pt-0.5">
              {field.label}
            </dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words flex-1">
              {displayValue}
            </dd>
            {isNonEmpty(rawValue) && (
              <CopyButton value={String(rawValue)} />
            )}
          </div>
        );
      })}
    </dl>
  </div>
))}
```

Note the key changes:
- `w-24` → `w-28` for label width (accommodate longer labels)
- Removed the `filter(isNonEmpty)` — show all fields, display "-" for empty
- Added `whitespace-pre-wrap break-words` for long text
- Added `items-start` for alignment when text wraps
- Added `<CopyButton>` next to each non-empty value

**Step 4: Verify compilation**

Run: `cd /mnt/d/Project/09_NotiFlow && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`

Expected: No type errors.

**Step 5: Commit**

```bash
git add apps/web/src/components/mfds/mfds-row-detail.tsx
git commit -m "feat: show all fields in accordion detail with copy buttons

Expand drug groups to 24 fields and device groups to 20 fields.
Show all fields including empty ones (display as -).
Add per-field copy button with clipboard API.
Apply whitespace-pre-wrap for long text content."
```

---

## Task 7: Verify full build and visual test

**Step 1: Run TypeScript compilation**

Run: `cd /mnt/d/Project/09_NotiFlow && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | tail -20`

Expected: No errors.

**Step 2: Run Next.js build**

Run: `cd /mnt/d/Project/09_NotiFlow/apps/web && npm run build 2>&1 | tail -20`

Expected: Build succeeds.

**Step 3: Start dev server and manually verify**

Run: `cd /mnt/d/Project/09_NotiFlow && npm run dev:web`

Open `http://localhost:3000/products` and verify:
1. Column dropdown appears left of search input with "전체" default
2. Tab switch changes dropdown options
3. Filter "추가" shows all columns with operator selection
4. AND/OR toggle appears when 2+ filters active
5. "결과 내 검색" is next to total count on the left
6. "표시 항목" button replaces "컬럼"
7. Double-click column header auto-fits width
8. Accordion shows all fields with copy buttons and "-" for empty

**Step 4: Final commit**

If any fixes were needed, commit them:
```bash
git add -A
git commit -m "fix: address build/visual issues from search UI improvements"
```

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MfdsSearchBar({
  tab,
  onTabChange,
  query,
  onQueryChange,
  searchField,
  onSearchFieldChange,
  activeFilters,
  onFiltersChange,
  filterLogic,
  onFilterLogicChange,
  onSearch,
  isPending,
  recentSearches,
  onRecentClick,
  hasSearched,
}: MfdsSearchBarProps) {
  // State for inline filter editing
  const [editingFilter, setEditingFilter] = useState<{
    field: string;
    label: string;
    type: "text" | "date" | "status";
  } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingValueTo, setEditingValueTo] = useState("");
  const [editingOperator, setEditingOperator] = useState<FilterOperator>("contains");
  const filterInputRef = useRef<HTMLInputElement>(null);

  const searchableColumns = getSearchableColumns(tab);
  const filterableColumns = getFilterableColumns(tab);
  const activeFieldSet = new Set(activeFilters.map((f) => f.field));
  const availableFilterFields = filterableColumns.filter(
    (f) => !activeFieldSet.has(f.field),
  );

  // -- Handlers ---------------------------------------------------------------

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!query.trim() && activeFilters.length === 0) return;
      onSearch();
    },
    [query, activeFilters, onSearch],
  );

  const handleClearQuery = useCallback(() => {
    onQueryChange("");
  }, [onQueryChange]);

  const handleRemoveFilter = useCallback(
    (field: string) => {
      onFiltersChange(activeFilters.filter((f) => f.field !== field));
    },
    [activeFilters, onFiltersChange],
  );

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

  const handleConfirmFilter = useCallback(() => {
    if (!editingFilter || !editingValue.trim()) {
      setEditingFilter(null);
      setEditingValue("");
      setEditingValueTo("");
      return;
    }
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

  const handleCancelFilter = useCallback(() => {
    setEditingFilter(null);
    setEditingValue("");
    setEditingValueTo("");
  }, []);

  const handleFilterKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirmFilter();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelFilter();
      }
    },
    [handleConfirmFilter, handleCancelFilter],
  );

  // -- Render -----------------------------------------------------------------

  return (
    <div className="space-y-3">
      {/* 1. Segment Toggle */}
      <div className="bg-muted inline-flex rounded-lg p-1">
        <button
          type="button"
          onClick={() => onTabChange("drug")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            tab === "drug"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          의약품
        </button>
        <button
          type="button"
          onClick={() => onTabChange("device_std")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            tab === "device_std"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          의료기기
        </button>
      </div>

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

      {/* 4. Recent Searches */}
      {!hasSearched && recentSearches.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <Clock className="size-3.5" />
            <span>최근:</span>
          </div>
          {recentSearches.map((item) => (
            <button
              key={`${item.query}-${item.tab}-${item.timestamp}`}
              type="button"
              onClick={() => onRecentClick(item)}
              className="bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-full px-3 py-0.5 text-xs transition-colors"
            >
              {item.query}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

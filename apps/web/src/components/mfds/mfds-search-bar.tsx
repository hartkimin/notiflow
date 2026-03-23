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

  const hasFiltersOrRecent = activeFilters.length > 0 || editingFilter || (!hasSearched && recentSearches.length > 0);

  return (
    <div className="space-y-1.5 shrink-0">
      {/* Single compact row: tab toggle + field select + search input + button */}
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        {/* Segment Toggle */}
        <div className="bg-muted inline-flex rounded-lg p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onTabChange("drug")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
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
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              tab === "device_std"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            의료기기
          </button>
        </div>

        {/* Field select */}
        <Select value={searchField} onValueChange={onSearchFieldChange}>
          <SelectTrigger className="h-8 w-[120px] shrink-0 text-xs">
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

        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="검색어를 입력하세요..."
            className="h-8 pl-8 pr-8 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={handleClearQuery}
              className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Search button */}
        <Button type="submit" disabled={isPending} size="sm" className="h-8 shrink-0">
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Search className="size-3.5" />
          )}
          <span className="ml-1">검색</span>
        </Button>
      </form>

      {/* Compact filter row (only shown when active) */}
      {hasFiltersOrRecent && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* AND/OR toggle */}
          {activeFilters.length >= 2 && (
            <div className="bg-muted inline-flex rounded-md p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => onFilterLogicChange("and")}
                className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
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
                className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
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
                className="gap-0.5 pl-2 pr-1 py-0.5 text-[11px]"
              >
                <span>
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
            <Badge variant="outline" className="gap-1 py-0.5 pl-2 pr-1 text-[11px]">
              <span className="font-medium">{editingFilter.label}:</span>
              {getOperatorsForType(editingFilter.type).length > 1 && (
                <select
                  value={editingOperator}
                  onChange={(e) => setEditingOperator(e.target.value as FilterOperator)}
                  className="h-4 border-none bg-transparent text-[11px] outline-none"
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
                className="h-4 w-20 border-none bg-transparent text-[11px] outline-none"
                placeholder={editingFilter.type === "date" ? "YYYY-MM-DD" : "값 입력..."}
              />
              {editingOperator === "between" && (
                <>
                  <span className="text-[11px]">~</span>
                  <input
                    type={editingFilter.type === "date" ? "date" : "text"}
                    value={editingValueTo}
                    onChange={(e) => setEditingValueTo(e.target.value)}
                    onKeyDown={handleFilterKeyDown}
                    className="h-4 w-20 border-none bg-transparent text-[11px] outline-none"
                    placeholder={editingFilter.type === "date" ? "YYYY-MM-DD" : "값 입력..."}
                  />
                </>
              )}
            </Badge>
          )}

          {/* Add filter button */}
          {!editingFilter && availableFilterFields.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="xs" className="text-muted-foreground gap-0.5 h-6 text-[11px]">
                  <Plus className="size-3" />
                  필터
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

          {/* Separator + Recent searches (inline) */}
          {!hasSearched && recentSearches.length > 0 && activeFilters.length === 0 && !editingFilter && (
            <>
              <span className="text-muted-foreground/30 mx-0.5">|</span>
              <Clock className="size-3 text-muted-foreground" />
              {recentSearches.slice(0, 5).map((item) => (
                <button
                  key={`${item.query}-${item.tab}-${item.timestamp}`}
                  type="button"
                  onClick={() => onRecentClick(item)}
                  className="bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-full px-2 py-0.5 text-[11px] transition-colors"
                >
                  {item.query}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

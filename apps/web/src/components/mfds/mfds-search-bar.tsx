"use client";

import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from "react";
import { Search, Loader2, Plus, X, Clock } from "lucide-react";

import type { MfdsApiSource } from "@/lib/types";
import type { FilterChip } from "@/lib/mfds-search-utils";
import type { RecentSearch } from "@/hooks/use-recent-searches";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Filter field definitions per tab
// ---------------------------------------------------------------------------

const DRUG_FILTER_FIELDS: { field: string; label: string }[] = [
  { field: "ENTP_NAME", label: "업체명" },
  { field: "BAR_CODE", label: "표준코드" },
  { field: "EDI_CODE", label: "보험코드" },
  { field: "ATC_CODE", label: "ATC코드" },
  { field: "ITEM_PERMIT_DATE", label: "허가일자" },
];

const DEVICE_FILTER_FIELDS: { field: string; label: string }[] = [
  { field: "MNFT_IPRT_ENTP_NM", label: "제조수입업체명" },
  { field: "UDIDI_CD", label: "UDI-DI코드" },
  { field: "MDEQ_CLSF_NO", label: "분류번호" },
  { field: "CLSF_NO_GRAD_CD", label: "등급" },
  { field: "PERMIT_NO", label: "품목허가번호" },
  { field: "FOML_INFO", label: "모델명" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MfdsSearchBarProps {
  tab: MfdsApiSource;
  onTabChange: (tab: MfdsApiSource) => void;
  query: string;
  onQueryChange: (q: string) => void;
  activeFilters: FilterChip[];
  onFiltersChange: (filters: FilterChip[]) => void;
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
  activeFilters,
  onFiltersChange,
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
  } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const filterInputRef = useRef<HTMLInputElement>(null);

  const filterFields =
    tab === "drug" ? DRUG_FILTER_FIELDS : DEVICE_FILTER_FIELDS;

  // Exclude already-active filter fields from the dropdown
  const activeFieldSet = new Set(activeFilters.map((f) => f.field));
  const availableFilterFields = filterFields.filter(
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
    (filterDef: { field: string; label: string }) => {
      setEditingFilter(filterDef);
      setEditingValue("");
      // Focus the input after render
      setTimeout(() => filterInputRef.current?.focus(), 0);
    },
    [],
  );

  const handleConfirmFilter = useCallback(() => {
    if (!editingFilter || !editingValue.trim()) {
      setEditingFilter(null);
      setEditingValue("");
      return;
    }
    const newChip: FilterChip = {
      field: editingFilter.field,
      label: editingFilter.label,
      value: editingValue.trim(),
    };
    onFiltersChange([...activeFilters, newChip]);
    setEditingFilter(null);
    setEditingValue("");
  }, [editingFilter, editingValue, activeFilters, onFiltersChange]);

  const handleCancelFilter = useCallback(() => {
    setEditingFilter(null);
    setEditingValue("");
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
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="품목명, 업체명, 코드로 검색..."
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
        {/* Active filters */}
        {activeFilters.map((chip) => (
          <Badge
            key={chip.field}
            variant="secondary"
            className="gap-1 pl-2.5 pr-1.5 py-1"
          >
            <span className="text-xs">
              {chip.label}:{chip.value}
            </span>
            <button
              type="button"
              onClick={() => handleRemoveFilter(chip.field)}
              className="text-muted-foreground hover:text-foreground ml-0.5 rounded-full"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}

        {/* Inline editing badge for new filter */}
        {editingFilter && (
          <Badge variant="outline" className="gap-1 py-0.5 pl-2.5 pr-1">
            <span className="text-xs font-medium">{editingFilter.label}:</span>
            <input
              ref={filterInputRef}
              type="text"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={handleFilterKeyDown}
              onBlur={handleConfirmFilter}
              className="h-5 w-24 border-none bg-transparent text-xs outline-none"
              placeholder="값 입력..."
            />
          </Badge>
        )}

        {/* Add filter dropdown */}
        {!editingFilter && availableFilterFields.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" className="text-muted-foreground gap-1">
                <Plus className="size-3" />
                필터 추가
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
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

"use client";

import { Fragment, useState } from "react";
import { flexRender, type Table as TanTable } from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { MfdsRowDetail } from "./mfds-row-detail";
import { MfdsMobileCard } from "./mfds-mobile-card";
import type { MfdsApiSource } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MfdsResultTableProps {
  table: TanTable<Record<string, unknown>>;
  tab: MfdsApiSource;
  expandedRowId: string | null;
  onExpandToggle: (rowId: string) => void;
  existingStandardCodes: string[];
  addingId: string | null;
  onAdd: (item: Record<string, unknown>) => void;
  isPending: boolean;
  isLoading: boolean;
  hasSearched: boolean;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getStandardCode(
  item: Record<string, unknown>,
  tab: MfdsApiSource,
): string {
  return ((tab === "drug" ? item.bar_code : item.udidi_cd) as string) ?? "";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MfdsResultTable({
  table,
  tab,
  expandedRowId,
  onExpandToggle,
  existingStandardCodes,
  addingId,
  onAdd,
  isPending,
  isLoading,
  hasSearched,
}: MfdsResultTableProps) {
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);

  // State 3: No search yet — render nothing
  if (!hasSearched) return null;

  // State 1: Loading
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const rows = table.getRowModel().rows;
  const hasData = table.getCoreRowModel().rows.length > 0;

  // State 2a: API returned 0 results
  if (!hasData) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-1">
        <p>검색 결과가 없습니다.</p>
        <p className="text-sm">다른 검색어를 시도하거나, 필터를 줄여보세요.</p>
      </div>
    );
  }

  // State 4: Has results — render table
  const headerGroups = table.getHeaderGroups();
  const totalColSpan = table.getVisibleLeafColumns().length;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      if (activeFilterCol) setActiveFilterCol(null);
      else if (expandedRowId) onExpandToggle(expandedRowId);
    }
  }

  return (
    <>
      {/* ── Mobile card list (< 768px) ─────────────────────── */}
      <div className="space-y-2 md:hidden" tabIndex={0} onKeyDown={handleKeyDown}>
        {rows.map((row) => {
          const item = row.original;
          const code = getStandardCode(item, tab);
          const isAdded = existingStandardCodes.includes(code);
          const isAdding = isPending && addingId === code;

          return (
            <MfdsMobileCard
              key={row.id}
              item={item}
              tab={tab}
              isExpanded={expandedRowId === row.id}
              onToggle={() => onExpandToggle(row.id)}
              isAdded={isAdded}
              isAdding={isAdding}
              onAdd={() => onAdd(item)}
            />
          );
        })}
      </div>

      {/* ── Desktop table (≥ 768px) ────────────────────────── */}
      <div className="border rounded-md overflow-hidden hidden md:block bg-card shadow-sm" tabIndex={0} onKeyDown={handleKeyDown}>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm table-fixed border-collapse">
            {/* ── Header ──────────────────────────────────────────── */}
            <thead className="bg-zinc-50/80 border-b sticky top-0 z-10 backdrop-blur-sm">
              {headerGroups.map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const isUtility =
                      header.id === "_action" || header.id === "_expand";
                    const isFiltered = !!header.column.getFilterValue();

                    return (
                      <th
                        key={header.id}
                        className={cn(
                          "relative px-3 py-2.5 text-left select-none font-semibold text-zinc-600 transition-colors",
                          header.column.getIsResizing() && "bg-zinc-100/50"
                        )}
                        style={{ width: header.getSize() }}
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between group">
                            <div
                              className={cn(
                                "flex items-center gap-1.5 cursor-pointer hover:text-zinc-900 transition-colors truncate",
                                header.column.getIsSorted() && "text-primary"
                              )}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <span className="truncate">
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                              </span>
                              <div className="flex-shrink-0">
                                {header.column.getIsSorted() === "asc" && (
                                  <ArrowUp className="h-3 w-3" />
                                )}
                                {header.column.getIsSorted() === "desc" && (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                                {header.column.getCanSort() && !header.column.getIsSorted() && (
                                  <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                                )}
                              </div>
                            </div>

                            {/* Filter Toggle Button */}
                            {!isUtility && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveFilterCol(activeFilterCol === header.id ? null : header.id);
                                }}
                                className={cn(
                                  "p-1 rounded hover:bg-zinc-200/50 transition-colors",
                                  (isFiltered || activeFilterCol === header.id) ? "text-primary" : "text-muted-foreground/40 opacity-0 group-hover:opacity-100"
                                )}
                              >
                                <Search className="h-3 w-3" />
                              </button>
                            )}
                          </div>

                          {/* Inline Filter Input */}
                          {!isUtility && (activeFilterCol === header.id || isFiltered) && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                              <Input
                                placeholder="검색..."
                                value={(header.column.getFilterValue() as string) ?? ""}
                                onChange={(e) => header.column.setFilterValue(e.target.value)}
                                className="h-7 text-[11px] px-2 bg-white/80 border-zinc-200"
                                autoFocus={activeFilterCol === header.id}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          )}
                        </div>

                        {/* Resize handle */}
                        {!isUtility && header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/40 transition-colors z-20",
                              header.column.getIsResizing() ? "bg-primary w-0.5" : "bg-zinc-200/50"
                            )}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            {/* ── Body ────────────────────────────────────────────── */}
            <tbody className="divide-y bg-white">
              {rows.map((row) => {
                const isExpanded = expandedRowId === row.id;
                const item = row.original;
                const code = getStandardCode(item, tab);
                const isAdded = existingStandardCodes.includes(code);
                const isAdding = isPending && addingId === code;

                return (
                  <Fragment key={row.id}>
                    {/* Data row */}
                    <tr
                      className={cn(
                        "hover:bg-zinc-50/50 cursor-pointer transition-colors group/row",
                        isExpanded && "bg-zinc-50"
                      )}
                      onClick={() => onExpandToggle(row.id)}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const isAction = cell.column.id === "_action";
                        return (
                          <td
                            key={cell.id}
                            className="px-3 py-2.5 transition-all overflow-hidden"
                            style={{ width: cell.column.getSize() }}
                            onClick={isAction ? (e) => e.stopPropagation() : undefined}
                          >
                            <div className="truncate">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <MfdsRowDetail
                        item={item}
                        tab={tab}
                        isAdded={isAdded}
                        isAdding={isAdding}
                        onAdd={() => onAdd(item)}
                        colSpan={totalColSpan}
                      />
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

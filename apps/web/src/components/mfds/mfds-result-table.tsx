"use client";

import { Fragment } from "react";
import { flexRender, type Table as TanTable } from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MfdsRowDetail } from "./mfds-row-detail";
import type { MfdsApiSource } from "@/lib/types";

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
  return ((tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string) ?? "";
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

  // State 2: Empty after search
  if (rows.length === 0) {
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

  return (
    <div className="border rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        {/* ── Header ──────────────────────────────────────────── */}
        <thead className="bg-muted/50">
          {headerGroups.map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isUtility =
                  header.id === "_action" || header.id === "_expand";

                return (
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
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getIsSorted() === "asc" && (
                        <ArrowUp className="h-3 w-3 flex-shrink-0" />
                      )}
                      {header.column.getIsSorted() === "desc" && (
                        <ArrowDown className="h-3 w-3 flex-shrink-0" />
                      )}
                      {header.column.getCanSort() &&
                        !header.column.getIsSorted() && (
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />
                        )}
                    </div>

                    {/* Resize handle (not for _action / _expand) */}
                    {!isUtility && header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-primary/50 ${
                          header.column.getIsResizing() ? "bg-primary" : ""
                        }`}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        {/* ── Body ────────────────────────────────────────────── */}
        <tbody className="divide-y">
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
                  className={`hover:bg-muted/30 cursor-pointer transition-colors ${
                    isExpanded ? "bg-muted/20" : ""
                  }`}
                  onClick={() => onExpandToggle(row.id)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isAction = cell.column.id === "_action";
                    return (
                      <td
                        key={cell.id}
                        className="px-3 py-2 whitespace-nowrap max-w-[300px] truncate"
                        style={{ width: cell.column.getSize() }}
                        onClick={
                          isAction
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
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
  );
}

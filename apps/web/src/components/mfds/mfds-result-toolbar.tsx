"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Filter, Settings2, X } from "lucide-react";
import type { Table } from "@tanstack/react-table";

// ─── Types ──────────────────────────────────────────────────────────

interface MfdsResultToolbarProps {
  totalCount: number;
  page: number;
  totalPages: number;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  filteredCount: number;
  table: Table<Record<string, unknown>>;
}

// ─── Component ──────────────────────────────────────────────────────

export function MfdsResultToolbar({
  totalCount,
  page,
  totalPages,
  globalFilter,
  onGlobalFilterChange,
  filteredCount,
  table,
}: MfdsResultToolbarProps) {
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
}

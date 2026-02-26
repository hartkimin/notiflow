"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type VisibilityState,
  type SortingState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Check, ChevronDown, ChevronRight } from "lucide-react";
import {
  searchMfdsDrug,
  searchMfdsDevice,
  addMfdsItemToProducts,
} from "@/lib/actions";
import { detectSearchFields, type FilterChip } from "@/lib/mfds-search-utils";
import { useRecentSearches } from "@/hooks/use-recent-searches";
import { MfdsSearchBar } from "@/components/mfds/mfds-search-bar";
import { MfdsResultToolbar } from "@/components/mfds/mfds-result-toolbar";
import { MfdsResultTable } from "@/components/mfds/mfds-result-table";
import { MfdsPagination } from "@/components/mfds/mfds-pagination";
import type { MfdsApiSource } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────

interface MfdsSearchPanelProps {
  mode: "browse" | "pick";
  onSelect?: (productId: number) => void;
  existingStandardCodes?: string[];
}

// ─── Component ──────────────────────────────────────────────────────

export function MfdsSearchPanel({
  mode,
  onSelect,
  existingStandardCodes = [],
}: MfdsSearchPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const recentSearches = useRecentSearches();

  // Search state
  const [tab, setTab] = useState<MfdsApiSource>("drug");
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  // Results state
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});

  // Accordion + action state
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const pageSize = 25;
  const totalPages = Math.ceil(totalCount / pageSize);

  // ── Column definitions ────────────────────────────────────────────

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const expandCol: ColumnDef<Record<string, unknown>> = {
      id: "_expand",
      header: "",
      size: 40,
      enableResizing: false,
      enableSorting: false,
      enableGlobalFilter: false,
      cell: ({ row }) =>
        expandedRowId === row.id ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ),
    };

    const actionCol: ColumnDef<Record<string, unknown>> = {
      id: "_action",
      header: mode === "browse" ? "추가" : "선택",
      size: 70,
      enableResizing: false,
      enableSorting: false,
      enableGlobalFilter: false,
      cell: ({ row }) => {
        const item = row.original;
        const code =
          ((tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string) ?? "";
        const alreadyAdded = existingStandardCodes.includes(code);

        if (alreadyAdded) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="h-3 w-3" /> 추가됨
            </span>
          );
        }
        return (
          <Button
            size="xs"
            variant="outline"
            disabled={isPending && addingId === code}
            onClick={() => handleAdd(item)}
          >
            {isPending && addingId === code ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </Button>
        );
      },
    };

    const drugDataCols: ColumnDef<Record<string, unknown>>[] = [
      { id: "ITEM_NAME", accessorFn: (r) => (r.ITEM_NAME as string) ?? "", header: "품목명", size: 200, minSize: 60, enableResizing: true },
      { id: "ENTP_NAME", accessorFn: (r) => (r.ENTP_NAME as string) ?? "", header: "업체명", size: 200, minSize: 60, enableResizing: true },
      { id: "ETC_OTC_CODE", accessorFn: (r) => (r.ETC_OTC_CODE as string) ?? "", header: "전문/일반", size: 120, minSize: 60, enableResizing: true },
      { id: "BAR_CODE", accessorFn: (r) => (r.BAR_CODE as string) ?? "", header: "표준코드", size: 120, minSize: 60, enableResizing: true },
      { id: "EDI_CODE", accessorFn: (r) => (r.EDI_CODE as string) ?? "", header: "보험코드", size: 120, minSize: 60, enableResizing: true },
      { id: "ITEM_PERMIT_DATE", accessorFn: (r) => (r.ITEM_PERMIT_DATE as string) ?? "", header: "허가일자", size: 120, minSize: 60, enableResizing: true },
      { id: "MATERIAL_NAME", accessorFn: (r) => (r.MATERIAL_NAME as string) ?? "", header: "성분", size: 120, minSize: 60, enableResizing: true },
      { id: "CANCEL_NAME", accessorFn: (r) => (r.CANCEL_NAME as string) ?? "", header: "상태", size: 120, minSize: 60, enableResizing: true },
    ];

    const deviceDataCols: ColumnDef<Record<string, unknown>>[] = [
      { id: "PRDLST_NM", accessorFn: (r) => (r.PRDLST_NM as string) ?? "", header: "품목명", size: 200, minSize: 60, enableResizing: true },
      { id: "MNFT_IPRT_ENTP_NM", accessorFn: (r) => (r.MNFT_IPRT_ENTP_NM as string) ?? "", header: "제조수입업체명", size: 200, minSize: 60, enableResizing: true },
      { id: "CLSF_NO_GRAD_CD", accessorFn: (r) => (r.CLSF_NO_GRAD_CD as string) ?? "", header: "등급", size: 120, minSize: 60, enableResizing: true },
      { id: "UDIDI_CD", accessorFn: (r) => (r.UDIDI_CD as string) ?? "", header: "UDI-DI코드", size: 120, minSize: 60, enableResizing: true },
      { id: "PERMIT_NO", accessorFn: (r) => (r.PERMIT_NO as string) ?? "", header: "품목허가번호", size: 120, minSize: 60, enableResizing: true },
      { id: "PRMSN_YMD", accessorFn: (r) => (r.PRMSN_YMD as string) ?? "", header: "허가일자", size: 120, minSize: 60, enableResizing: true },
      { id: "FOML_INFO", accessorFn: (r) => (r.FOML_INFO as string) ?? "", header: "모델명", size: 120, minSize: 60, enableResizing: true },
      { id: "DSPSBL_MDEQ_YN", accessorFn: (r) => (r.DSPSBL_MDEQ_YN as string) ?? "", header: "일회용여부", size: 120, minSize: 60, enableResizing: true },
    ];

    const dataCols = tab === "drug" ? drugDataCols : deviceDataCols;
    return [expandCol, ...dataCols, actionCol];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mode, existingStandardCodes, isPending, addingId, expandedRowId]);

  // ── Table instance ────────────────────────────────────────────────

  const table = useReactTable({
    data: results,
    columns,
    state: { sorting, columnVisibility, globalFilter, columnSizing },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  // ── Search logic (smart detection + fallback retry) ───────────────

  function doSearch(targetPage = 1) {
    const q = query.trim();
    if (!q && activeFilters.length === 0) {
      toast.error("검색어를 1개 이상 입력해주세요.");
      return;
    }

    startTransition(async () => {
      setIsLoading(true);
      try {
        // Build chip-based filters
        const chipFilters: Record<string, string> = {};
        for (const chip of activeFilters) {
          chipFilters[chip.field] = chip.value;
        }

        // Merge smart detection with chip filters
        const detected = q ? detectSearchFields(q, tab) : { primary: {}, fallback: null };
        const mergedPrimary = { ...detected.primary, ...chipFilters };

        const searchFn = tab === "drug" ? searchMfdsDrug : searchMfdsDevice;
        let result = await searchFn(mergedPrimary, targetPage);

        // Fallback retry if primary yields 0 results
        if (result.totalCount === 0 && detected.fallback) {
          const mergedFallback = { ...detected.fallback, ...chipFilters };
          result = await searchFn(mergedFallback, targetPage);
        }

        setResults(result.items as Record<string, unknown>[]);
        setTotalCount(result.totalCount);
        setPage(targetPage);
        setHasSearched(true);
        setExpandedRowId(null);

        // Add to recent searches
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
  }

  // ── Add handler ───────────────────────────────────────────────────

  function handleAdd(item: Record<string, unknown>) {
    const code =
      ((tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string) ?? "";
    setAddingId(code);
    startTransition(async () => {
      try {
        const result = await addMfdsItemToProducts(item, tab);
        if (result.alreadyExists) {
          toast.info("이미 내 품목에 등록된 항목입니다.");
        } else {
          toast.success("내 품목에 추가되었습니다.", {
            action: {
              label: "내 품목 보기 →",
              onClick: () => router.push("/products/my"),
            },
          });
        }
        if (mode === "pick" && onSelect) {
          onSelect(result.id);
        }
        router.refresh();
      } catch (err) {
        toast.error(
          `추가 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
        );
      } finally {
        setAddingId(null);
      }
    });
  }

  // ── Tab change ────────────────────────────────────────────────────

  function handleTabChange(newTab: MfdsApiSource) {
    setTab(newTab);
    // Keep query, reset everything else
    setActiveFilters([]);
    setResults([]);
    setTotalCount(0);
    setPage(1);
    setHasSearched(false);
    setSorting([]);
    setColumnVisibility({});
    setGlobalFilter("");
    setColumnSizing({});
    setExpandedRowId(null);
  }

  // ── Recent search click ───────────────────────────────────────────

  function handleRecentClick(item: { query: string; tab: string }) {
    setQuery(item.query);
    if (item.tab !== tab) {
      handleTabChange(item.tab as MfdsApiSource);
    }
    // Trigger search after state update via setTimeout
    setTimeout(() => doSearch(1), 0);
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Search bar with tabs, query, filter chips, recent searches */}
      <MfdsSearchBar
        tab={tab}
        onTabChange={handleTabChange}
        query={query}
        onQueryChange={setQuery}
        activeFilters={activeFilters}
        onFiltersChange={setActiveFilters}
        onSearch={() => doSearch(1)}
        isPending={isPending}
        recentSearches={recentSearches.items}
        onRecentClick={handleRecentClick}
        hasSearched={hasSearched}
      />

      {/* Result toolbar (summary, global filter, column toggle) */}
      {hasSearched && results.length > 0 && (
        <MfdsResultToolbar
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          filteredCount={table.getFilteredRowModel().rows.length}
          table={table}
        />
      )}

      {/* Result table with accordion expand + action buttons */}
      <MfdsResultTable
        table={table}
        tab={tab}
        expandedRowId={expandedRowId}
        onExpandToggle={(rowId) =>
          setExpandedRowId(expandedRowId === rowId ? null : rowId)
        }
        existingStandardCodes={existingStandardCodes}
        addingId={addingId}
        onAdd={handleAdd}
        isPending={isPending}
        isLoading={isLoading}
        hasSearched={hasSearched}
        globalFilter={globalFilter}
        onGlobalFilterReset={() => setGlobalFilter("")}
      />

      {/* Pagination */}
      <MfdsPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        isPending={isPending}
        onPageChange={(p) => doSearch(p)}
      />
    </div>
  );
}

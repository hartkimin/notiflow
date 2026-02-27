"use client";

import { useState, useMemo, useTransition, useEffect, useRef, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Loader2, Check, ChevronDown, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import {
  searchMfdsDrug,
  searchMfdsDevice,
  addToMyDrugs,
  addToMyDevices,
  syncMyDrug,
  syncMyDevice,
  applyDrugSync,
  applyDeviceSync,
  deleteMyDrug,
  deleteMyDevice,
} from "@/lib/actions";
import { getFallbackFields, type FilterChip } from "@/lib/mfds-search-utils";
import { useRecentSearches } from "@/hooks/use-recent-searches";
import { MfdsSearchBar } from "@/components/mfds/mfds-search-bar";
import { MfdsResultToolbar } from "@/components/mfds/mfds-result-toolbar";
import { MfdsResultTable } from "@/components/mfds/mfds-result-table";
import { MfdsPagination } from "@/components/mfds/mfds-pagination";
import type { MfdsApiSource, SyncDiffEntry } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────

interface MfdsSearchPanelProps {
  mode: "browse" | "pick" | "manage";
  onSelect?: (productId: number) => void;
  existingStandardCodes?: string[];
  myDrugs?: Record<string, unknown>[];
  myDevices?: Record<string, unknown>[];
}

// ─── Component ──────────────────────────────────────────────────────

export function MfdsSearchPanel({
  mode,
  onSelect,
  existingStandardCodes = [],
  myDrugs,
  myDevices,
}: MfdsSearchPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const recentSearches = useRecentSearches();

  // Search state
  const [tab, setTab] = useState<MfdsApiSource>("drug");
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [searchField, setSearchField] = useState<string>("_all");
  const [filterLogic, setFilterLogic] = useState<"and" | "or">("and");

  // Results state
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Columns hidden by default (toggle-able via column settings)
  const DRUG_HIDDEN = ["ITEM_SEQ", "ITEM_ENG_NAME", "ENTP_NO", "CNSGN_MANUF", "CHART", "STORAGE_METHOD", "VALID_TERM", "PACK_UNIT", "EE_DOC_ID", "UD_DOC_ID", "NB_DOC_ID", "PERMIT_KIND_NAME", "CANCEL_DATE", "CHANGE_DATE", "ATC_CODE", "RARE_DRUG_YN"];
  const DEVICE_HIDDEN = ["PRDT_NM_INFO", "MDEQ_CLSF_NO", "USE_PURPS_CONT", "HMBD_TRSPT_MDEQ_YN", "TRCK_MNG_TRGT_YN", "TOTAL_DEV", "CMBNMD_YN", "RCPRSLRY_TRGT_YN", "USE_BEFORE_STRLZT_NEED_YN", "STERILIZATION_METHOD_NM", "STRG_CND_INFO", "CIRC_CND_INFO"];

  function getDefaultVisibility(source: MfdsApiSource): VisibilityState {
    const hidden = source === "drug" ? DRUG_HIDDEN : DEVICE_HIDDEN;
    return Object.fromEntries(hidden.map((id) => [id, false]));
  }

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => getDefaultVisibility("drug"));
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});

  // Accordion + action state
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Sync state (manage mode only)
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [syncDiff, setSyncDiff] = useState<{ id: number; changes: SyncDiffEntry[] } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
      header: mode === "manage" ? "동기화" : mode === "browse" ? "추가" : "선택",
      size: mode === "manage" ? 110 : 70,
      enableResizing: false,
      enableSorting: false,
      enableGlobalFilter: false,
      cell: ({ row }) => {
        const item = row.original;

        if (mode === "manage") {
          const itemId = item.id as number;
          const isSyncing = syncingId === itemId;
          return (
            <div className="flex gap-1">
              <Button
                size="xs"
                variant="outline"
                disabled={isSyncing}
                onClick={(e) => { e.stopPropagation(); handleSync(item); }}
              >
                {isSyncing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={deletingId === itemId}
                onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        }

        const code = ((tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string) ?? "";
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

    const col = (id: string, header: string, size = 120): ColumnDef<Record<string, unknown>> => ({
      id,
      accessorFn: (r) => (r[id] as string) ?? "",
      header,
      size,
      minSize: 60,
      enableResizing: true,
    });

    // 의약품: 기본 8개 + 추가 16개 = 전체 24개
    const drugDataCols: ColumnDef<Record<string, unknown>>[] = [
      // ── 기본 노출 ──
      col("ITEM_NAME", "품목명", 200),
      col("ENTP_NAME", "업체명", 200),
      col("ETC_OTC_CODE", "전문/일반"),
      col("BAR_CODE", "표준코드"),
      col("EDI_CODE", "보험코드"),
      col("ITEM_PERMIT_DATE", "허가일자"),
      col("MATERIAL_NAME", "성분"),
      col("CANCEL_NAME", "상태"),
      // ── 기본 숨김 (컬럼설정에서 켤 수 있음) ──
      col("ITEM_SEQ", "품목기준코드"),
      col("ITEM_ENG_NAME", "영문명", 200),
      col("ENTP_NO", "업체허가번호"),
      col("CNSGN_MANUF", "위탁제조업체", 160),
      col("CHART", "성상", 160),
      col("STORAGE_METHOD", "저장방법", 160),
      col("VALID_TERM", "유효기간"),
      col("PACK_UNIT", "포장단위"),
      col("EE_DOC_ID", "효능효과", 200),
      col("UD_DOC_ID", "용법용량", 200),
      col("NB_DOC_ID", "주의사항", 200),
      col("PERMIT_KIND_NAME", "허가구분"),
      col("CANCEL_DATE", "취소일자"),
      col("CHANGE_DATE", "변경일자"),
      col("ATC_CODE", "ATC코드"),
      col("RARE_DRUG_YN", "희귀의약품"),
    ];

    // 의료기기: 기본 8개 + 추가 12개 = 전체 20개
    const deviceDataCols: ColumnDef<Record<string, unknown>>[] = [
      // ── 기본 노출 ──
      col("PRDLST_NM", "품목명", 200),
      col("MNFT_IPRT_ENTP_NM", "제조수입업체명", 200),
      col("CLSF_NO_GRAD_CD", "등급"),
      col("UDIDI_CD", "UDI-DI코드"),
      col("PERMIT_NO", "품목허가번호"),
      col("PRMSN_YMD", "허가일자"),
      col("FOML_INFO", "모델명"),
      col("DSPSBL_MDEQ_YN", "일회용여부"),
      // ── 기본 숨김 (컬럼설정에서 켤 수 있음) ──
      col("PRDT_NM_INFO", "제품명", 200),
      col("MDEQ_CLSF_NO", "분류번호"),
      col("USE_PURPS_CONT", "사용목적", 200),
      col("HMBD_TRSPT_MDEQ_YN", "인체이식형여부"),
      col("TRCK_MNG_TRGT_YN", "추적관리대상"),
      col("TOTAL_DEV", "한벌구성여부"),
      col("CMBNMD_YN", "조합의료기기"),
      col("RCPRSLRY_TRGT_YN", "요양급여대상"),
      col("USE_BEFORE_STRLZT_NEED_YN", "사전멸균필요"),
      col("STERILIZATION_METHOD_NM", "멸균방법", 160),
      col("STRG_CND_INFO", "저장조건", 160),
      col("CIRC_CND_INFO", "유통취급조건", 160),
    ];

    const dataCols = tab === "drug" ? drugDataCols : deviceDataCols;
    return [expandCol, ...dataCols, actionCol];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mode, existingStandardCodes, isPending, addingId, expandedRowId, syncingId, deletingId]);

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

  // ── Initial load ────────────────────────────────────────────────
  const initialLoaded = useRef(false);
  useEffect(() => {
    if (mode === "manage") return;
    if (!initialLoaded.current) {
      initialLoaded.current = true;
      doSearch(1);
    }
  }, [doSearch, mode]);

  // ── Manage mode: load data from DB props ──────────────────────────
  useEffect(() => {
    if (mode !== "manage") return;
    const data = tab === "drug" ? (myDrugs ?? []) : (myDevices ?? []);
    setResults(data);
    setTotalCount(data.length);
    setHasSearched(true);
  }, [mode, tab, myDrugs, myDevices]);

  // ── Add handler ───────────────────────────────────────────────────

  function handleAdd(item: Record<string, unknown>) {
    const code = ((tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string) ?? "";
    setAddingId(code);
    startTransition(async () => {
      try {
        const result = tab === "drug"
          ? await addToMyDrugs(item)
          : await addToMyDevices(item);
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
        toast.error(`추가 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      } finally {
        setAddingId(null);
      }
    });
  }

  // ── Sync handler (manage mode) ───────────────────────────────────

  function handleSync(item: Record<string, unknown>) {
    const itemId = item.id as number;
    setSyncingId(itemId);
    startTransition(async () => {
      try {
        const result = tab === "drug"
          ? await syncMyDrug(itemId)
          : await syncMyDevice(itemId);

        if (!result.found) {
          toast.error("식약처 API에서 해당 품목을 찾을 수 없습니다.");
          return;
        }

        if (result.changes.length === 0) {
          toast.success("최신 상태입니다.");
        } else {
          setSyncDiff({ id: itemId, changes: result.changes });
        }
      } catch (err) {
        toast.error(`동기화 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      } finally {
        setSyncingId(null);
      }
    });
  }

  function handleApplySync() {
    if (!syncDiff) return;
    startTransition(async () => {
      try {
        const updates: Record<string, string> = {};
        for (const c of syncDiff.changes) {
          updates[c.column] = c.newValue;
        }
        if (tab === "drug") {
          await applyDrugSync(syncDiff.id, updates);
        } else {
          await applyDeviceSync(syncDiff.id, updates);
        }
        toast.success("변경사항이 적용되었습니다.");
        setSyncDiff(null);
        router.refresh();
      } catch (err) {
        toast.error(`적용 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      }
    });
  }

  function handleDelete(item: Record<string, unknown>) {
    const itemId = item.id as number;
    const name = tab === "drug"
      ? (item.ITEM_NAME as string) ?? (item.item_name as string) ?? ""
      : (item.PRDLST_NM as string) ?? (item.prdlst_nm as string) ?? "";

    if (!confirm(`"${name}" 항목을 삭제하시겠습니까?`)) return;

    setDeletingId(itemId);
    startTransition(async () => {
      try {
        if (tab === "drug") {
          await deleteMyDrug(itemId);
        } else {
          await deleteMyDevice(itemId);
        }
        toast.success("삭제되었습니다.");
        router.refresh();
      } catch (err) {
        toast.error(`삭제 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      } finally {
        setDeletingId(null);
      }
    });
  }

  // ── Tab change ────────────────────────────────────────────────────

  function handleTabChange(newTab: MfdsApiSource) {
    setTab(newTab);
    // Keep query, reset everything else
    setActiveFilters([]);
    setSearchField("_all");
    setFilterLogic("and");
    setResults([]);
    setTotalCount(0);
    setPage(1);
    setSorting([]);
    setColumnVisibility(getDefaultVisibility(newTab));
    setGlobalFilter("");
    setColumnSizing({});
    setExpandedRowId(null);
  }

  // Re-fetch when tab changes (doSearch picks up the new tab via dependency)
  const prevTab = useRef(tab);
  useEffect(() => {
    if (prevTab.current !== tab) {
      prevTab.current = tab;
      doSearch(1);
    }
  }, [tab, doSearch]);

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
      {mode !== "manage" && (
        <MfdsPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          isPending={isPending}
          onPageChange={(p) => doSearch(p)}
        />
      )}

      {/* Sync diff dialog */}
      {syncDiff && (
        <Dialog open onOpenChange={() => setSyncDiff(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>품목 변경사항 확인</DialogTitle>
            </DialogHeader>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 font-medium">항목</th>
                    <th className="py-2 pr-3 font-medium">현재값</th>
                    <th className="py-2 font-medium">새 값</th>
                  </tr>
                </thead>
                <tbody>
                  {syncDiff.changes.map((c) => (
                    <tr key={c.column} className="border-b">
                      <td className="py-2 pr-3 text-muted-foreground">{c.label}</td>
                      <td className="py-2 pr-3 line-through text-red-500 break-all">
                        {c.oldValue || "(비어있음)"}
                      </td>
                      <td className="py-2 text-green-600 break-all">
                        {c.newValue || "(비어있음)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSyncDiff(null)}>
                취소
              </Button>
              <Button onClick={handleApplySync} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                적용
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

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
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Loader2, Check, ChevronDown, ChevronRight, RefreshCw, Trash2, Database, Square, PenLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  searchMfdsItems,
  searchMyItems,
  addToMyDrugs,
  addToMyDevices,
  syncMyDrug,
  syncMyDevice,
  applyDrugSync,
  applyDeviceSync,
  deleteMyDrug,
  deleteMyDevice,
  updateMyDrugPrice,
  updateMyDevicePrice,
} from "@/lib/actions";
import { type FilterChip } from "@/lib/mfds-search-utils";
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
  syncStatus?: {
    lastSync: string | null;
    drugCount: number;
    drugApiCount: number | null;
    deviceCount: number;
    deviceApiCount: number | null;
  };
}

// ─── Component ──────────────────────────────────────────────────────

export function MfdsSearchPanel({
  mode,
  onSelect,
  existingStandardCodes = [],
  myDrugs: _myDrugs,
  myDevices: _myDevices,
  syncStatus,
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
  const DRUG_HIDDEN = ["item_seq", "item_eng_name", "entp_no", "cnsgn_manuf", "chart", "storage_method", "valid_term", "pack_unit", "ee_doc_id", "ud_doc_id", "nb_doc_id", "permit_kind_name", "cancel_date", "change_date", "atc_code", "rare_drug_yn"];
  const DEVICE_HIDDEN = ["prdt_nm_info", "mdeq_clsf_no", "use_purps_cont", "hmbd_trspt_mdeq_yn", "trck_mng_trgt_yn", "total_dev", "cmbnmd_yn", "rcprslry_trgt_yn", "use_before_strlzt_need_yn", "sterilization_method_nm", "strg_cnd_info", "circ_cnd_info"];

  function getDefaultVisibility(source: MfdsApiSource): VisibilityState {
    const hidden = source === "drug" ? DRUG_HIDDEN : DEVICE_HIDDEN;
    return Object.fromEntries(hidden.map((id) => [id, false]));
  }

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => getDefaultVisibility("drug"));
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});

  // Accordion + action state
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Sync state (manage mode only)
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [syncDiff, setSyncDiff] = useState<{ id: number; changes: SyncDiffEntry[] } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // MFDS sync state (browse mode)
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [syncLogId, setSyncLogId] = useState<number | null>(null);

  // Debounce refs
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Price editing state (manage mode only)
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>("");

  // Manual add state (manage mode only)
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualForm, setManualForm] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);

  interface DrugField { key: string; label: string; required?: boolean; type?: FieldType; options?: string[]; group: string; placeholder?: string }

  const DRUG_FIELDS_GROUPED: DrugField[] = [
    // 기본 정보
    { key: "item_name", label: "품목명", required: true, group: "기본 정보", placeholder: "예: 헤파린나트륨주사액" },
    { key: "entp_name", label: "업체명", group: "기본 정보", placeholder: "예: ㈜대한제약" },
    { key: "item_eng_name", label: "영문 품목명", group: "기본 정보" },
    { key: "chart", label: "성상(외형)", group: "기본 정보" },
    { key: "material_name", label: "원료성분명", group: "기본 정보" },
    // 코드/허가
    { key: "bar_code", label: "표준코드(바코드)", group: "코드/허가", placeholder: "예: 8806541234567" },
    { key: "edi_code", label: "보험코드(EDI)", group: "코드/허가" },
    { key: "atc_code", label: "ATC 코드", group: "코드/허가" },
    { key: "item_seq", label: "품목기준코드", group: "코드/허가" },
    { key: "entp_no", label: "업체허가번호", group: "코드/허가" },
    { key: "item_permit_date", label: "허가일자", group: "코드/허가", placeholder: "YYYYMMDD" },
    { key: "permit_kind_name", label: "허가종류", group: "코드/허가" },
    // 보관/포장
    { key: "storage_method", label: "저장방법", group: "보관/포장" },
    { key: "valid_term", label: "유효기간", group: "보관/포장" },
    { key: "pack_unit", label: "포장단위", group: "보관/포장", placeholder: "예: 10앰플/갑" },
    // 분류
    { key: "etc_otc_code", label: "전문/일반", type: "select", options: ["전문의약품", "일반의약품"], group: "분류" },
    { key: "rare_drug_yn", label: "희귀의약품", type: "yn", group: "분류" },
    { key: "cnsgn_manuf", label: "위탁제조업체", group: "분류" },
    // 변경/취소 이력
    { key: "cancel_date", label: "취소일자", group: "변경 이력", placeholder: "YYYYMMDD" },
    { key: "cancel_name", label: "취소명", group: "변경 이력" },
    { key: "change_date", label: "변경일자", group: "변경 이력", placeholder: "YYYYMMDD" },
  ];

  const DRUG_FIELDS = DRUG_FIELDS_GROUPED.map(({ key, label, required }) => ({ key, label, required }));

  type FieldType = "text" | "select" | "yn";
  interface DeviceField { key: string; label: string; required?: boolean; type?: FieldType; options?: string[]; group: string; placeholder?: string }

  const DEVICE_FIELDS_GROUPED: DeviceField[] = [
    // 기본 정보
    { key: "prdlst_nm", label: "품목명", required: true, group: "기본 정보", placeholder: "예: 혈액투석용 필터세트" },
    { key: "mnft_iprt_entp_nm", label: "제조/수입업체", group: "기본 정보", placeholder: "예: ㈜한국메디컬" },
    { key: "foml_info", label: "모델명", group: "기본 정보", placeholder: "예: HD-2000F" },
    { key: "prdt_nm_info", label: "제품명 상세", group: "기본 정보" },
    // 허가/코드
    { key: "udidi_cd", label: "UDI-DI 코드", group: "허가/코드", placeholder: "예: 08806541234567" },
    { key: "permit_no", label: "품목허가번호", group: "허가/코드" },
    { key: "mdeq_clsf_no", label: "품목분류번호", group: "허가/코드" },
    { key: "clsf_no_grad_cd", label: "등급", type: "select", options: ["1", "2", "3", "4"], group: "허가/코드" },
    { key: "prmsn_ymd", label: "허가일자", group: "허가/코드", placeholder: "YYYYMMDD" },
    // 사용/보관
    { key: "use_purps_cont", label: "사용목적", group: "사용/보관" },
    { key: "sterilization_method_nm", label: "멸균방법", group: "사용/보관" },
    { key: "strg_cnd_info", label: "저장조건", group: "사용/보관" },
    { key: "circ_cnd_info", label: "유통조건", group: "사용/보관" },
    // 속성
    { key: "hmbd_trspt_mdeq_yn", label: "체외진단", type: "yn", group: "속성" },
    { key: "dspsbl_mdeq_yn", label: "일회용", type: "yn", group: "속성" },
    { key: "trck_mng_trgt_yn", label: "추적관리 대상", type: "yn", group: "속성" },
    { key: "cmbnmd_yn", label: "조합의료기기", type: "yn", group: "속성" },
    { key: "use_before_strlzt_need_yn", label: "사용전 멸균", type: "yn", group: "속성" },
    { key: "rcprslry_trgt_yn", label: "수리부속 대상", type: "yn", group: "속성" },
    { key: "total_dev", label: "총 기기수", group: "속성", placeholder: "숫자" },
  ];

  // Flat version for backward compat
  const DEVICE_FIELDS = DEVICE_FIELDS_GROUPED.map(({ key, label, required }) => ({ key, label, required }));

  const [addAnother, setAddAnother] = useState(false);

  const handleManualAdd = async () => {
    const nameField = tab === "drug" ? "item_name" : "prdlst_nm";
    if (!manualForm[nameField]?.trim()) {
      toast.error("품목명은 필수입니다");
      return;
    }
    setIsAdding(true);
    try {
      const result = tab === "drug"
        ? await addToMyDrugs(manualForm)
        : await addToMyDevices(manualForm);
      if (result.alreadyExists) {
        toast.info("이미 등록된 품목입니다");
      } else if (result.success) {
        toast.success(`"${manualForm[nameField]}" 추가됨`);
        if (addAnother) {
          setManualForm({});
        } else {
          setShowManualAdd(false);
          setManualForm({});
        }
        doSearch(1);
      } else {
        toast.error("추가에 실패했습니다");
      }
    } catch {
      toast.error("추가 중 오류가 발생했습니다");
    } finally {
      setIsAdding(false);
    }
  };

  const pageSize = 15;
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

        const code = ((tab === "drug" ? item.bar_code : item.udidi_cd) as string) ?? "";
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
      col("item_name", "품목명", 200),
      col("entp_name", "업체명", 200),
      col("etc_otc_code", "전문/일반"),
      col("bar_code", "표준코드"),
      col("edi_code", "보험코드"),
      col("item_permit_date", "허가일자"),
      col("material_name", "성분"),
      col("cancel_name", "상태"),
      // ── 기본 숨김 (컬럼설정에서 켤 수 있음) ──
      col("item_seq", "품목기준코드"),
      col("item_eng_name", "영문명", 200),
      col("entp_no", "업체허가번호"),
      col("cnsgn_manuf", "위탁제조업체", 160),
      col("chart", "성상", 160),
      col("storage_method", "저장방법", 160),
      col("valid_term", "유효기간"),
      col("pack_unit", "포장단위"),
      col("ee_doc_id", "효능효과", 200),
      col("ud_doc_id", "용법용량", 200),
      col("nb_doc_id", "주의사항", 200),
      col("permit_kind_name", "허가구분"),
      col("cancel_date", "취소일자"),
      col("change_date", "변경일자"),
      col("atc_code", "ATC코드"),
      col("rare_drug_yn", "희귀의약품"),
    ];

    // 의료기기: 기본 8개 + 추가 12개 = 전체 20개
    const deviceDataCols: ColumnDef<Record<string, unknown>>[] = [
      // ── 기본 노출 ──
      col("prdlst_nm", "품목명", 200),
      col("mnft_iprt_entp_nm", "제조수입업체명", 200),
      col("clsf_no_grad_cd", "등급"),
      col("udidi_cd", "UDI-DI코드"),
      col("permit_no", "품목허가번호"),
      col("prmsn_ymd", "허가일자"),
      col("foml_info", "모델명"),
      col("dspsbl_mdeq_yn", "일회용여부"),
      // ── 기본 숨김 (컬럼설정에서 켤 수 있음) ──
      col("prdt_nm_info", "제품명", 200),
      col("mdeq_clsf_no", "분류번호"),
      col("use_purps_cont", "사용목적", 200),
      col("hmbd_trspt_mdeq_yn", "인체이식형여부"),
      col("trck_mng_trgt_yn", "추적관리대상"),
      col("total_dev", "한벌구성여부"),
      col("cmbnmd_yn", "조합의료기기"),
      col("rcprslry_trgt_yn", "요양급여대상"),
      col("use_before_strlzt_need_yn", "사전멸균필요"),
      col("sterilization_method_nm", "멸균방법", 160),
      col("strg_cnd_info", "저장조건", 160),
      col("circ_cnd_info", "유통취급조건", 160),
    ];

    const priceCol: ColumnDef<Record<string, unknown>> = {
      id: "_price",
      header: "가격",
      size: 100,
      enableResizing: false,
      enableSorting: true,
      enableGlobalFilter: false,
      accessorFn: (r) => (r.unit_price as number) ?? null,
      cell: ({ row }) => {
        const item = row.original;
        const itemId = item.id as number;
        const currentPrice = item.unit_price as number | null;
        const isEditing = editingPriceId === itemId;

        if (isEditing) {
          return (
            <input
              type="number"
              className="w-20 rounded border border-primary px-1.5 py-0.5 text-xs ring-1 ring-primary/30"
              autoFocus
              placeholder="가격 입력"
              value={editingPriceValue}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setEditingPriceValue(e.target.value)}
              onBlur={() => handlePriceSave(itemId)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePriceSave(itemId);
                if (e.key === "Escape") setEditingPriceId(null);
              }}
            />
          );
        }

        return (
          <span
            className="cursor-pointer rounded px-1.5 py-0.5 text-xs hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              setEditingPriceId(itemId);
              setEditingPriceValue(currentPrice != null ? String(currentPrice) : "");
            }}
          >
            {currentPrice != null ? `₩${currentPrice.toLocaleString()}` : <span className="text-muted-foreground/50">클릭하여 입력</span>}
          </span>
        );
      },
    };

    const dataCols = tab === "drug" ? drugDataCols : deviceDataCols;
    if (mode === "manage") {
      return [expandCol, ...dataCols, priceCol, actionCol];
    }
    return [expandCol, ...dataCols, actionCol];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mode, existingStandardCodes, isPending, addingId, expandedRowId, syncingId, deletingId, editingPriceId, editingPriceValue]);

  // ── Table instance ────────────────────────────────────────────────

  const table = useReactTable({
    data: results,
    columns,
    state: { sorting, columnVisibility, globalFilter, columnSizing, columnFilters },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  // ── Search logic (DB-backed with debounce) ────────────────────────

  const doSearch = useCallback(
    (targetPage = 1) => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      startTransition(async () => {
        setIsLoading(true);
        try {
          const q = query.trim();

          const searchFn = mode === "manage" ? searchMyItems : searchMfdsItems;

          const result = await searchFn({
            query: q,
            sourceType: tab,
            searchField,
            page: targetPage,
            pageSize,
            filters: activeFilters,
          });

          if (!abortControllerRef.current?.signal.aborted) {
            setResults(result.items as Record<string, unknown>[]);
            setTotalCount(result.totalCount);
            setPage(targetPage);
            setHasSearched(true);
            setExpandedRowId(null);

            if (q && mode !== "manage") {
              recentSearches.add(q, tab);
            }
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
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
    [query, activeFilters, tab, searchField, mode],
  );

  // ── Debounced auto-search on query change ─────────────────────────
  useEffect(() => {
    if (!hasSearched && !query.trim() && mode !== "manage") return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      doSearch(1);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeFilters]);

  // ── Initial load ────────────────────────────────────────────────
  const initialLoaded = useRef(false);
  useEffect(() => {
    if (mode === "manage") return;
    if (!initialLoaded.current) {
      initialLoaded.current = true;
      doSearch(1);
    }
  }, [doSearch, mode]);

  // ── Manage mode: load data via doSearch ──────────────────────────
  useEffect(() => {
    if (mode === "manage") {
      doSearch(1);
    }
  }, [mode, tab, doSearch]);

  // ── Poll sync progress ─────────────────────────────────────────
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((logId: number) => {
    stopPolling();
    let lastSearchRefresh = 0;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/sync-mfds/status");
        const data = await r.json();
        const a = data.active;

        if (!a || a.id !== logId || !["running"].includes(a.status)) {
          // Sync finished (completed, cancelled, error, or gone)
          stopPolling();
          setIsSyncing(false);
          setSyncLogId(null);

          if (!a || a.status === "completed" || a.id !== logId) {
            setSyncProgress(null);
            doSearch(1);
            toast.success("동기화가 완료되었습니다.");
          } else if (a.status === "cancelled") {
            setSyncProgress(null);
            toast.info("동기화가 중지되었습니다.");
          } else if (a.status === "error") {
            setSyncProgress(null);
            toast.error(`동기화 실패: ${a.error_message ?? "알 수 없는 오류"}`);
          } else if (a.status === "partial") {
            const pct = a.api_total_count ? ` (${((a.total_fetched / a.api_total_count) * 100).toFixed(1)}%)` : "";
            setSyncProgress(`중단됨: ${a.total_fetched.toLocaleString()}건${pct} — 동기화 버튼으로 이어받기`);
          }
          return;
        }

        // Still running — update progress
        const pct = a.api_total_count ? ` (${((a.total_fetched / a.api_total_count) * 100).toFixed(1)}%)` : "";
        setSyncProgress(`동기화 진행 중: ${a.total_fetched.toLocaleString()}건${pct}`);

        // Refresh search results periodically
        if (Date.now() - lastSearchRefresh > 5000) {
          doSearch(1);
          lastSearchRefresh = Date.now();
        }
      } catch { /* ignore network errors */ }
    }, 2000);
  }, [stopPolling, doSearch]);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Check active sync on page load ──
  useEffect(() => {
    if (mode !== "browse") return;
    let cancelled = false;

    fetch("/api/sync-mfds/status")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.active) return;
        const a = data.active;
        if (a.status === "running") {
          setIsSyncing(true);
          setSyncLogId(a.id);
          const pct = a.api_total_count ? ` (${((a.total_fetched / a.api_total_count) * 100).toFixed(1)}%)` : "";
          setSyncProgress(`동기화 진행 중: ${a.total_fetched.toLocaleString()}건${pct}`);
          startPolling(a.id);
        } else if (a.status === "partial") {
          const pct = a.api_total_count ? ` (${((a.total_fetched / a.api_total_count) * 100).toFixed(1)}%)` : "";
          setSyncProgress(`중단됨: ${a.total_fetched.toLocaleString()}건${pct} — 동기화 버튼으로 이어받기`);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [mode, startPolling]);

  // ── MFDS sync trigger ────────────────
  // API starts sync in background — UI polls status for progress
  async function handleMfdsSync(syncMode: "full" | "incremental" = "full") {
    setIsSyncing(true);
    setSyncProgress("동기화 준비 중...");

    try {
      const res = await fetch("/api/sync-mfds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: tab, syncMode }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.logId) {
          // Already running — start polling existing sync
          setSyncLogId(data.logId);
          startPolling(data.logId);
          toast.info("이미 동기화가 진행 중입니다. 진행상황을 표시합니다.");
          return;
        }
        throw new Error(data.error ?? "동기화 시작 실패");
      }

      setSyncLogId(data.logId);
      if (data.resuming) {
        setSyncProgress(`이어받기: ${(data.priorFetched ?? 0).toLocaleString()}건부터 계속...`);
      }
      startPolling(data.logId);
    } catch (err) {
      setIsSyncing(false);
      setSyncProgress(null);
      setSyncLogId(null);
      toast.error(
        `동기화 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
      );
    }
  }

  // ── Stop sync ────────────────
  async function handleStopSync() {
    try {
      await fetch("/api/sync-mfds/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: syncLogId }),
      });
      toast.info("동기화 중지 요청됨");
      setIsSyncing(false);
      setSyncProgress(null);
      setSyncLogId(null);
    } catch {
      toast.error("중지 실패");
    }
  }

  // ── Add handler ───────────────────────────────────────────────────

  function handleAdd(item: Record<string, unknown>) {
    const code = ((tab === "drug" ? item.bar_code : item.udidi_cd) as string) ?? "";
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
          onSelect(result.id!);
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
        doSearch(page);
      } catch (err) {
        toast.error(`적용 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      }
    });
  }

  function handleDelete(item: Record<string, unknown>) {
    const itemId = item.id as number;
    const name = tab === "drug"
      ? (item.item_name as string) ?? ""
      : (item.prdlst_nm as string) ?? "";

    setDeletingId(itemId);
    startTransition(async () => {
      try {
        if (tab === "drug") {
          await deleteMyDrug(itemId);
        } else {
          await deleteMyDevice(itemId);
        }
        toast.success(`"${name}" 삭제됨`, { duration: 4000 });
        doSearch(page);
      } catch (err) {
        toast.error(`삭제 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      } finally {
        setDeletingId(null);
      }
    });
  }

  // ── Price save handler (manage mode) ─────────────────────────────

  function handlePriceSave(itemId: number) {
    const raw = editingPriceValue.trim();
    const unitPrice = raw === "" ? null : Number(raw);
    if (unitPrice !== null && isNaN(unitPrice)) {
      toast.error("유효한 숫자를 입력해주세요.");
      setEditingPriceId(null);
      return;
    }
    setEditingPriceId(null);
    startTransition(async () => {
      try {
        if (tab === "drug") {
          await updateMyDrugPrice(itemId, unitPrice);
        } else {
          await updateMyDevicePrice(itemId, unitPrice);
        }
        toast.success("가격이 저장되었습니다.");
        doSearch(page);
      } catch (err) {
        toast.error(`가격 저장 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
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

  const drugPct = syncStatus?.drugApiCount && syncStatus.drugApiCount > 0
    ? Math.min(100, Math.round((syncStatus.drugCount / syncStatus.drugApiCount) * 100))
    : syncStatus?.drugCount ? 100 : null;

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[400px]">
      {/* Status bar */}
      {(mode === "browse" || mode === "manage") && syncStatus && (
        <div className="flex items-center gap-4 px-3 py-1.5 rounded-md bg-muted/50 text-xs text-muted-foreground mb-1.5 shrink-0">
          <span className="font-medium text-foreground/70">DB 현황</span>
          <span>
            의약품 <span className="font-mono font-medium text-foreground">{syncStatus.drugCount.toLocaleString()}</span>
            {syncStatus.drugApiCount != null && syncStatus.drugApiCount > 0 && (
              <>/{syncStatus.drugApiCount.toLocaleString()}</>
            )}
            {drugPct != null && (
              <>, <span className={`font-medium ${drugPct < 90 ? "text-amber-600" : "text-green-600"}`}>{drugPct}%</span> 동기화</>
            )}
          </span>
        </div>
      )}

      {/* Compact top bar: search + sync + toolbar in minimal space */}
      <div className="space-y-1.5 shrink-0">
        {/* Search bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
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
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                }
                doSearch(1);
              }}
              isPending={isPending}
              recentSearches={recentSearches.items}
              onRecentClick={handleRecentClick}
              hasSearched={hasSearched}
            />
          </div>

          {/* Manual add button (manage mode) */}
          {mode === "manage" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              onClick={() => { setManualForm({}); setShowManualAdd(true); }}
            >
              <PenLine className="h-3 w-3 mr-1" />
              수동 추가
            </Button>
          )}

          {/* Sync buttons (browse mode) */}
          {mode === "browse" && syncStatus && (
            <div className="flex items-center gap-1.5 shrink-0">
              {syncProgress && (
                <span className="text-[11px] text-muted-foreground max-w-[200px] truncate">{syncProgress}</span>
              )}
              {isSyncing ? (
                <Button variant="destructive" size="sm" className="h-8" onClick={handleStopSync}>
                  <Square className="h-3 w-3 mr-1" />
                  정지
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => handleMfdsSync("incremental")}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    증분
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => handleMfdsSync("full")}>
                    <Database className="h-3 w-3 mr-1" />
                    전체
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Inline toolbar: result count + column settings (compact) */}
        {(hasSearched || (mode === "manage" && results.length > 0)) && (
          <div className="flex items-center justify-between">
            <MfdsResultToolbar
              totalCount={totalCount}
              page={page}
              totalPages={totalPages}
              table={table}
            />
          </div>
        )}
      </div>

      {/* Table fills remaining space */}
      <div className="flex-1 min-h-0 overflow-auto mt-1.5">
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
        />
      </div>

      {/* Pagination always at bottom */}
      <div className="shrink-0 pt-2">
        <MfdsPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          isPending={isPending}
          onPageChange={(p) => doSearch(p)}
        />
      </div>

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
      {/* Manual add dialog */}
      {showManualAdd && (
        <Dialog open onOpenChange={() => setShowManualAdd(false)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {tab === "drug" ? "의약품" : "의료기기"} 수동 추가
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-4 -mr-4">
              {tab === "drug" ? (
                /* Drug: grouped layout */
                <div className="space-y-5 py-2">
                  {(() => {
                    const groups = [...new Set(DRUG_FIELDS_GROUPED.map((f) => f.group))];
                    return groups.map((groupName) => (
                      <div key={groupName}>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">{groupName}</h4>
                        {DRUG_FIELDS_GROUPED.filter((f) => f.group === groupName).some((f) => f.type === "yn") ? (
                          <div className="grid grid-cols-2 gap-2">
                            {DRUG_FIELDS_GROUPED.filter((f) => f.group === groupName).map((f) =>
                              f.type === "yn" ? (
                                <label key={f.key} className="flex items-center gap-2 px-2 py-1.5 rounded border hover:bg-muted/50 cursor-pointer text-sm">
                                  <input type="checkbox" checked={manualForm[f.key] === "Y"} onChange={(e) => setManualForm((prev) => ({ ...prev, [f.key]: e.target.checked ? "Y" : "N" }))} className="rounded border-gray-300" />
                                  {f.label}
                                </label>
                              ) : f.type === "select" && f.options ? (
                                <div key={f.key} className="grid grid-cols-[100px_1fr] items-center gap-2 col-span-2">
                                  <Label className="text-xs text-right text-muted-foreground">{f.label}</Label>
                                  <select value={manualForm[f.key] ?? ""} onChange={(e) => setManualForm((prev) => ({ ...prev, [f.key]: e.target.value }))} className="h-8 text-sm rounded-md border border-input bg-background px-3">
                                    <option value="">선택하세요</option>
                                    {f.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                </div>
                              ) : (
                                <div key={f.key} className="grid grid-cols-[100px_1fr] items-center gap-2 col-span-2">
                                  <Label className="text-xs text-right text-muted-foreground">{f.label}</Label>
                                  <Input value={manualForm[f.key] ?? ""} onChange={(e) => setManualForm((prev) => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder ?? f.label} className="h-8 text-sm" />
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <div className="grid gap-2.5">
                            {DRUG_FIELDS_GROUPED.filter((f) => f.group === groupName).map((f) => (
                              <div key={f.key} className="grid grid-cols-[120px_1fr] items-center gap-2">
                                <Label htmlFor={`manual-${f.key}`} className="text-xs text-right text-muted-foreground">
                                  {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                                </Label>
                                {f.type === "select" && f.options ? (
                                  <select id={`manual-${f.key}`} value={manualForm[f.key] ?? ""} onChange={(e) => setManualForm((prev) => ({ ...prev, [f.key]: e.target.value }))} className="h-8 text-sm rounded-md border border-input bg-background px-3">
                                    <option value="">선택하세요</option>
                                    {f.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                ) : (
                                  <Input id={`manual-${f.key}`} value={manualForm[f.key] ?? ""} onChange={(e) => setManualForm((prev) => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder ?? f.label} className="h-8 text-sm" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">가격</h4>
                    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                      <Label htmlFor="manual-unit_price" className="text-xs text-right text-muted-foreground">단가</Label>
                      <Input id="manual-unit_price" type="number" value={manualForm.unit_price ?? ""} onChange={(e) => setManualForm((prev) => ({ ...prev, unit_price: e.target.value }))} placeholder="원 단위 입력" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>
              ) : (
                /* Device: grouped layout with proper input types */
                <div className="space-y-5 py-2">
                  {(() => {
                    const groups = [...new Set(DEVICE_FIELDS_GROUPED.map((f) => f.group))];
                    return groups.map((groupName) => (
                      <div key={groupName}>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">{groupName}</h4>
                        {groupName === "속성" ? (
                          /* Y/N fields in a compact grid */
                          <div className="grid grid-cols-2 gap-2">
                            {DEVICE_FIELDS_GROUPED.filter((f) => f.group === groupName).map((f) => (
                              f.type === "yn" ? (
                                <label key={f.key} className="flex items-center gap-2 px-2 py-1.5 rounded border hover:bg-muted/50 cursor-pointer text-sm">
                                  <input
                                    type="checkbox"
                                    checked={manualForm[f.key] === "Y"}
                                    onChange={(e) => setManualForm((prev) => ({ ...prev, [f.key]: e.target.checked ? "Y" : "N" }))}
                                    className="rounded border-gray-300"
                                  />
                                  {f.label}
                                </label>
                              ) : (
                                <div key={f.key} className="grid grid-cols-[100px_1fr] items-center gap-2">
                                  <Label className="text-xs text-right text-muted-foreground">{f.label}</Label>
                                  <Input value={manualForm[f.key] ?? ""} onChange={(e) => setManualForm((prev) => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder ?? f.label} className="h-8 text-sm" />
                                </div>
                              )
                            ))}
                          </div>
                        ) : (
                          <div className="grid gap-2.5">
                            {DEVICE_FIELDS_GROUPED.filter((f) => f.group === groupName).map((f) => (
                              <div key={f.key} className="grid grid-cols-[120px_1fr] items-center gap-2">
                                <Label htmlFor={`manual-${f.key}`} className="text-xs text-right text-muted-foreground">
                                  {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                                </Label>
                                {f.type === "select" && f.options ? (
                                  <select
                                    id={`manual-${f.key}`}
                                    value={manualForm[f.key] ?? ""}
                                    onChange={(e) => setManualForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                    className="h-8 text-sm rounded-md border border-input bg-background px-3"
                                  >
                                    <option value="">선택하세요</option>
                                    {f.options.map((opt) => <option key={opt} value={opt}>{opt}등급</option>)}
                                  </select>
                                ) : (
                                  <Input
                                    id={`manual-${f.key}`}
                                    value={manualForm[f.key] ?? ""}
                                    onChange={(e) => setManualForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                    placeholder={f.placeholder ?? f.label}
                                    className="h-8 text-sm"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">가격</h4>
                    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                      <Label htmlFor="manual-unit_price" className="text-xs text-right text-muted-foreground">단가</Label>
                      <Input id="manual-unit_price" type="number" value={manualForm.unit_price ?? ""} onChange={(e) => setManualForm((prev) => ({ ...prev, unit_price: e.target.value }))} placeholder="원 단위 입력" className="h-8 text-sm" />
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={addAnother} onChange={(e) => setAddAnother(e.target.checked)} className="rounded border-gray-300" />
                연속 추가
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowManualAdd(false)}>
                  닫기
                </Button>
                <Button onClick={handleManualAdd} disabled={isAdding}>
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-1" />}
                  추가
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

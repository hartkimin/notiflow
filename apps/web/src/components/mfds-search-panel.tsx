"use client";

import { useState, useMemo, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type ColumnOrderState,
  type VisibilityState,
  type SortingState,
} from "@tanstack/react-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  Loader2,
  Plus,
  Check,
  Search,
  Settings2,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  GripVertical,
  X,
} from "lucide-react";
import {
  searchMfdsDrug,
  searchMfdsDevice,
  addMfdsItemToProducts,
} from "@/lib/actions";
import type { MfdsApiSource } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────

interface MfdsCol {
  key: string;
  label: string;
}

interface MfdsSearchPanelProps {
  mode: "browse" | "pick";
  onSelect?: (productId: number) => void;
  existingStandardCodes?: string[];
}

// ─── Column Definitions (display) ───────────────────────────────────

const DRUG_COLUMNS: MfdsCol[] = [
  { key: "ITEM_SEQ", label: "품목기준코드" },
  { key: "ITEM_NAME", label: "품목명" },
  { key: "ITEM_ENG_NAME", label: "품목영문명" },
  { key: "ENTP_NAME", label: "업체명" },
  { key: "ENTP_NO", label: "업체허가번호" },
  { key: "ITEM_PERMIT_DATE", label: "허가일자" },
  { key: "CNSGN_MANUF", label: "위탁제조업체" },
  { key: "ETC_OTC_CODE", label: "전문일반" },
  { key: "CHART", label: "성상" },
  { key: "BAR_CODE", label: "표준코드" },
  { key: "MATERIAL_NAME", label: "원료성분" },
  { key: "EE_DOC_ID", label: "효능효과" },
  { key: "UD_DOC_ID", label: "용법용량" },
  { key: "NB_DOC_ID", label: "주의사항" },
  { key: "STORAGE_METHOD", label: "저장방법" },
  { key: "VALID_TERM", label: "유효기간" },
  { key: "PACK_UNIT", label: "포장단위" },
  { key: "EDI_CODE", label: "보험코드" },
  { key: "PERMIT_KIND_NAME", label: "허가/신고구분" },
  { key: "CANCEL_DATE", label: "취소일자" },
  { key: "CANCEL_NAME", label: "상태" },
  { key: "CHANGE_DATE", label: "변경일자" },
  { key: "ATC_CODE", label: "ATC코드" },
  { key: "RARE_DRUG_YN", label: "희귀의약품" },
];

const DEVICE_STD_COLUMNS: MfdsCol[] = [
  { key: "UDIDI_CD", label: "UDI-DI코드" },
  { key: "PRDLST_NM", label: "품목명" },
  { key: "MNFT_IPRT_ENTP_NM", label: "제조수입업체명" },
  { key: "MDEQ_CLSF_NO", label: "분류번호" },
  { key: "CLSF_NO_GRAD_CD", label: "등급" },
  { key: "PERMIT_NO", label: "품목허가번호" },
  { key: "PRMSN_YMD", label: "품목허가일자" },
  { key: "FOML_INFO", label: "모델명" },
  { key: "PRDT_NM_INFO", label: "제품명" },
  { key: "HMBD_TRSPT_MDEQ_YN", label: "인체이식형여부" },
  { key: "DSPSBL_MDEQ_YN", label: "일회용여부" },
  { key: "TRCK_MNG_TRGT_YN", label: "추적관리대상여부" },
  { key: "TOTAL_DEV", label: "한벌구성의료기기여부" },
  { key: "CMBNMD_YN", label: "조합의료기기여부" },
  { key: "USE_BEFORE_STRLZT_NEED_YN", label: "사용전멸균필요여부" },
  { key: "STERILIZATION_METHOD_NM", label: "멸균방법" },
  { key: "USE_PURPS_CONT", label: "사용목적" },
  { key: "STRG_CND_INFO", label: "저장조건" },
  { key: "CIRC_CND_INFO", label: "유통취급조건" },
  { key: "RCPRSLRY_TRGT_YN", label: "요양급여대상여부" },
];

// ─── API Search Parameters (서버 검색 가능 필드) ─────────────────────

const DRUG_SEARCH_PARAMS: MfdsCol[] = [
  { key: "ITEM_NAME", label: "품목명" },
  { key: "ENTP_NAME", label: "업체명" },
  { key: "ITEM_SEQ", label: "품목기준코드" },
  { key: "BAR_CODE", label: "표준코드" },
  { key: "EDI_CODE", label: "보험코드" },
  { key: "ATC_CODE", label: "ATC코드" },
  { key: "ITEM_PERMIT_DATE", label: "허가일자" },
];

const DEVICE_SEARCH_PARAMS: MfdsCol[] = [
  { key: "PRDLST_NM", label: "품목명" },
  { key: "MNFT_IPRT_ENTP_NM", label: "제조수입업체명" },
  { key: "UDIDI_CD", label: "UDI-DI코드" },
  { key: "MDEQ_CLSF_NO", label: "분류번호" },
  { key: "CLSF_NO_GRAD_CD", label: "등급" },
  { key: "PERMIT_NO", label: "품목허가번호" },
  { key: "FOML_INFO", label: "모델명" },
];

// ─── Component ──────────────────────────────────────────────────────

export function MfdsSearchPanel({
  mode,
  onSelect,
  existingStandardCodes = [],
}: MfdsSearchPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [tab, setTab] = useState<MfdsApiSource>("drug");

  // Search state
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Results state
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});

  // DnD ref for column reordering
  const dragColumnRef = useRef<string | null>(null);

  const colDefs = tab === "drug" ? DRUG_COLUMNS : DEVICE_STD_COLUMNS;
  const searchParams = tab === "drug" ? DRUG_SEARCH_PARAMS : DEVICE_SEARCH_PARAMS;
  const pageSize = 25;
  const totalPages = Math.ceil(totalCount / pageSize);

  function getStandardCode(item: Record<string, unknown>): string {
    return ((tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string) ?? "";
  }

  // ── TanStack column defs ────────────────────────────────────────

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const actionCol: ColumnDef<Record<string, unknown>> = {
      id: "_action",
      header: mode === "browse" ? "추가" : "선택",
      size: 80,
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
            size="sm"
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

    const dataCols: ColumnDef<Record<string, unknown>>[] = colDefs.map(
      (col) => ({
        id: col.key,
        accessorFn: (row: Record<string, unknown>) =>
          (row[col.key] as string) ?? "",
        header: col.label,
        size: 160,
        minSize: 60,
        enableResizing: true,
      }),
    );

    return [actionCol, ...dataCols];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colDefs, mode, existingStandardCodes, isPending, addingId, tab]);

  // ── Table instance ──────────────────────────────────────────────

  const table = useReactTable({
    data: results,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnOrder,
      globalFilter,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  // ── Handlers ────────────────────────────────────────────────────

  function doSearch(targetPage = 1) {
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v.trim()),
    );
    if (Object.keys(activeFilters).length === 0) {
      toast.error("검색어를 1개 이상 입력해주세요.");
      return;
    }
    startTransition(async () => {
      try {
        const searchFn = tab === "drug" ? searchMfdsDrug : searchMfdsDevice;
        const result = await searchFn(activeFilters, targetPage);
        setResults(result.items as Record<string, unknown>[]);
        setTotalCount(result.totalCount);
        setPage(targetPage);
        setHasSearched(true);
      } catch (err) {
        toast.error(
          `검색 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
        );
      }
    });
  }

  function handleAdd(item: Record<string, unknown>) {
    const code = getStandardCode(item);
    setAddingId(code);
    startTransition(async () => {
      try {
        const result = await addMfdsItemToProducts(item, tab);
        if (result.alreadyExists) {
          toast.info("이미 내 품목에 등록된 항목입니다.");
        } else {
          toast.success("내 품목에 추가되었습니다.");
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

  function handleTabChange(value: string) {
    setTab(value as MfdsApiSource);
    setResults([]);
    setTotalCount(0);
    setPage(1);
    setHasSearched(false);
    setFilters({});
    setSorting([]);
    setColumnVisibility({});
    setColumnOrder([]);
    setGlobalFilter("");
    setColumnSizing({});
    setShowAdvanced(false);
  }

  // ── DnD column reordering ──────────────────────────────────────

  function handleDragStart(columnId: string) {
    dragColumnRef.current = columnId;
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(targetColumnId: string) {
    const draggedId = dragColumnRef.current;
    if (!draggedId || draggedId === targetColumnId) return;

    const currentOrder =
      table.getState().columnOrder.length > 0
        ? [...table.getState().columnOrder]
        : table.getAllLeafColumns().map((c) => c.id);

    const fromIndex = currentOrder.indexOf(draggedId);
    const toIndex = currentOrder.indexOf(targetColumnId);
    if (fromIndex === -1 || toIndex === -1) return;

    currentOrder.splice(fromIndex, 1);
    currentOrder.splice(toIndex, 0, draggedId);
    setColumnOrder(currentOrder);
    dragColumnRef.current = null;
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="drug">의약품</TabsTrigger>
          <TabsTrigger value="device_std">의료기기</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-4">
          {/* ── Search Form ─────────────────────────────── */}
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              doSearch(1);
            }}
          >
            {/* Default search fields (first 3) */}
            <div className="flex items-end gap-2">
              {searchParams.slice(0, 3).map((param) => (
                <div key={param.key} className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {param.label}
                  </label>
                  <Input
                    placeholder={`${param.label} 검색...`}
                    value={filters[param.key] ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, [param.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-1">검색</span>
              </Button>
            </div>

            {/* Advanced search toggle */}
            {searchParams.length > 3 && (
              <>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  고급 검색 ({searchParams.length - 3}개 추가 필터)
                </button>
                {showAdvanced && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {searchParams.slice(3).map((param) => (
                      <div key={param.key} className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          {param.label}
                        </label>
                        <Input
                          placeholder={`${param.label}...`}
                          value={filters[param.key] ?? ""}
                          onChange={(e) =>
                            setFilters((f) => ({
                              ...f,
                              [param.key]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </form>

          {/* ── Toolbar ─────────────────────────────────── */}
          {hasSearched && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground">
                총 {totalCount.toLocaleString()}건 (페이지 {page}/
                {totalPages || 1})
                {globalFilter && (
                  <span className="ml-2">
                    · 필터 적용: {table.getFilteredRowModel().rows.length}건
                    표시
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                {/* Client-side global filter */}
                <div className="relative">
                  <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="결과 내 검색..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="pl-7 h-8 w-48 text-xs"
                  />
                  {globalFilter && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setGlobalFilter("")}
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Column visibility */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <Settings2 className="h-3 w-3 mr-1" />
                      컬럼
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 max-h-80 overflow-y-auto"
                  >
                    <DropdownMenuLabel>표시할 컬럼</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {table
                      .getAllLeafColumns()
                      .filter((col) => col.id !== "_action")
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
            </div>
          )}

          {/* ── Data Table ──────────────────────────────── */}
          {results.length > 0 && (
            <div className="border rounded-md overflow-x-auto">
              <table
                className="text-sm"
                style={{ width: table.getCenterTotalSize() }}
              >
                <thead className="bg-muted/50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const isAction = header.id === "_action";
                        return (
                          <th
                            key={header.id}
                            className={`relative px-3 py-2 text-left whitespace-nowrap select-none ${
                              isAction
                                ? "sticky left-0 bg-muted/50 z-10"
                                : ""
                            }`}
                            style={{ width: header.getSize() }}
                            draggable={!isAction}
                            onDragStart={() => handleDragStart(header.id)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(header.id)}
                          >
                            <div
                              className={`flex items-center gap-1 ${
                                header.column.getCanSort()
                                  ? "cursor-pointer hover:text-foreground"
                                  : ""
                              }`}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {!isAction && (
                                <GripVertical className="h-3 w-3 text-muted-foreground/40 flex-shrink-0 cursor-grab" />
                              )}
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

                            {/* Resize handle */}
                            {header.column.getCanResize() && (
                              <div
                                onMouseDown={header.getResizeHandler()}
                                onTouchStart={header.getResizeHandler()}
                                className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-primary/50 ${
                                  header.column.getIsResizing()
                                    ? "bg-primary"
                                    : ""
                                }`}
                              />
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={`px-3 py-2 whitespace-nowrap max-w-[300px] truncate ${
                            cell.column.id === "_action"
                              ? "sticky left-0 bg-background z-10"
                              : ""
                          }`}
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {hasSearched && results.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              검색 결과가 없습니다.
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isPending}
                onClick={() => doSearch(page - 1)}
              >
                이전
              </Button>
              <span className="text-sm">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isPending}
                onClick={() => doSearch(page + 1)}
              >
                다음
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

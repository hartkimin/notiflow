"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Check, Search } from "lucide-react";
import {
  searchMfdsDrug,
  searchMfdsDevice,
  addMfdsItemToProducts,
} from "@/lib/actions";
import type { MfdsApiSource } from "@/lib/types";

interface MfdsSearchPanelProps {
  mode: "browse" | "pick";
  onSelect?: (productId: number) => void;
  existingStandardCodes?: string[];
}

const DRUG_COLUMNS = [
  { key: "ITEM_SEQ", label: "품목기준코드" },
  { key: "ITEM_NAME", label: "품목명" },
  { key: "ENTP_NAME", label: "업체명" },
  { key: "ITEM_PERMIT_DATE", label: "허가일자" },
  { key: "ENTP_NO", label: "허가번호" },
  { key: "BAR_CODE", label: "바코드" },
  { key: "EDI_CODE", label: "EDI코드" },
  { key: "ATC_CODE", label: "ATC코드" },
  { key: "MAIN_ITEM_INGR", label: "주성분" },
  { key: "BIZRNO", label: "사업자등록번호" },
  { key: "RARE_DRUG_YN", label: "희귀의약품" },
];

const DEVICE_STD_COLUMNS = [
  { key: "UDIDI_CD", label: "UDI코드" },
  { key: "PRDLST_NM", label: "품목명" },
  { key: "MNFT_IPRT_ENTP_NM", label: "제조/수입업체" },
  { key: "PERMIT_NO", label: "허가번호" },
  { key: "PRMSN_YMD", label: "허가일자" },
  { key: "MDEQ_CLSF_NO", label: "분류번호" },
  { key: "CLSF_NO_GRAD_CD", label: "등급" },
  { key: "PRDT_NM_INFO", label: "제품명" },
  { key: "USE_PURPS_CONT", label: "사용목적" },
  { key: "FOML_INFO", label: "규격정보" },
  { key: "HMBD_TRSPT_MDEQ_YN", label: "위해물질수송" },
  { key: "DSPSBL_MDEQ_YN", label: "일회용" },
  { key: "TRCK_MNG_TRGT_YN", label: "추적관리" },
  { key: "TOTAL_DEV", label: "총수량" },
  { key: "CMBNMD_YN", label: "조합" },
  { key: "USE_BEFORE_STRLZT_NEED_YN", label: "사용전멸균" },
  { key: "STERILIZATION_METHOD_NM", label: "멸균방법" },
  { key: "STRG_CND_INFO", label: "보관조건" },
  { key: "CIRC_CND_INFO", label: "유통조건" },
  { key: "RCPRSLRY_TRGT_YN", label: "재사용대상" },
];

export function MfdsSearchPanel({
  mode,
  onSelect,
  existingStandardCodes = [],
}: MfdsSearchPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [tab, setTab] = useState<MfdsApiSource>("drug");
  const [filters, setFilters] = useState({ name: "", company: "", code: "" });
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);

  const columns = tab === "drug" ? DRUG_COLUMNS : DEVICE_STD_COLUMNS;
  const pageSize = 25;
  const totalPages = Math.ceil(totalCount / pageSize);

  function getStandardCode(item: Record<string, unknown>): string {
    return ((tab === "drug" ? item.BAR_CODE : item.UDIDI_CD) as string) ?? "";
  }

  function doSearch(targetPage = 1) {
    if (!filters.name && !filters.company && !filters.code) {
      toast.error("검색어를 1개 이상 입력해주세요.");
      return;
    }
    startTransition(async () => {
      try {
        const searchFn = tab === "drug" ? searchMfdsDrug : searchMfdsDevice;
        const result = await searchFn(filters, targetPage);
        setResults(result.items as Record<string, unknown>[]);
        setTotalCount(result.totalCount);
        setPage(targetPage);
        setHasSearched(true);
      } catch (err) {
        toast.error(`검색 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
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
        toast.error(`추가 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
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
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="drug">의약품</TabsTrigger>
          <TabsTrigger value="device_std">의료기기</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-4">
          {/* Search Form */}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => { e.preventDefault(); doSearch(1); }}
          >
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">품목명</label>
              <Input
                placeholder={tab === "drug" ? "의약품명 검색..." : "의료기기명 검색..."}
                value={filters.name}
                onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">업체명</label>
              <Input
                placeholder="제조/수입업체..."
                value={filters.company}
                onChange={(e) => setFilters((f) => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">
                {tab === "drug" ? "품목기준코드" : "UDI코드"}
              </label>
              <Input
                placeholder={tab === "drug" ? "ITEM_SEQ..." : "UDIDI_CD..."}
                value={filters.code}
                onChange={(e) => setFilters((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1">검색</span>
            </Button>
          </form>

          {/* Results info */}
          {hasSearched && (
            <p className="text-sm text-muted-foreground">
              총 {totalCount.toLocaleString()}건 (페이지 {page}/{totalPages || 1})
            </p>
          )}

          {/* Scrollable Table */}
          {results.length > 0 && (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-max min-w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left whitespace-nowrap sticky left-0 bg-muted/50 z-10">
                      {mode === "browse" ? "추가" : "선택"}
                    </th>
                    {columns.map((col) => (
                      <th key={col.key} className="px-3 py-2 text-left whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {results.map((item, idx) => {
                    const code = getStandardCode(item);
                    const alreadyAdded = existingStandardCodes.includes(code);

                    return (
                      <tr key={`${code}-${idx}`} className="hover:bg-muted/30">
                        <td className="px-3 py-2 sticky left-0 bg-background z-10">
                          {alreadyAdded ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Check className="h-3 w-3" /> 추가됨
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isPending && addingId === code}
                              onClick={() => handleAdd(item)}
                            >
                              {isPending && addingId === code
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Plus className="h-3 w-3" />}
                            </Button>
                          )}
                        </td>
                        {columns.map((col) => (
                          <td key={col.key} className="px-3 py-2 whitespace-nowrap max-w-[300px] truncate">
                            {(item[col.key] as string) ?? ""}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
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
              <span className="text-sm">{page} / {totalPages}</span>
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

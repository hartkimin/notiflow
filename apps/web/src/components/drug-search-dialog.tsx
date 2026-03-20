"use client";

import { useState, useCallback, useTransition } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Search, Plus, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";
import { createProduct, searchMfdsItems } from "@/lib/actions";

// Normalized product info returned by onSelect (fill mode)
export interface MedicalProductFill {
  official_name: string;
  manufacturer: string | null;
  ingredient: string | null;
  standard_code: string | null;
  mfds_item_id: number;
}

type SearchTab = "drug" | "device" | "device_std";

interface DrugSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onProductCreated?: (productId: number) => void;
  onSelect?: (data: MedicalProductFill) => void;
  mode?: "create" | "fill";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mfdsItemToFill(item: any): MedicalProductFill {
  if (item._type === "drug" || item.item_seq) {
    return {
      official_name: item.item_name,
      manufacturer: item.entp_name,
      ingredient: item.main_item_ingr ?? null,
      standard_code: item.bar_code,
      mfds_item_id: item.id,
    };
  }
  return {
    official_name: item.prdlst_nm,
    manufacturer: item.mnft_iprt_entp_nm,
    ingredient: item.use_purps_cont ?? null,
    standard_code: item.udidi_cd,
    mfds_item_id: item.id,
  };
}

/** Returns "Y"/"아니오"/null → boolean-like display */
function isYes(val: string | null): boolean {
  if (!val) return false;
  const v = val.trim().toUpperCase();
  return v === "Y" || v === "예" || v === "해당";
}

export function DrugSearchDialog({
  open,
  onClose,
  onProductCreated,
  onSelect,
  mode = "fill",
}: DrugSearchDialogProps) {
  const [tab, setTab] = useState<SearchTab>("drug");
  const [query, setQuery] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pageSize = 10;

  function clearResults() {
    setResults([]);
    setTotalCount(0);
    setPage(1);
  }

  function switchTab(newTab: SearchTab) {
    setTab(newTab);
    clearResults();
  }

  const search = useCallback(async (searchTab: SearchTab, searchQuery: string, pageNo: number) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const result = await searchMfdsItems({ sourceType: searchTab as "drug" | "device_std", query: searchQuery.trim(), page: pageNo, pageSize });
      setResults(result.items);
      setTotalCount(result.totalCount);
      setPage(pageNo);
    } catch (err) {
      const labels: Record<SearchTab, string> = { drug: "의약품", device: "의료기기", device_std: "의료기기(UDI)" };
      toast.error(`${labels[searchTab]} 검색 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    search(tab, query, 1);
  }

  function handlePageChange(newPage: number) {
    search(tab, query, newPage);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleSelectItem(item: any) {
    if (mode === "fill") {
      onSelect?.(mfdsItemToFill(item));
      onClose();
      return;
    }
    startTransition(async () => {
      try {
        const isDrug = item._type === "drug" || item.item_seq;
        const fill = mfdsItemToFill(item);
        const result = await createProduct({
          official_name: fill.official_name,
          manufacturer: fill.manufacturer ?? undefined,
          ingredient: fill.ingredient ?? undefined,
          efficacy: (isDrug ? item.main_item_ingr : item.use_purps_cont) ?? undefined,
          standard_code: fill.standard_code ?? undefined,
          mfds_item_id: item.id,
          category: isDrug ? "medication" : "equipment",
        });
        toast.success(`"${fill.official_name}" 품목이 생성되었습니다.`);
        onProductCreated?.(result.id);
        onClose();
      } catch (err) {
        toast.error(`품목 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasResults = results.length > 0;

  const placeholders: Record<SearchTab, string> = {
    drug: "의약품명을 입력하세요 (예: 타이레놀, 아스피린)",
    device: "의료기기명을 입력하세요 (예: 다이알라이저, 투석)",
    device_std: "품목명/모델명을 입력하세요",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>식약처 의약품·의료기기 통합 검색</DialogTitle>
        </DialogHeader>

        {/* Tab toggle */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "drug" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => switchTab("drug")}
          >
            의약품
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "device" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => switchTab("device")}
          >
            의료기기(품목)
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "device_std" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => switchTab("device_std")}
          >
            의료기기(UDI)
          </button>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholders[tab]}
              className="flex-1"
              autoFocus
            />
            <Button type="submit" disabled={isSearching || !query.trim()}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><Search className="h-4 w-4 mr-1" />검색</>
              )}
            </Button>
          </div>
        </form>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {!hasResults && !isSearching && (
            <p className="text-sm text-muted-foreground text-center py-8">
              검색어를 입력하고 검색 버튼을 클릭하세요.
            </p>
          )}

          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">검색 중...</span>
            </div>
          )}

          {!isSearching && hasResults && (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                총 {totalCount.toLocaleString()}건 중 {results.length}건 표시
              </p>

              {/* Drug results table */}
              {tab === "drug" && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">품목명</TableHead>
                        <TableHead className="text-xs w-[100px]">업체명</TableHead>
                        <TableHead className="text-xs w-[90px]">보험코드</TableHead>
                        <TableHead className="text-xs w-[140px]">주성분</TableHead>
                        <TableHead className="text-xs w-[60px]">선택</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">
                            <div>
                              <p className="font-medium truncate max-w-[280px]">{item.item_name}</p>
                              {item.rare_drug_yn === "Y" && (
                                <Badge variant="outline" className="text-xs mt-0.5">희귀</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{item.entp_name}</TableCell>
                          <TableCell className="text-xs font-mono">{item.edi_code || "-"}</TableCell>
                          <TableCell className="text-xs truncate max-w-[140px]">
                            {item.main_item_ingr || "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              disabled={isPending}
                              onClick={() => handleSelectItem(item)}
                            >
                              {mode === "create" ? (
                                <><Plus className="h-3.5 w-3.5 mr-0.5" />추가</>
                              ) : (
                                "선택"
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Device results table */}
              {tab === "device" && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">품목명</TableHead>
                        <TableHead className="text-xs w-[110px]">업체명</TableHead>
                        <TableHead className="text-xs w-[100px]">허가번호</TableHead>
                        <TableHead className="text-xs w-[50px]">등급</TableHead>
                        <TableHead className="text-xs w-[120px]">사용목적</TableHead>
                        <TableHead className="text-xs w-[60px]">선택</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">
                            <div>
                              <p className="font-medium truncate max-w-[220px]">{item.prdlst_nm}</p>
                              {item.prdt_nm_info && (
                                <p className="text-xs text-muted-foreground truncate max-w-[220px]">{item.prdt_nm_info}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{item.mnft_iprt_entp_nm}</TableCell>
                          <TableCell className="text-xs font-mono">{item.permit_no || "-"}</TableCell>
                          <TableCell className="text-xs text-center">
                            {item.clsf_no_grad_cd ? (
                              <Badge variant="outline" className="text-xs">{item.clsf_no_grad_cd}등급</Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-xs truncate max-w-[120px]">
                            {item.use_purps_cont || "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              disabled={isPending}
                              onClick={() => handleSelectItem(item)}
                            >
                              {mode === "create" ? (
                                <><Plus className="h-3.5 w-3.5 mr-0.5" />추가</>
                              ) : (
                                "선택"
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Device Standard Code results table */}
              {tab === "device_std" && (
                <TooltipProvider delayDuration={200}>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">품목명 / 모델</TableHead>
                          <TableHead className="text-xs w-[100px]">업체명</TableHead>
                          <TableHead className="text-xs w-[120px]">표준코드</TableHead>
                          <TableHead className="text-xs w-[90px]">허가번호</TableHead>
                          <TableHead className="text-xs w-[45px]">등급</TableHead>
                          <TableHead className="text-xs w-[70px]">특성</TableHead>
                          <TableHead className="text-xs w-[55px]">선택</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm">
                              <div>
                                <p className="font-medium truncate max-w-[200px]">{item.prdlst_nm}</p>
                                {item.foml_info && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.foml_info}</p>
                                )}
                                {item.prdt_nm_info && item.prdt_nm_info !== item.foml_info && (
                                  <p className="text-xs text-muted-foreground/70 truncate max-w-[200px]">{item.prdt_nm_info}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{item.mnft_iprt_entp_nm || "-"}</TableCell>
                            <TableCell className="text-xs font-mono break-all">{item.udidi_cd || "-"}</TableCell>
                            <TableCell className="text-xs font-mono">{item.permit_no || "-"}</TableCell>
                            <TableCell className="text-xs text-center">
                              {item.clsf_no_grad_cd ? (
                                <Badge variant="outline" className="text-xs">{item.clsf_no_grad_cd}</Badge>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-0.5">
                                {isYes(item.hmbd_trspt_mdeq_yn) && (
                                  <Badge variant="destructive" className="text-[10px] px-1 py-0">이식</Badge>
                                )}
                                {isYes(item.dspsbl_mdeq_yn) && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0">1회용</Badge>
                                )}
                                {isYes(item.rcprslry_trgt_yn) && (
                                  <Badge className="text-[10px] px-1 py-0 bg-blue-100 text-blue-700 hover:bg-blue-100">급여</Badge>
                                )}
                                {isYes(item.trck_mng_trgt_yn) && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">추적</Badge>
                                )}
                              </div>
                              {(item.use_purps_cont || item.strg_cnd_info || item.sterilization_method_nm) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button type="button" className="mt-0.5">
                                      <Info className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs text-xs space-y-1">
                                    {item.use_purps_cont && <p><span className="font-semibold">사용목적:</span> {item.use_purps_cont}</p>}
                                    {item.sterilization_method_nm && <p><span className="font-semibold">멸균방법:</span> {item.sterilization_method_nm}</p>}
                                    {item.strg_cnd_info && <p><span className="font-semibold">저장조건:</span> {item.strg_cnd_info}</p>}
                                    {item.circ_cnd_info && <p><span className="font-semibold">유통조건:</span> {item.circ_cnd_info}</p>}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                disabled={isPending}
                                onClick={() => handleSelectItem(item)}
                              >
                                {mode === "create" ? (
                                  <><Plus className="h-3.5 w-3.5 mr-0.5" />추가</>
                                ) : (
                                  "선택"
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TooltipProvider>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isSearching}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isSearching}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          로컬 DB에서 검색 중
        </p>
      </DialogContent>
    </Dialog>
  );
}

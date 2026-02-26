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
import { Loader2, Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { createProduct } from "@/lib/actions";
import type {
  DrugSearchResult, DrugSearchResponse,
  DeviceSearchResult, DeviceSearchResponse,
} from "@/lib/types";

// Normalized product info returned by onSelect (fill mode)
export interface MedicalProductFill {
  official_name: string;
  manufacturer: string | null;
  ingredient: string | null;
  efficacy: string | null;
  standard_code: string | null;
  category: string;
}

type SearchTab = "drug" | "device";

interface DrugSearchDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the created product id when a product is created (create mode) */
  onProductCreated?: (productId: number) => void;
  /** Called with normalized product data (fill mode) */
  onSelect?: (data: MedicalProductFill) => void;
  /** "create" = auto-create product on select, "fill" = just return data */
  mode?: "create" | "fill";
}

function drugToFill(drug: DrugSearchResult): MedicalProductFill {
  return {
    official_name: drug.item_name,
    manufacturer: drug.entp_name || null,
    ingredient: drug.main_item_ingr || null,
    efficacy: null,
    standard_code: drug.edi_code || null,
    category: "medication",
  };
}

function deviceToFill(device: DeviceSearchResult): MedicalProductFill {
  return {
    official_name: device.prdlst_nm,
    manufacturer: device.mnft_clnt_nm || null,
    ingredient: null,
    efficacy: device.use_purps_cont || null,
    standard_code: device.meddev_item_no || null,
    category: "equipment",
  };
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
  const [drugResults, setDrugResults] = useState<DrugSearchResult[]>([]);
  const [deviceResults, setDeviceResults] = useState<DeviceSearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pageSize = 10;

  function switchTab(newTab: SearchTab) {
    setTab(newTab);
    setDrugResults([]);
    setDeviceResults([]);
    setTotalCount(0);
    setPage(1);
  }

  const search = useCallback(async (searchTab: SearchTab, searchQuery: string, pageNo: number) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        query: searchQuery.trim(),
        page: String(pageNo),
        size: String(pageSize),
      });
      const endpoint = searchTab === "drug" ? "/api/drug-search" : "/api/device-search";
      const res = await fetch(`${endpoint}?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "검색 실패");
      }
      if (searchTab === "drug") {
        setDrugResults((data as DrugSearchResponse).items);
        setDeviceResults([]);
      } else {
        setDeviceResults((data as DeviceSearchResponse).items);
        setDrugResults([]);
      }
      setTotalCount(data.totalCount);
      setPage(pageNo);
    } catch (err) {
      const label = searchTab === "drug" ? "의약품" : "의료기기";
      toast.error(`${label} 검색 실패: ${err instanceof Error ? err.message : String(err)}`);
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

  function handleSelectDrug(drug: DrugSearchResult) {
    if (mode === "fill") {
      onSelect?.(drugToFill(drug));
      onClose();
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProduct({
          official_name: drug.item_name,
          category: "medication",
          manufacturer: drug.entp_name || undefined,
          ingredient: drug.main_item_ingr || undefined,
          standard_code: drug.edi_code || undefined,
          auto_info: {
            source: "mfds_drug_api",
            item_seq: drug.item_seq,
            bar_code: drug.bar_code,
            atc_code: drug.atc_code,
            item_permit_date: drug.item_permit_date,
            entp_no: drug.entp_no,
            rare_drug_yn: drug.rare_drug_yn,
            bizrno: drug.bizrno,
          },
        });
        toast.success(`"${drug.item_name}" 품목이 생성되었습니다.`);
        onProductCreated?.(result.id);
        onClose();
      } catch (err) {
        toast.error(`품목 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  function handleSelectDevice(device: DeviceSearchResult) {
    if (mode === "fill") {
      onSelect?.(deviceToFill(device));
      onClose();
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProduct({
          official_name: device.prdlst_nm,
          category: "equipment",
          manufacturer: device.mnft_clnt_nm || undefined,
          efficacy: device.use_purps_cont || undefined,
          standard_code: device.meddev_item_no || undefined,
          auto_info: {
            source: "mfds_device_api",
            prdlst_sn: device.prdlst_sn,
            mdeq_clsf_no: device.mdeq_clsf_no,
            clsf_no_grad_cd: device.clsf_no_grad_cd,
            prmsn_ymd: device.prmsn_ymd,
            prmsn_dclr_divs_nm: device.prmsn_dclr_divs_nm,
            mnsc_nm: device.mnsc_nm,
            mnsc_natn_cd: device.mnsc_natn_cd,
            prdt_nm_info: device.prdt_nm_info,
          },
        });
        toast.success(`"${device.prdlst_nm}" 품목이 생성되었습니다.`);
        onProductCreated?.(result.id);
        onClose();
      } catch (err) {
        toast.error(`품목 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasResults = tab === "drug" ? drugResults.length > 0 : deviceResults.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>식약처 의약품·의료기기 검색</DialogTitle>
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
            의료기기
          </button>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "drug"
              ? "의약품명을 입력하세요 (예: 타이레놀, 아스피린)"
              : "의료기기명을 입력하세요 (예: 다이알라이저, 투석)"}
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
                총 {totalCount.toLocaleString()}건 중 {(tab === "drug" ? drugResults : deviceResults).length}건 표시
              </p>

              {/* Drug results table */}
              {tab === "drug" && drugResults.length > 0 && (
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
                      {drugResults.map((drug) => (
                        <TableRow key={drug.item_seq}>
                          <TableCell className="text-sm">
                            <div>
                              <p className="font-medium truncate max-w-[280px]">{drug.item_name}</p>
                              {drug.rare_drug_yn === "Y" && (
                                <Badge variant="outline" className="text-xs mt-0.5">희귀</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{drug.entp_name}</TableCell>
                          <TableCell className="text-xs font-mono">{drug.edi_code || "-"}</TableCell>
                          <TableCell className="text-xs truncate max-w-[140px]">
                            {drug.main_item_ingr || "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              disabled={isPending}
                              onClick={() => handleSelectDrug(drug)}
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
              {tab === "device" && deviceResults.length > 0 && (
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
                      {deviceResults.map((device) => (
                        <TableRow key={device.prdlst_sn}>
                          <TableCell className="text-sm">
                            <div>
                              <p className="font-medium truncate max-w-[220px]">{device.prdlst_nm}</p>
                              {device.prdt_nm_info && (
                                <p className="text-xs text-muted-foreground truncate max-w-[220px]">{device.prdt_nm_info}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{device.mnft_clnt_nm}</TableCell>
                          <TableCell className="text-xs font-mono">{device.meddev_item_no || "-"}</TableCell>
                          <TableCell className="text-xs text-center">
                            {device.clsf_no_grad_cd ? (
                              <Badge variant="outline" className="text-xs">{device.clsf_no_grad_cd}등급</Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-xs truncate max-w-[120px]">
                            {device.use_purps_cont || "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              disabled={isPending}
                              onClick={() => handleSelectDevice(device)}
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
      </DialogContent>
    </Dialog>
  );
}

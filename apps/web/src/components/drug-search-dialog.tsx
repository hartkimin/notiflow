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
import type { DrugSearchResult, DrugSearchResponse } from "@/lib/types";

interface DrugSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onProductCreated?: (productId: number, drug: DrugSearchResult) => void;
  onDrugSelect?: (drug: DrugSearchResult) => void;
  mode?: "create" | "fill";
}

export function DrugSearchDialog({
  open,
  onClose,
  onProductCreated,
  onDrugSelect,
  mode = "fill",
}: DrugSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DrugSearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pageSize = 10;

  const search = useCallback(async (searchQuery: string, pageNo: number) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        query: searchQuery.trim(),
        page: String(pageNo),
        size: String(pageSize),
      });
      const res = await fetch(`/api/drug-search?${params}`);
      const data: DrugSearchResponse & { error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "검색 실패");
      }
      setResults(data.items);
      setTotalCount(data.totalCount);
      setPage(pageNo);
    } catch (err) {
      toast.error(`의약품 검색 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    search(query, 1);
  }

  function handlePageChange(newPage: number) {
    search(query, newPage);
  }

  function handleSelect(drug: DrugSearchResult) {
    if (mode === "fill") {
      onDrugSelect?.(drug);
      onClose();
      return;
    }

    // mode === "create": auto-create product
    startTransition(async () => {
      try {
        const result = await createProduct({
          official_name: drug.item_name,
          category: "medication",
          manufacturer: drug.entp_name || undefined,
          ingredient: drug.main_item_ingr || undefined,
          standard_code: drug.edi_code || undefined,
          auto_info: {
            source: "mfds_api",
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
        onProductCreated?.(result.id, drug);
        onClose();
      } catch (err) {
        toast.error(`품목 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>의약품 검색 (식약처 API)</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="의약품명을 입력하세요 (예: 타이레놀, 아스피린)"
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

        <div className="flex-1 overflow-auto">
          {results.length === 0 && !isSearching && (
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

          {!isSearching && results.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                총 {totalCount.toLocaleString()}건 중 {results.length}건 표시
              </p>
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
                    {results.map((drug) => (
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
                            onClick={() => handleSelect(drug)}
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

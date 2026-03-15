"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { 
  Plus, Search, Trash2, History, Loader2, 
  Check, ChevronDown, ChevronRight, Calculator,
  Database, Globe, Clock, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { 
  getPartnerProducts, addPartnerProduct, deletePartnerProduct, 
  updatePartnerProductPrice, searchMfdsItems, searchMyItems,
  addToMyDrugs, addToMyDevices
} from "@/lib/actions";
import { toast } from "sonner";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import type { MfdsApiSource } from "@/lib/types";

interface PartnerProductManagerProps {
  partnerType: "hospital" | "supplier";
  partnerId: number;
}

export function PartnerProductManager({ partnerType, partnerId }: PartnerProductManagerProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSource, setSearchSource] = useState<"my" | "mfds">("my");
  const [searchType, setSearchType] = useState<MfdsApiSource>("drug");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // History dialog
  const [historyItem, setHistoryItem] = useState<any | null>(null);

  useEffect(() => {
    loadProducts();
  }, [partnerId]);

  const handleSearch = useCallback(async (isInitial = false) => {
    const q = isInitial ? "" : searchQuery.trim();
    setIsSearching(true);
    try {
      const fn = searchSource === "my" ? searchMyItems : searchMfdsItems;
      const res = await fn({
        query: q,
        sourceType: searchType,
        pageSize: 30, // Show up to 30 items
      });
      setSearchResults(res.items);
    } catch (err) {
      if (!isInitial) toast.error("검색 실패");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchSource, searchType]);

  // Auto-load initial results for search
  useEffect(() => {
    handleSearch(true);
  }, [searchSource, searchType, handleSearch]);

  async function loadProducts() {
    setIsLoading(true);
    try {
      const data = await getPartnerProducts(partnerType, partnerId);
      setProducts(data);
    } catch (err) {
      toast.error("품목 목록 로드 실패");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAdd(item: any) {
    startTransition(async () => {
      try {
        let finalProductId = item.id;
        const standardCode = (item.BAR_CODE || item.bar_code || item.UDIDI_CD || item.udidi_cd) as string;

        // CRITICAL: If adding from Global MFDS, we MUST register it to "My Products" first
        if (searchSource === "mfds") {
          const addRes = searchType === "drug" 
            ? await addToMyDrugs(item) 
            : await addToMyDevices(item);
          
          if (!addRes.success) {
            throw new Error(addRes.alreadyExists ? "이미 관리 품목에 존재하지만 정보를 가져오지 못했습니다." : "내 품목 등록 실패");
          }
          finalProductId = addRes.id;
        }

        if (!finalProductId) {
          toast.error("품목 ID를 생성하거나 찾을 수 없습니다.");
          return;
        }

        const res = await addPartnerProduct({
          partnerType,
          partnerId,
          productSource: searchType === "drug" ? "drug" : "device",
          productId: finalProductId,
          standardCode,
        });

        if (res.success) {
          if (res.alreadyExists) {
            toast.info("이미 이 업체에 등록된 품목입니다.");
          } else {
            toast.success("품목이 성공적으로 추가되었습니다.");
            loadProducts();
          }
        } else {
          toast.error(`추가 실패: ${res.error}`);
        }
      } catch (err) {
        console.error("Add partner product failed:", err);
        toast.error(`작업 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  async function handleDelete(id: number) {
    if (!confirm("정말 이 품목을 삭제하시겠습니까?")) return;
    try {
      await deletePartnerProduct(id);
      toast.success("삭제되었습니다.");
      loadProducts();
    } catch (err) {
      toast.error("삭제 실패");
    }
  }

  async function handlePriceUpdate(id: number, currentPrice: number) {
    const newPriceStr = prompt("새로운 가격을 입력하세요:", String(currentPrice));
    if (newPriceStr === null) return;
    
    const newPrice = parseFloat(newPriceStr);
    if (isNaN(newPrice)) {
      toast.error("유효한 숫자를 입력해주세요.");
      return;
    }

    try {
      await updatePartnerProductPrice(id, newPrice);
      toast.success("가격이 업데이트되었습니다.");
      loadProducts();
    } catch (err) {
      toast.error("가격 업데이트 실패");
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Search and Add ── */}
      <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/60 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">품목 추가</h4>
          <div className="flex bg-white rounded-lg border p-0.5 shadow-sm">
            <button 
              onClick={() => setSearchSource("my")}
              className={cn("px-2.5 py-1 text-[10px] font-black rounded-md transition-all", searchSource === "my" ? "bg-zinc-950 text-white shadow-md" : "text-zinc-400 hover:text-zinc-600")}
            >
              내 품목
            </button>
            <button 
              onClick={() => setSearchSource("mfds")}
              className={cn("px-2.5 py-1 text-[10px] font-black rounded-md transition-all", searchSource === "mfds" ? "bg-zinc-950 text-white shadow-md" : "text-zinc-400 hover:text-zinc-600")}
            >
              식약처 전체
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <select 
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as any)}
            className="text-[11px] font-bold border rounded-lg px-2.5 bg-white outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
          >
            <option value="drug">의약품</option>
            <option value="device">의료기기</option>
          </select>
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-zinc-400 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="품목명 또는 코드 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length === 0 && handleSearch(true)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9 h-10 text-xs bg-white rounded-lg border-zinc-200 focus:border-primary/50 focus:ring-primary/10 shadow-sm"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={() => handleSearch()} disabled={isSearching} className="font-bold h-10 px-4 rounded-lg shadow-sm">
            {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "검색"}
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100 max-h-[320px] overflow-y-auto custom-scrollbar shadow-lg animate-in fade-in zoom-in-95 duration-200">
            {searchResults.map((item, idx) => {
              const name = (item.ITEM_NAME || item.item_name || item.PRDLST_NM || item.prdlst_nm) as string;
              const code = (item.BAR_CODE || item.bar_code || item.UDIDI_CD || item.udidi_cd) as string;
              return (
                <div key={idx} className="p-3 flex items-center justify-between hover:bg-zinc-50 transition-colors group/item">
                  <div className="min-w-0 mr-4">
                    <p className="text-[11px] font-bold text-zinc-950 truncate group-hover/item:text-primary transition-colors">{name}</p>
                    <p className="text-[10px] text-zinc-400 font-mono tracking-tighter">{code}</p>
                  </div>
                  <Button size="xs" variant="outline" className="h-7 font-black shrink-0 border-zinc-200 hover:bg-primary hover:text-white hover:border-primary transition-all rounded-md" onClick={() => handleAdd(item)} disabled={isPending}>
                    {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="h-3 w-3 mr-1" /> 추가</>}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Product List ── */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">등록된 품목 ({products.length})</h4>
        
        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-200" /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-zinc-100 rounded-2xl bg-zinc-50/30 transition-all">
            <p className="text-[11px] font-bold text-zinc-300">등록된 품목이 없습니다.</p>
          </div>
        ) : (
          <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
            <Table>
              <TableHeader className="bg-zinc-50/50">
                <TableRow className="hover:bg-transparent border-b-zinc-100">
                  <TableHead className="text-[10px] h-10 font-black text-zinc-400 pl-4">품목명</TableHead>
                  <TableHead className="text-[10px] h-10 font-black text-zinc-400 w-[110px] text-right pr-4">단가</TableHead>
                  <TableHead className="text-[10px] h-10 font-black text-zinc-400 w-[80px] text-center">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id} className="group hover:bg-zinc-50/50 transition-colors border-b-zinc-50">
                    <TableCell className="py-3.5 pl-4">
                      <p className="text-[11px] font-bold text-zinc-950 leading-tight mb-0.5 truncate max-w-[180px]">{p.name}</p>
                      <p className="text-[9px] font-mono text-zinc-400 tracking-tighter">{p.code}</p>
                    </TableCell>
                    <TableCell className="py-3.5 text-right pr-4">
                      <button 
                        onClick={() => handlePriceUpdate(p.id, p.unit_price || 0)}
                        className="text-[11px] font-black text-zinc-950 hover:text-primary transition-all flex items-center justify-end gap-1.5 w-full"
                      >
                        {p.unit_price ? formatCurrency(p.unit_price) : "단가 설정"}
                        <Calculator className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0" />
                      </button>
                    </TableCell>
                    <TableCell className="py-3.5 text-center px-0">
                      <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg"
                          onClick={() => setHistoryItem(p)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-zinc-400 hover:text-destructive hover:bg-destructive/5 rounded-lg"
                          onClick={() => handleDelete(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Price History Dialog ── */}
      {historyItem && (
        <Dialog open onOpenChange={() => setHistoryItem(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-black flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <History className="h-4 w-4 text-primary" />
                </div>
                가격 변경 이력
              </DialogTitle>
              <div className="px-1 py-3 mt-2 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-[11px] font-black text-zinc-950 px-2 line-clamp-2 leading-relaxed">{historyItem.name}</p>
                <p className="text-[10px] font-mono text-zinc-400 px-2 mt-1">{historyItem.code}</p>
              </div>
            </DialogHeader>
            <div className="max-h-[300px] overflow-y-auto no-scrollbar py-2">
              <Table>
                <TableBody>
                  {Array.isArray(historyItem.price_history) && historyItem.price_history.length > 0 ? (
                    [...historyItem.price_history].reverse().map((entry: any, i: number) => (
                      <TableRow key={i} className="hover:bg-transparent border-none">
                        <TableCell className="py-4 pl-0">
                          <p className="text-[12px] font-black text-zinc-950">{formatCurrency(entry.price)}</p>
                          <p className="text-[10px] text-zinc-400 font-medium">{entry.reason}</p>
                        </TableCell>
                        <TableCell className="py-4 pr-0 text-right">
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-50 border border-zinc-100">
                            <Clock className="h-3 w-3 text-zinc-300" />
                            <p className="text-[10px] text-zinc-500 font-mono font-bold">
                              {new Date(entry.changed_at).toLocaleString("ko-KR", { 
                                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" 
                              })}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell className="text-center py-12 text-zinc-300 text-xs font-bold">변경 이력이 없습니다.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DialogFooter className="pt-2">
              <Button size="sm" variant="outline" onClick={() => setHistoryItem(null)} className="w-full h-10 font-bold rounded-xl">닫기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Pencil, Trash2, LayoutList, LayoutGrid, ArrowUp, ArrowDown,
  ArrowUpDown, Sparkles, Loader2, Globe, Phone, MapPin, Building,
  User as UserIcon, Package, Info, Save, X, Search, ExternalLink, FilterX, Factory,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { createSupplier, updateSupplier, deleteSupplier, deleteSuppliers } from "@/lib/actions";
import { toast } from "sonner";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { ResizableTh } from "@/components/resizable-th";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { useRowSelection } from "@/hooks/use-row-selection";
import { ResizablePanelGroup, ResizablePanel } from "@/components/ui/resizable";
import { ResizableDetailPanel } from "@/components/resizable-detail-panel";
import { PartnerProductManager } from "@/components/partner-product-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Supplier } from "@/lib/types";

const SUPPLIER_COL_DEFAULTS: Record<string, number> = {
  checkbox: 40, id: 50, name: 150, short_name: 100, ceo_name: 100, phone: 120, business_type: 100, notes: 150, is_active: 90, actions: 90,
};

type SortKey = "id" | "name" | "short_name" | "ceo_name" | "phone" | "notes" | "is_active";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

export function SupplierTable({ suppliers }: { suppliers: Supplier[] }) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { widths, onMouseDown } = useResizableColumns("suppliers", SUPPLIER_COL_DEFAULTS);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const allIds = useMemo(() => suppliers.map((s) => s.id), [suppliers]);
  const rowSelection = useRowSelection(allIds);

  function switchView(v: "list" | "grid") {
    setView(v);
    rowSelection.clear();
    setSelectedSupplier(null);
    setIsEditing(false);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return sortDir === "asc" ? (av === bv ? 0 : av ? -1 : 1) : (av === bv ? 0 : av ? 1 : -1);
      }
      const cmp = String(av).localeCompare(String(bv), "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [suppliers, sortKey, sortDir]);

  function handleDelete(id: number) {
    startTransition(async () => {
      try {
        await deleteSupplier(id);
        toast.success("공급사가 삭제되었습니다.");
        setDeleteId(null);
        if (selectedSupplier?.id === id) setSelectedSupplier(null);
        router.refresh();
      } catch (err) {
        toast.error(`공급사 삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const search = fd.get("search") as string;
    router.push(search ? `/suppliers?search=${encodeURIComponent(search)}` : "/suppliers");
  }

  return (
    <>
      {/* ── Efficient Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 flex-1 w-full sm:w-auto">
          <h2 className="text-xl font-black text-zinc-950 shrink-0">공급사 관리</h2>
          <form onSubmit={handleSearch} className="relative flex-1 max-w-sm group flex items-center gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <Input
                name="search"
                placeholder="이름, 약칭, 대표자, 업태 검색..."
                defaultValue={searchParams.get("search") || ""}
                className="pl-9 h-10 bg-white shadow-sm border-zinc-200 rounded-xl"
              />
            </div>
            {searchParams.get("search") && (
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => router.push("/suppliers")}>
                <FilterX className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </form>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200 shadow-inner mr-2">
            <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", view === "list" ? "bg-white shadow-sm text-zinc-950" : "text-zinc-400 hover:text-zinc-600")} onClick={() => switchView("list")}>
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", view === "grid" ? "bg-white shadow-sm text-zinc-950" : "text-zinc-400 hover:text-zinc-600")} onClick={() => switchView("grid")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="h-10 px-4 rounded-xl font-bold shadow-lg shadow-primary/10 transition-all hover:scale-105 active:scale-95">
            <Plus className="h-4 w-4 mr-1.5" /> 공급사 추가
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 border rounded-2xl overflow-hidden bg-background shadow-sm">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={selectedSupplier ? 65 : 100} minSize={30}>
            {suppliers.length === 0 ? (
              <div className="text-center py-24 bg-zinc-50/30">
                <Factory className="h-10 w-10 mx-auto mb-3 text-zinc-300" />
                <p className="text-sm font-bold text-zinc-400">
                  {searchParams.get("search") ? "검색 결과가 없습니다" : "등록된 공급사가 없습니다"}
                </p>
                <p className="text-xs text-zinc-300 mt-1">
                  {searchParams.get("search") ? "다른 검색어를 시도하거나 필터를 초기화하세요" : "\"공급사 추가\" 버튼으로 첫 공급사를 등록하세요"}
                </p>
              </div>
            ) : view === "list" ? (
              <div className="h-full overflow-auto no-scrollbar">
                <Table className="table-fixed">
                  <thead className="sticky top-0 bg-zinc-50/80 backdrop-blur-sm z-10 [&_tr]:border-b">
                    <TableRow>
                      <ResizableTh width={widths.checkbox} colKey="checkbox" onResizeStart={onMouseDown}>
                        <Checkbox
                          checked={rowSelection.allSelected ? true : rowSelection.someSelected ? "indeterminate" : false}
                          onCheckedChange={() => rowSelection.toggleAll()}
                        />
                      </ResizableTh>
                      <ResizableTh width={widths.id} colKey="id" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("id")}>
                        <span className="inline-flex items-center">ID<SortIcon active={sortKey === "id"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.name} colKey="name" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                        <span className="inline-flex items-center">공급사명<SortIcon active={sortKey === "name"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.short_name} colKey="short_name" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("short_name")}>
                        <span className="inline-flex items-center">약칭<SortIcon active={sortKey === "short_name"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.ceo_name} colKey="ceo_name" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("ceo_name")}>
                        <span className="inline-flex items-center">대표자<SortIcon active={sortKey === "ceo_name"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.phone} colKey="phone" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("phone")}>
                        <span className="inline-flex items-center">전화번호<SortIcon active={sortKey === "phone"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.business_type} colKey="business_type" onResizeStart={onMouseDown}>업태/종목</ResizableTh>
                      <ResizableTh width={widths.notes} colKey="notes" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("notes")}>
                        <span className="inline-flex items-center">비고<SortIcon active={sortKey === "notes"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.is_active} colKey="is_active" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("is_active")}>
                        <span className="inline-flex items-center">상태<SortIcon active={sortKey === "is_active"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.actions} colKey="actions" onResizeStart={onMouseDown}>관리</ResizableTh>
                    </TableRow>
                  </thead>
                  <TableBody>
                    {sorted.map((s) => (
                      <TableRow 
                        key={s.id} 
                        className={cn(
                          "cursor-pointer hover:bg-zinc-50 transition-colors text-zinc-950",
                          selectedSupplier?.id === s.id && "bg-primary/5 hover:bg-primary/10"
                        )}
                        onClick={() => {
                          setSelectedSupplier(s);
                          setIsEditing(false);
                        }}
                      >
                        <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={rowSelection.selected.has(s.id)}
                            onCheckedChange={() => rowSelection.toggle(s.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs overflow-hidden text-ellipsis">{s.id}</TableCell>
                        <TableCell className="font-medium overflow-hidden text-ellipsis">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm overflow-hidden text-ellipsis">{s.short_name || "-"}</TableCell>
                        <TableCell className="text-sm overflow-hidden text-ellipsis">{s.ceo_name || "-"}</TableCell>
                        <TableCell className="text-sm overflow-hidden text-ellipsis">{s.phone || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground overflow-hidden text-ellipsis">
                          {s.business_type || s.business_category
                            ? [s.business_type, s.business_category].filter(Boolean).join(" / ")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground overflow-hidden text-ellipsis">{s.notes || "-"}</TableCell>
                        <TableCell className="overflow-hidden text-ellipsis" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="relative flex h-5 w-[80px] rounded-full border text-[10px] font-medium overflow-hidden cursor-pointer transition-colors"
                            onClick={async () => {
                              try {
                                await updateSupplier(s.id, { is_active: !s.is_active });
                                router.refresh();
                              } catch { /* ignore */ }
                            }}
                          >
                            <span className={`flex-1 flex items-center justify-center transition-all ${!s.is_active ? "bg-red-500 text-white" : "text-muted-foreground"}`}>비활성</span>
                            <span className={`flex-1 flex items-center justify-center transition-all ${s.is_active ? "bg-green-600 text-white" : "text-muted-foreground"}`}>활성</span>
                          </button>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedSupplier(s); setIsEditing(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(s.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sorted.map((s) => (
                  <Card key={s.id} 
                    className={cn(
                      "cursor-pointer hover:border-primary/50 transition-all shadow-sm rounded-2xl",
                      selectedSupplier?.id === s.id && "ring-2 ring-primary/20 border-primary"
                    )}
                    onClick={() => {
                      setSelectedSupplier(s);
                      setIsEditing(false);
                    }}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-zinc-950 truncate">{s.name}</h3>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {s.is_active ? "활성" : "비활성"}
                        </span>
                      </div>
                      {s.short_name && <p className="text-[11px] text-muted-foreground truncate">{s.short_name}</p>}
                      <div className="space-y-1 text-[11px] text-zinc-500">
                        {s.ceo_name && <p className="flex items-center gap-1.5"><UserIcon className="h-3 w-3" /> {s.ceo_name}</p>}
                        {s.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {s.phone}</p>}
                        {s.address && <p className="flex items-center gap-1.5 truncate"><MapPin className="h-3 w-3 shrink-0" /> {s.address}</p>}
                        {s.website && <p className="flex items-center gap-1.5 truncate"><Globe className="h-3 w-3 shrink-0" /> {s.website}</p>}
                      </div>
                      <div className="flex gap-1 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => { setSelectedSupplier(s); setIsEditing(true); }}>
                          <Pencil className="h-3 w-3 mr-1" /> 수정
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setDeleteId(s.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ResizablePanel>

          <ResizableDetailPanel
            isOpen={!!selectedSupplier}
            onClose={() => {
              setSelectedSupplier(null);
              setIsEditing(false);
            }}
            title={isEditing ? "공급사 정보 수정" : "공급사 상세 정보"}
            defaultSize={35}
          >
            {selectedSupplier && (
              <Tabs defaultValue="info" className="w-full">
                {!isEditing && (
                  <TabsList className="grid w-full grid-cols-2 mb-6 h-10 bg-zinc-100 p-1 rounded-xl shadow-inner border">
                    <TabsTrigger value="info" className="text-xs font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all">
                      <Info className="h-3.5 w-3.5 text-zinc-400 data-[state=active]:text-primary" /> 기본 정보
                    </TabsTrigger>
                    <TabsTrigger value="products" className="text-xs font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all">
                      <Package className="h-3.5 w-3.5 text-zinc-400 data-[state=active]:text-primary" /> 취급 품목
                    </TabsTrigger>
                  </TabsList>
                )}

                <TabsContent value="info" className="mt-0">
                  {isEditing ? (
                    <SupplierInlineForm 
                      supplier={selectedSupplier} 
                      onCancel={() => setIsEditing(false)} 
                      onSuccess={(updated) => {
                        setSelectedSupplier(updated);
                        setIsEditing(false);
                        router.refresh();
                      }}
                    />
                  ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div>
                        <h4 className="text-xl font-black text-zinc-950 mb-1">{selectedSupplier.name}</h4>
                        <p className="text-sm text-muted-foreground">{selectedSupplier.short_name || "별칭 없음"}</p>
                      </div>

                      <div className="grid gap-6">
                        <div className="space-y-3">
                          <Label className="text-[10px] uppercase tracking-widest text-zinc-400 font-black">비즈니스 정보</Label>
                          <div className="grid gap-4 pt-1">
                            <div className="flex items-start gap-3">
                              <UserIcon className="h-4 w-4 text-zinc-400 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-bold text-zinc-400">대표자</p>
                                <p className="text-sm font-semibold text-zinc-950">{selectedSupplier.ceo_name || "-"}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Building className="h-4 w-4 text-zinc-400 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-bold text-zinc-400">사업자등록번호</p>
                                <p className="text-sm font-semibold text-zinc-950 font-mono">{selectedSupplier.business_number || "-"}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-dashed">
                          <Label className="text-[10px] uppercase tracking-widest text-zinc-400 font-black">연락처 및 주소</Label>
                          <div className="grid gap-4 pt-1">
                            <div className="flex items-start gap-3">
                              <Phone className="h-4 w-4 text-zinc-400 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-bold text-zinc-400">전화번호</p>
                                <p className="text-sm font-semibold text-zinc-950">{selectedSupplier.phone || "-"}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <MapPin className="h-4 w-4 text-zinc-400 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-bold text-zinc-400">주소</p>
                                <p className="text-sm font-semibold text-zinc-950 leading-relaxed">{selectedSupplier.address || "-"}</p>
                                {selectedSupplier.address && (
                                  <a
                                    href={`https://map.naver.com/v5/search/${encodeURIComponent(selectedSupplier.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1"
                                  >
                                    <ExternalLink className="h-3 w-3" /> 네이버 지도에서 보기
                                  </a>
                                )}
                              </div>
                            </div>
                            {selectedSupplier.website && (
                              <div className="flex items-start gap-3">
                                <Globe className="h-4 w-4 text-zinc-400 mt-0.5" />
                                <div>
                                  <p className="text-[11px] font-bold text-zinc-400">홈페이지</p>
                                  <a href={selectedSupplier.website} target="_blank" rel="noreferrer" className="text-sm font-bold text-primary hover:underline">
                                    {selectedSupplier.website}
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-dashed">
                          <Label className="text-[10px] uppercase tracking-widest text-zinc-400 font-black">기타 참고사항</Label>
                          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                            <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">{selectedSupplier.notes || "기록된 비고가 없습니다."}</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 font-black h-10 rounded-xl" onClick={() => setIsEditing(true)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> 수정하기
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1 font-black h-10 rounded-xl text-destructive hover:bg-destructive/5" onClick={() => setDeleteId(selectedSupplier.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> 삭제
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="products" className="mt-0">
                  <PartnerProductManager partnerType="supplier" partnerId={selectedSupplier.id} />
                </TabsContent>
              </Tabs>
            )}
          </ResizableDetailPanel>
        </ResizablePanelGroup>
      </div>

      <BulkActionBar
        count={rowSelection.count}
        onClear={rowSelection.clear}
        onDelete={() => deleteSuppliers(Array.from(rowSelection.selected))}
        label="공급사"
      />

      <SupplierFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="공급사 추가"
      />

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>공급사 삭제</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">이 공급사를 영구 삭제합니다. 관련 주문 데이터는 유지됩니다.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>취소</Button>
            <Button variant="destructive" disabled={isPending} onClick={() => deleteId && handleDelete(deleteId)}>
              {isPending ? "삭제중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SupplierInlineForm({ 
  supplier, onCancel, onSuccess 
}: { 
  supplier: Supplier; 
  onCancel: () => void;
  onSuccess: (updated: Supplier) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [isAiSearching, setIsAiSearching] = useState(false);
  
  const [name, setName] = useState(supplier.name);
  const [shortName, setShortName] = useState(supplier.short_name || "");
  const [ceoName, setCeoName] = useState(supplier.ceo_name || "");
  const [businessNumber, setBusinessNumber] = useState(supplier.business_number || "");
  const [phone, setPhone] = useState(supplier.phone || "");
  const [fax, setFax] = useState(supplier.fax || "");
  const [address, setAddress] = useState(supplier.address || "");
  const [website, setWebsite] = useState(supplier.website || "");
  const [businessType, setBusinessType] = useState(supplier.business_type || "");
  const [businessCategory, setBusinessCategory] = useState(supplier.business_category || "");
  const [notes, setNotes] = useState(supplier.notes || "");

  async function handleAiSearch() {
    if (!name.trim()) return;
    setIsAiSearching(true);
    try {
      const res = await fetch("/api/ai-supplier-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const s = data.supplier;
      if (s.name) setName(s.name);
      if (s.short_name) setShortName(s.short_name);
      if (s.business_number) setBusinessNumber(s.business_number);
      if (s.ceo_name) setCeoName(s.ceo_name);
      if (s.phone) setPhone(s.phone);
      if (s.fax) setFax(s.fax);
      if (s.address) setAddress(s.address);
      if (s.website) setWebsite(s.website);
      if (s.business_type) setBusinessType(s.business_type);
      if (s.business_category) setBusinessCategory(s.business_category);
      toast.success("AI 정보를 업데이트했습니다.");
    } catch {
      toast.error("AI 검색 실패");
    } finally {
      setIsAiSearching(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("공급사명은 필수입니다"); return; }
    const data = {
      name, short_name: shortName, ceo_name: ceoName, business_number: businessNumber,
      phone, fax, address, website, business_type: businessType, business_category: businessCategory,
      notes
    };
    startTransition(async () => {
      try {
        await updateSupplier(supplier.id, data);
        toast.success("저장되었습니다.");
        onSuccess({ ...supplier, ...data });
      } catch {
        toast.error("저장 실패");
      }
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-black text-zinc-400">공급사명 <span className="text-red-500">*</span></Label>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 font-bold rounded-xl" required />
            <Button size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-xl" onClick={handleAiSearch} disabled={isAiSearching}>
              {isAiSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black text-zinc-400">약칭</Label>
            <Input value={shortName} onChange={(e) => setShortName(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black text-zinc-400">대표자</Label>
            <Input value={ceoName} onChange={(e) => setCeoName(e.target.value)} className="h-10 rounded-xl" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-black text-zinc-400">사업자등록번호</Label>
          <Input value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} className="h-10 font-mono rounded-xl" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black text-zinc-400">전화번호</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black text-zinc-400">팩스</Label>
            <Input value={fax} onChange={(e) => setFax(e.target.value)} className="h-10 rounded-xl" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-black text-zinc-400">주소</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-10 rounded-xl" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-black text-zinc-400">홈페이지</Label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} className="h-10 rounded-xl" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-black text-zinc-400">비고</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-xl text-sm"
            placeholder="공급사 관련 메모..."
          />
        </div>
      </div>

      <div className="pt-6 border-t flex gap-2">
        <Button size="sm" className="flex-1 font-black h-10 rounded-xl" onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} 저장하기
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 font-black h-10 rounded-xl" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" /> 취소
        </Button>
      </div>
    </div>
  );
}

function SupplierFormDialog({
  open, onClose, title, supplier,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  supplier?: Supplier;
}) {
  const [isPending, startTransition] = useTransition();
  const [isAiSearching, setIsAiSearching] = useState(false);
  const router = useRouter();

  // Controlled form state for AI auto-fill
  const [name, setName] = useState(supplier?.name || "");
  const [shortName, setShortName] = useState(supplier?.short_name || "");
  const [businessNumber, setBusinessNumber] = useState(supplier?.business_number || "");
  const [ceoName, setCeoName] = useState(supplier?.ceo_name || "");
  const [phone, setPhone] = useState(supplier?.phone || "");
  const [fax, setFax] = useState(supplier?.fax || "");
  const [address, setAddress] = useState(supplier?.address || "");
  const [website, setWebsite] = useState(supplier?.website || "");
  const [businessType, setBusinessType] = useState(supplier?.business_type || "");
  const [businessCategory, setBusinessCategory] = useState(supplier?.business_category || "");
  const [notes, setNotes] = useState(supplier?.notes || "");

  async function handleAiSearch() {
    if (!name.trim()) {
      toast.error("공급사명을 먼저 입력해주세요.");
      return;
    }
    setIsAiSearching(true);
    try {
      const res = await fetch("/api/ai-supplier-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 검색 실패");

      const s = data.supplier;
      if (s.name) setName(s.name);
      if (s.short_name) setShortName(s.short_name);
      if (s.business_number) setBusinessNumber(s.business_number);
      if (s.ceo_name) setCeoName(s.ceo_name);
      if (s.phone) setPhone(s.phone);
      if (s.fax) setFax(s.fax);
      if (s.address) setAddress(s.address);
      if (s.website) setWebsite(s.website);
      if (s.business_type) setBusinessType(s.business_type);
      if (s.business_category) setBusinessCategory(s.business_category);

      const providerLabel = data.ai_provider === "google" ? "Gemini" :
                           data.ai_provider === "openai" ? "GPT" : "Claude";
      toast.success(`AI 검색 완료 (${providerLabel}, ${data.latency_ms}ms)`);
    } catch (err) {
      toast.error(`AI 검색 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAiSearching(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = {
      name,
      short_name: shortName || undefined,
      business_number: businessNumber || undefined,
      ceo_name: ceoName || undefined,
      phone: phone || undefined,
      fax: fax || undefined,
      address: address || undefined,
      website: website || undefined,
      business_type: businessType || undefined,
      business_category: businessCategory || undefined,
      notes: notes || undefined,
    };

    startTransition(async () => {
      try {
        if (supplier) {
          await updateSupplier(supplier.id, data);
          toast.success("공급사가 수정되었습니다.");
        } else {
          await createSupplier(data);
          toast.success("공급사가 추가되었습니다.");
        }
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(`공급사 저장 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-black">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">공급사명 *</Label>
              <div className="flex gap-2">
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="공급사명을 입력하세요"
                  className="flex-1 rounded-xl h-10"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isAiSearching || !name.trim()}
                  onClick={handleAiSearch}
                  className="shrink-0 rounded-xl h-10"
                >
                  {isAiSearching ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" />검색중</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-1" />AI 검색</>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-zinc-400">약칭</Label>
                <Input value={shortName} onChange={(e) => setShortName(e.target.value)} className="rounded-xl h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-zinc-400">대표자명</Label>
                <Input value={ceoName} onChange={(e) => setCeoName(e.target.value)} className="rounded-xl h-10" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">사업자등록번호</Label>
              <Input value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} placeholder="xxx-xx-xxxxx" className="rounded-xl h-10 font-mono" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-zinc-400">전화번호</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-zinc-400">팩스번호</Label>
                <Input value={fax} onChange={(e) => setFax(e.target.value)} className="rounded-xl h-10" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">주소</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} className="rounded-xl h-10" />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">홈페이지</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className="rounded-xl h-10" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-zinc-400">업태</Label>
                <Input value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="rounded-xl h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-zinc-400">종목</Label>
                <Input value={businessCategory} onChange={(e) => setBusinessCategory(e.target.value)} className="rounded-xl h-10" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">비고</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl text-sm" placeholder="공급사 관련 메모..." />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="ghost" type="button" onClick={onClose} className="font-bold">취소</Button>
            <Button type="submit" disabled={isPending} className="font-black rounded-xl px-6">
              {isPending ? "저장중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

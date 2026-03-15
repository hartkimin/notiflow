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
  Plus, Pencil, Trash2, LayoutList, LayoutGrid, ArrowUp, ArrowDown, ArrowUpDown, 
  Phone, MapPin, Building, User as UserIcon, CreditCard, Clock, Package, Info, Save, X, Loader2, Search
} from "lucide-react";
import { createHospital, updateHospital, deleteHospital, deleteHospitals } from "@/lib/actions";
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
import type { Hospital } from "@/lib/types";

const HOSPITAL_COL_DEFAULTS: Record<string, number> = {
  checkbox: 40, id: 50, name: 140, short_name: 90, hospital_type: 80, phone: 120,
  contact_person: 80, address: 180, business_number: 120, payment_terms: 90,
  lead_time_days: 80, is_active: 70, actions: 90,
};

const TYPE_LABEL: Record<string, string> = {
  hospital: "병원",
  clinic: "의원",
  pharmacy: "약국",
  distributor: "유통사",
  research: "연구소",
  other: "기타",
};

type SortKey = "id" | "name" | "short_name" | "hospital_type" | "phone" | "contact_person" | "address" | "business_number" | "payment_terms" | "lead_time_days" | "is_active";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

export function HospitalTable({ hospitals }: { hospitals: Hospital[] }) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { widths, onMouseDown } = useResizableColumns("hospitals", HOSPITAL_COL_DEFAULTS);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const allIds = useMemo(() => hospitals.map((h) => h.id), [hospitals]);
  const rowSelection = useRowSelection(allIds);

  const PanelGroup = ResizablePanelGroup as any;

  function switchView(v: "list" | "grid") {
    setView(v);
    rowSelection.clear();
    setSelectedHospital(null);
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
    return [...hospitals].sort((a, b) => {
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
  }, [hospitals, sortKey, sortDir]);

  function handleDelete(id: number) {
    startTransition(async () => {
      try {
        await deleteHospital(id);
        toast.success("거래처가 삭제되었습니다.");
        setDeleteId(null);
        if (selectedHospital?.id === id) setSelectedHospital(null);
        router.refresh();
      } catch (err) {
        toast.error(`거래처 삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const search = fd.get("search") as string;
    router.push(search ? `/hospitals?search=${encodeURIComponent(search)}` : "/hospitals");
  }

  return (
    <>
      {/* ── Efficient Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 flex-1 w-full sm:w-auto">
          <h2 className="text-xl font-black text-zinc-950 shrink-0">거래처 관리</h2>
          <form onSubmit={handleSearch} className="relative flex-1 max-w-sm group">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
            <Input
              name="search"
              placeholder="거래처 검색..."
              defaultValue={searchParams.get("search") || ""}
              className="pl-9 h-10 bg-white shadow-sm border-zinc-200 rounded-xl"
            />
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
            <Plus className="h-4 w-4 mr-1.5" /> 거래처 추가
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 border rounded-2xl overflow-hidden bg-background shadow-sm">
        <PanelGroup direction="horizontal">
          <ResizablePanel defaultSize={selectedHospital ? 65 : 100} minSize={30}>
            {hospitals.length === 0 ? (
              <div className="text-center py-24 bg-zinc-50/30">
                <p className="text-sm font-bold text-zinc-400">거래처가 없습니다.</p>
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
                        <span className="inline-flex items-center">거래처명<SortIcon active={sortKey === "name"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.short_name} colKey="short_name" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("short_name")}>
                        <span className="inline-flex items-center">약칭<SortIcon active={sortKey === "short_name"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.hospital_type} colKey="hospital_type" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("hospital_type")}>
                        <span className="inline-flex items-center">유형<SortIcon active={sortKey === "hospital_type"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.phone} colKey="phone" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("phone")}>
                        <span className="inline-flex items-center">전화번호<SortIcon active={sortKey === "phone"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.contact_person} colKey="contact_person" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("contact_person")}>
                        <span className="inline-flex items-center">담당자<SortIcon active={sortKey === "contact_person"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.address} colKey="address" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("address")}>
                        <span className="inline-flex items-center">주소<SortIcon active={sortKey === "address"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.business_number} colKey="business_number" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("business_number")}>
                        <span className="inline-flex items-center">사업자번호<SortIcon active={sortKey === "business_number"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.payment_terms} colKey="payment_terms" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("payment_terms")}>
                        <span className="inline-flex items-center">결제조건<SortIcon active={sortKey === "payment_terms"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.lead_time_days} colKey="lead_time_days" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("lead_time_days")}>
                        <span className="inline-flex items-center">리드타임<SortIcon active={sortKey === "lead_time_days"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.is_active} colKey="is_active" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("is_active")}>
                        <span className="inline-flex items-center">상태<SortIcon active={sortKey === "is_active"} dir={sortDir} /></span>
                      </ResizableTh>
                      <ResizableTh width={widths.actions} colKey="actions" onResizeStart={onMouseDown}>관리</ResizableTh>
                    </TableRow>
                  </thead>
                  <TableBody>
                    {sorted.map((h) => (
                      <TableRow 
                        key={h.id}
                        className={cn(
                          "cursor-pointer hover:bg-zinc-50 transition-colors text-zinc-950",
                          selectedHospital?.id === h.id && "bg-primary/5 hover:bg-primary/10"
                        )}
                        onClick={() => {
                          setSelectedHospital(h);
                          setIsEditing(false);
                        }}
                      >
                        <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={rowSelection.selected.has(h.id)}
                            onCheckedChange={() => rowSelection.toggle(h.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs overflow-hidden text-ellipsis">{h.id}</TableCell>
                        <TableCell className="font-medium overflow-hidden text-ellipsis">{h.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm overflow-hidden text-ellipsis">{h.short_name || "-"}</TableCell>
                        <TableCell className="overflow-hidden text-ellipsis">
                          <Badge variant="outline" className="font-normal text-[10px] h-5">{TYPE_LABEL[h.hospital_type] || h.hospital_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm overflow-hidden text-ellipsis">{h.phone || "-"}</TableCell>
                        <TableCell className="text-sm overflow-hidden text-ellipsis">{h.contact_person || "-"}</TableCell>
                        <TableCell className="text-sm overflow-hidden text-ellipsis">{h.address || "-"}</TableCell>
                        <TableCell className="text-sm font-mono overflow-hidden text-ellipsis">{h.business_number || "-"}</TableCell>
                        <TableCell className="text-sm overflow-hidden text-ellipsis">{h.payment_terms || "-"}</TableCell>
                        <TableCell className="text-sm text-center overflow-hidden text-ellipsis">{h.lead_time_days ?? "-"}</TableCell>
                        <TableCell className="overflow-hidden text-ellipsis">
                          <Badge variant={h.is_active ? "default" : "secondary"} className="text-[10px] h-5">
                            {h.is_active ? "활성" : "비활성"}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(h.id)}>
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
                {sorted.map((h) => (
                  <Card key={h.id}
                    className={cn(
                      "cursor-pointer hover:border-primary/50 transition-all shadow-sm rounded-2xl",
                      selectedHospital?.id === h.id && "ring-2 ring-primary/20 border-primary"
                    )}
                    onClick={() => {
                      setSelectedHospital(h);
                      setIsEditing(false);
                    }}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-zinc-950">{h.name}</h3>
                        <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[h.hospital_type] || h.hospital_type}</Badge>
                      </div>
                      {h.short_name && <p className="text-[11px] text-muted-foreground truncate">약칭: {h.short_name}</p>}
                      {h.phone && <p className="text-[11px] text-zinc-500 flex items-center gap-1.5"><Phone className="h-3 w-3" /> {h.phone}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ResizablePanel>

          <ResizableDetailPanel
            isOpen={!!selectedHospital}
            onClose={() => {
              setSelectedHospital(null);
              setIsEditing(false);
            }}
            title={isEditing ? "거래처 정보 수정" : "거래처 상세 정보"}
            defaultSize={35}
          >
            {selectedHospital && (
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
                    <HospitalInlineForm 
                      hospital={selectedHospital} 
                      onCancel={() => setIsEditing(false)}
                      onSuccess={(updated) => {
                        setSelectedHospital(updated);
                        setIsEditing(false);
                        router.refresh();
                      }}
                    />
                  ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-xl font-black text-zinc-950">{selectedHospital.name}</h4>
                          <Badge variant="outline" className="text-[10px] py-0 font-bold">{TYPE_LABEL[selectedHospital.hospital_type] || selectedHospital.hospital_type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{selectedHospital.short_name || "별칭 없음"}</p>
                      </div>

                      <div className="grid gap-6">
                        <div className="space-y-3">
                          <Label className="text-[10px] uppercase tracking-widest text-zinc-400 font-black">비즈니스 정보</Label>
                          <div className="grid gap-4 pt-1">
                            <div className="flex items-start gap-3">
                              <UserIcon className="h-4 w-4 text-zinc-400 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-bold text-zinc-400">담당자</p>
                                <p className="text-sm font-semibold text-zinc-950">{selectedHospital.contact_person || "-"}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Building className="h-4 w-4 text-zinc-400 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-bold text-zinc-400">사업자번호</p>
                                <p className="text-sm font-semibold text-zinc-950 font-mono">{selectedHospital.business_number || "-"}</p>
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
                                <p className="text-sm font-semibold text-zinc-950">{selectedHospital.phone || "-"}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <MapPin className="h-4 w-4 text-zinc-400 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-bold text-zinc-400">주소</p>
                                <p className="text-sm font-semibold text-zinc-950 leading-relaxed">{selectedHospital.address || "-"}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-dashed">
                          <Label className="text-[10px] uppercase tracking-widest text-zinc-400 font-black">거래 조건</Label>
                          <div className="grid grid-cols-2 gap-4 pt-1">
                            <div className="flex items-start gap-3">
                              <CreditCard className="h-4 w-4 text-zinc-400 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-bold text-zinc-400">결제조건</p>
                                <p className="text-sm font-semibold text-zinc-950">{selectedHospital.payment_terms || "-"}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Clock className="h-4 w-4 text-zinc-400 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-bold text-zinc-400">리드타임</p>
                                <p className="text-sm font-semibold text-zinc-950">{selectedHospital.lead_time_days}일</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 font-black h-10 rounded-xl" onClick={() => setIsEditing(true)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> 수정하기
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1 font-black h-10 rounded-xl text-destructive hover:bg-destructive/5" onClick={() => setDeleteId(selectedHospital.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> 삭제
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="products" className="mt-0">
                  <PartnerProductManager partnerType="hospital" partnerId={selectedHospital.id} />
                </TabsContent>
              </Tabs>
            )}
          </ResizableDetailPanel>
        </PanelGroup>
      </div>

      <BulkActionBar
        count={rowSelection.count}
        onClear={rowSelection.clear}
        onDelete={() => deleteHospitals(Array.from(rowSelection.selected))}
        label="거래처"
      />

      <HospitalFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="거래처 추가"
      />

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>거래처 삭제</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">이 거래처를 비활성화하시겠습니까?</p>
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

function HospitalInlineForm({ 
  hospital, onCancel, onSuccess 
}: { 
  hospital: Hospital; 
  onCancel: () => void;
  onSuccess: (updated: Hospital) => void;
}) {
  const [isPending, startTransition] = useTransition();
  
  const [name, setName] = useState(hospital.name);
  const [shortName, setShortName] = useState(hospital.short_name || "");
  const [hospitalType, setHospitalType] = useState(hospital.hospital_type);
  const [phone, setPhone] = useState(hospital.phone || "");
  const [contactPerson, setContactPerson] = useState(hospital.contact_person || "");
  const [address, setAddress] = useState(hospital.address || "");
  const [businessNumber, setBusinessNumber] = useState(hospital.business_number || "");
  const [paymentTerms, setPaymentTerms] = useState(hospital.payment_terms || "");
  const [leadTimeDays, setLeadTimeDays] = useState(hospital.lead_time_days || 1);

  async function handleSave() {
    const data = {
      name, short_name: shortName, hospital_type: hospitalType,
      phone, contact_person: contactPerson, address, business_number: businessNumber,
      payment_terms: paymentTerms, lead_time_days: leadTimeDays
    };
    startTransition(async () => {
      try {
        await updateHospital(hospital.id, data);
        toast.success("저장되었습니다.");
        onSuccess({ ...hospital, ...data });
      } catch (err) {
        toast.error("저장 실패");
      }
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-black text-zinc-400">거래처명</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 font-bold rounded-xl" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black text-zinc-400">약칭</Label>
            <Input value={shortName} onChange={(e) => setShortName(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black text-zinc-400">유형</Label>
            <select 
              value={hospitalType} 
              onChange={(e) => setHospitalType(e.target.value as any)}
              className="w-full h-10 rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
            >
              {Object.entries(TYPE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black text-zinc-400">전화번호</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black text-zinc-400">담당자</Label>
            <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="h-10 rounded-xl" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-black text-zinc-400">사업자번호</Label>
          <Input value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} className="h-10 font-mono rounded-xl" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-black text-zinc-400">주소</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-10 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black text-zinc-400">결제조건</Label>
            <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black text-zinc-400">리드타임(일)</Label>
            <Input type="number" min={0} value={leadTimeDays} onChange={(e) => setLeadTimeDays(parseInt(e.target.value, 10))} className="h-10 rounded-xl" />
          </div>
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

export function HospitalFormDialog({
  open, onClose, title, hospital,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hospital?: Hospital;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get("name") as string,
      short_name: fd.get("short_name") as string || undefined,
      hospital_type: fd.get("hospital_type") as string,
      phone: fd.get("phone") as string || undefined,
      address: fd.get("address") as string || undefined,
      contact_person: fd.get("contact_person") as string || undefined,
      business_number: fd.get("business_number") as string || undefined,
      payment_terms: fd.get("payment_terms") as string || undefined,
      lead_time_days: parseInt(fd.get("lead_time_days") as string, 10) || 1,
    };

    startTransition(async () => {
      try {
        if (hospital) {
          await updateHospital(hospital.id, data);
          toast.success("거래처가 수정되었습니다.");
        } else {
          await createHospital(data);
          toast.success("거래처가 추가되었습니다.");
        }
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(`거래처 저장 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-black">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">거래처명 *</Label>
              <Input name="name" required defaultValue={hospital?.name || ""} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">약칭</Label>
              <Input name="short_name" defaultValue={hospital?.short_name || ""} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">유형</Label>
              <select name="hospital_type" defaultValue={hospital?.hospital_type || "hospital"} className="w-full h-10 rounded-xl border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-primary/20">
                {Object.entries(TYPE_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">전화번호</Label>
              <Input name="phone" defaultValue={hospital?.phone || ""} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">담당자</Label>
              <Input name="contact_person" defaultValue={hospital?.contact_person || ""} className="h-10 rounded-xl" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">주소</Label>
              <Input name="address" defaultValue={hospital?.address || ""} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">사업자번호</Label>
              <Input name="business_number" defaultValue={hospital?.business_number || ""} className="h-10 rounded-xl font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">결제조건</Label>
              <Input name="payment_terms" defaultValue={hospital?.payment_terms || ""} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-black text-zinc-400">리드타임(일)</Label>
              <Input name="lead_time_days" type="number" min={0} defaultValue={hospital?.lead_time_days || 1} className="h-10 rounded-xl" />
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

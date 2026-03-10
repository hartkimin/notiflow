"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
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
import { Plus, Pencil, Trash2, LayoutList, LayoutGrid, ArrowUp, ArrowDown, ArrowUpDown, Sparkles, Loader2 } from "lucide-react";
import { createSupplier, updateSupplier, deleteSupplier, deleteSuppliers } from "@/lib/actions";
import { toast } from "sonner";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { ResizableTh } from "@/components/resizable-th";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { useRowSelection } from "@/hooks/use-row-selection";
import type { Supplier } from "@/lib/types";

const SUPPLIER_COL_DEFAULTS: Record<string, number> = {
  checkbox: 40, id: 50, name: 150, short_name: 100, ceo_name: 100, phone: 120, business_type: 100, notes: 150, is_active: 70, actions: 90,
};

type SortKey = "id" | "name" | "short_name" | "ceo_name" | "phone" | "notes" | "is_active";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

export function SupplierSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const search = fd.get("search") as string;
    router.push(search ? `/suppliers?search=${encodeURIComponent(search)}` : "/suppliers");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        name="search"
        placeholder="공급사 검색..."
        defaultValue={searchParams.get("search") || ""}
        className="max-w-sm"
      />
      <Button type="submit" size="sm">검색</Button>
    </form>
  );
}

export function SupplierTable({ suppliers }: { suppliers: Supplier[] }) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { widths, onMouseDown } = useResizableColumns("suppliers", SUPPLIER_COL_DEFAULTS);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const allIds = useMemo(() => suppliers.map((s) => s.id), [suppliers]);
  const rowSelection = useRowSelection(allIds);

  function switchView(v: "list" | "grid") {
    setView(v);
    rowSelection.clear();
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
        router.refresh();
      } catch (err) {
        toast.error(`공급사 삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <div className="flex gap-1">
          <Button variant={view === "list" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => switchView("list")}>
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button variant={view === "grid" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => switchView("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> 공급사 추가
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">공급사가 없습니다.</p>
      ) : view === "list" ? (
        <div className="rounded-md border overflow-x-auto">
          <Table className="table-fixed">
            <thead className="[&_tr]:border-b">
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
                <TableRow key={s.id}>
                  <TableCell className="px-2">
                    <Checkbox
                      checked={rowSelection.selected.has(s.id)}
                      onCheckedChange={() => rowSelection.toggle(s.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs overflow-hidden text-ellipsis">{s.id}</TableCell>
                  <TableCell className="font-medium overflow-hidden text-ellipsis">
                    <Link href={`/suppliers/${s.id}`} className="hover:underline text-primary">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm overflow-hidden text-ellipsis">{s.short_name || "-"}</TableCell>
                  <TableCell className="text-sm overflow-hidden text-ellipsis">{s.ceo_name || "-"}</TableCell>
                  <TableCell className="text-sm overflow-hidden text-ellipsis">{s.phone || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground overflow-hidden text-ellipsis">
                    {s.business_type || s.business_category
                      ? [s.business_type, s.business_category].filter(Boolean).join(" / ")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground overflow-hidden text-ellipsis">{s.notes || "-"}</TableCell>
                  <TableCell className="overflow-hidden text-ellipsis">
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "활성" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem(s)}>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Link href={`/suppliers/${s.id}`} className="hover:underline text-primary">
                    <h3 className="font-medium">{s.name}</h3>
                  </Link>
                  <div className="flex items-center gap-1">
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "활성" : "비활성"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {s.short_name && (
                  <p className="text-sm text-muted-foreground">약칭: {s.short_name}</p>
                )}
                {s.ceo_name && (
                  <p className="text-sm text-muted-foreground">대표자: {s.ceo_name}</p>
                )}
                {s.phone && (
                  <p className="text-sm text-muted-foreground">전화: {s.phone}</p>
                )}
                {(s.business_type || s.business_category) && (
                  <p className="text-xs text-muted-foreground">
                    {[s.business_type, s.business_category].filter(Boolean).join(" / ")}
                  </p>
                )}
                {s.notes && (
                  <p className="text-sm text-muted-foreground">{s.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BulkActionBar
        count={rowSelection.count}
        onClear={rowSelection.clear}
        onDelete={() => deleteSuppliers(Array.from(rowSelection.selected))}
        label="공급사"
      />

      {/* Create Dialog */}
      <SupplierFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="공급사 추가"
      />

      {/* Edit Dialog */}
      {editItem && (
        <SupplierFormDialog
          open={!!editItem}
          onClose={() => setEditItem(null)}
          title="공급사 수정"
          supplier={editItem}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공급사 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">이 공급사를 비활성화하시겠습니까?</p>
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-3">
            {/* Row 1: Name + AI Search */}
            <div className="space-y-1">
              <Label>공급사명 *</Label>
              <div className="flex gap-2">
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="공급사명을 입력하세요"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isAiSearching || !name.trim()}
                  onClick={handleAiSearch}
                  className="shrink-0"
                >
                  {isAiSearching ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" />검색중</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-1" />AI 검색</>
                  )}
                </Button>
              </div>
            </div>

            {/* Row 2: Short Name + CEO */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>약칭</Label>
                <Input value={shortName} onChange={(e) => setShortName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>대표자명</Label>
                <Input value={ceoName} onChange={(e) => setCeoName(e.target.value)} />
              </div>
            </div>

            {/* Row 3: Business Number */}
            <div className="space-y-1">
              <Label>사업자등록번호</Label>
              <Input value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} placeholder="xxx-xx-xxxxx" />
            </div>

            {/* Row 4: Phone + Fax */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>전화번호</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>팩스번호</Label>
                <Input value={fax} onChange={(e) => setFax(e.target.value)} />
              </div>
            </div>

            {/* Row 5: Address */}
            <div className="space-y-1">
              <Label>주소</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            {/* Row 6: Website */}
            <div className="space-y-1">
              <Label>홈페이지</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </div>

            {/* Row 7: Business Type + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>업태</Label>
                <Input value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>종목</Label>
                <Input value={businessCategory} onChange={(e) => setBusinessCategory(e.target.value)} />
              </div>
            </div>

            {/* Row 8: Notes */}
            <div className="space-y-1">
              <Label>비고</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>취소</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "저장중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

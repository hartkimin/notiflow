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
import { Plus, Pencil, Trash2, LayoutList, LayoutGrid, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { createHospital, updateHospital, deleteHospital } from "@/lib/actions";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { ResizableTh } from "@/components/resizable-th";
import type { Hospital } from "@/lib/types";

const HOSPITAL_COL_DEFAULTS: Record<string, number> = {
  id: 50, name: 140, short_name: 90, hospital_type: 80, phone: 120,
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

export function HospitalSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const search = fd.get("search") as string;
    router.push(search ? `/hospitals?search=${encodeURIComponent(search)}` : "/hospitals");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        name="search"
        placeholder="거래처 검색..."
        defaultValue={searchParams.get("search") || ""}
        className="max-w-sm"
      />
      <Button type="submit" size="sm">검색</Button>
    </form>
  );
}

export function HospitalTable({ hospitals }: { hospitals: Hospital[] }) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { widths, onMouseDown } = useResizableColumns("hospitals", HOSPITAL_COL_DEFAULTS);
  const [editItem, setEditItem] = useState<Hospital | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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
      await deleteHospital(id);
      setDeleteId(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <div className="flex gap-1">
          <Button variant={view === "list" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setView("list")}>
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button variant={view === "grid" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setView("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> 거래처 추가
        </Button>
      </div>

      {hospitals.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">거래처가 없습니다.</p>
      ) : view === "list" ? (
        <div className="rounded-md border overflow-x-auto">
          <Table className="table-fixed">
            <thead className="[&_tr]:border-b">
              <TableRow>
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
                <TableRow key={h.id}>
                  <TableCell className="font-mono text-xs overflow-hidden text-ellipsis">{h.id}</TableCell>
                  <TableCell className="font-medium overflow-hidden text-ellipsis">{h.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm overflow-hidden text-ellipsis">{h.short_name || "-"}</TableCell>
                  <TableCell className="overflow-hidden text-ellipsis">
                    <Badge variant="outline">{TYPE_LABEL[h.hospital_type] || h.hospital_type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm overflow-hidden text-ellipsis">{h.phone || "-"}</TableCell>
                  <TableCell className="text-sm overflow-hidden text-ellipsis">{h.contact_person || "-"}</TableCell>
                  <TableCell className="text-sm overflow-hidden text-ellipsis">{h.address || "-"}</TableCell>
                  <TableCell className="text-sm font-mono overflow-hidden text-ellipsis">{h.business_number || "-"}</TableCell>
                  <TableCell className="text-sm overflow-hidden text-ellipsis">{h.payment_terms || "-"}</TableCell>
                  <TableCell className="text-sm text-center overflow-hidden text-ellipsis">{h.lead_time_days ?? "-"}</TableCell>
                  <TableCell className="overflow-hidden text-ellipsis">
                    <Badge variant={h.is_active ? "default" : "secondary"}>
                      {h.is_active ? "활성" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem(h)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((h) => (
            <Card key={h.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{h.name}</h3>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{TYPE_LABEL[h.hospital_type] || h.hospital_type}</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem(h)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(h.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {h.short_name && <p className="text-xs text-muted-foreground">약칭: {h.short_name}</p>}
                {h.phone && <p className="text-sm text-muted-foreground">{h.phone}</p>}
                {h.address && <p className="text-xs text-muted-foreground">{h.address}</p>}
                {h.contact_person && (
                  <p className="text-xs text-muted-foreground">담당: {h.contact_person}</p>
                )}
                {h.business_number && (
                  <p className="text-xs text-muted-foreground">사업자: {h.business_number}</p>
                )}
                {h.payment_terms && (
                  <p className="text-xs text-muted-foreground">결제: {h.payment_terms}</p>
                )}
                {h.lead_time_days > 0 && (
                  <p className="text-xs text-muted-foreground">리드타임: {h.lead_time_days}일</p>
                )}
                <Badge variant={h.is_active ? "default" : "secondary"} className="text-xs">
                  {h.is_active ? "활성" : "비활성"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <HospitalFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="거래처 추가"
      />

      {/* Edit Dialog */}
      {editItem && (
        <HospitalFormDialog
          open={!!editItem}
          onClose={() => setEditItem(null)}
          title="거래처 수정"
          hospital={editItem}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>거래처 삭제</DialogTitle>
          </DialogHeader>
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

function HospitalFormDialog({
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
      if (hospital) {
        await updateHospital(hospital.id, data);
      } else {
        await createHospital(data);
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>거래처명 *</Label>
              <Input name="name" required defaultValue={hospital?.name || ""} />
            </div>
            <div className="space-y-1">
              <Label>약칭</Label>
              <Input name="short_name" defaultValue={hospital?.short_name || ""} />
            </div>
            <div className="space-y-1">
              <Label>유형</Label>
              <select name="hospital_type" defaultValue={hospital?.hospital_type || "hospital"} className="w-full rounded-md border px-3 py-2 text-sm bg-background">
                {Object.entries(TYPE_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>전화번호</Label>
              <Input name="phone" defaultValue={hospital?.phone || ""} />
            </div>
            <div className="space-y-1">
              <Label>담당자</Label>
              <Input name="contact_person" defaultValue={hospital?.contact_person || ""} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>주소</Label>
              <Input name="address" defaultValue={hospital?.address || ""} />
            </div>
            <div className="space-y-1">
              <Label>사업자번호</Label>
              <Input name="business_number" defaultValue={hospital?.business_number || ""} />
            </div>
            <div className="space-y-1">
              <Label>결제조건</Label>
              <Input name="payment_terms" defaultValue={hospital?.payment_terms || ""} />
            </div>
            <div className="space-y-1">
              <Label>리드타임(일)</Label>
              <Input name="lead_time_days" type="number" min={0} defaultValue={hospital?.lead_time_days || 1} />
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

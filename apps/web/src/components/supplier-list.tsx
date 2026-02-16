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
import { createSupplier, updateSupplier, deleteSupplier } from "@/lib/actions";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { ResizableTh } from "@/components/resizable-th";
import type { Supplier } from "@/lib/types";

const SUPPLIER_COL_DEFAULTS: Record<string, number> = {
  id: 50, name: 150, short_name: 100, contact_info: 160, notes: 150, is_active: 70, actions: 90,
};

type SortKey = "id" | "name" | "short_name" | "notes" | "is_active";
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
      await deleteSupplier(id);
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
                <ResizableTh width={widths.id} colKey="id" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("id")}>
                  <span className="inline-flex items-center">ID<SortIcon active={sortKey === "id"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.name} colKey="name" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  <span className="inline-flex items-center">공급사명<SortIcon active={sortKey === "name"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.short_name} colKey="short_name" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("short_name")}>
                  <span className="inline-flex items-center">약칭<SortIcon active={sortKey === "short_name"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.contact_info} colKey="contact_info" onResizeStart={onMouseDown}>연락처</ResizableTh>
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
                  <TableCell className="font-mono text-xs overflow-hidden text-ellipsis">{s.id}</TableCell>
                  <TableCell className="font-medium overflow-hidden text-ellipsis">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm overflow-hidden text-ellipsis">{s.short_name || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground overflow-hidden text-ellipsis">
                    {s.contact_info ? Object.entries(s.contact_info).map(([k, v]) => (
                      <span key={k} className="block">{k}: {String(v)}</span>
                    )) : "-"}
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
                  <h3 className="font-medium">{s.name}</h3>
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
                {s.contact_info && Object.keys(s.contact_info).length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {Object.entries(s.contact_info).map(([k, v]) => (
                      <p key={k}>{k}: {String(v)}</p>
                    ))}
                  </div>
                )}
                {s.notes && (
                  <p className="text-sm text-muted-foreground">{s.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get("name") as string,
      short_name: fd.get("short_name") as string || undefined,
      notes: fd.get("notes") as string || undefined,
    };

    startTransition(async () => {
      if (supplier) {
        await updateSupplier(supplier.id, data);
      } else {
        await createSupplier(data);
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>공급사명 *</Label>
              <Input name="name" required defaultValue={supplier?.name || ""} />
            </div>
            <div className="space-y-1">
              <Label>약칭</Label>
              <Input name="short_name" defaultValue={supplier?.short_name || ""} />
            </div>
            <div className="space-y-1">
              <Label>비고</Label>
              <Input name="notes" defaultValue={supplier?.notes || ""} />
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

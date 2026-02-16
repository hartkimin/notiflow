"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Tags, LayoutList, LayoutGrid, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import {
  createProduct, updateProduct, deleteProduct,
  getProductAliases, createProductAlias, updateProductAlias, deleteProductAlias,
} from "@/lib/actions";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { ResizableTh } from "@/components/resizable-th";
import type { Product, ProductAlias, Hospital } from "@/lib/types";

const PRODUCT_COL_DEFAULTS: Record<string, number> = {
  id: 50, official_name: 180, short_name: 90, category: 100, manufacturer: 100,
  unit: 60, unit_price: 90, standard_code: 110, is_active: 70, actions: 110,
};

const CATEGORY_LABEL: Record<string, string> = {
  dialyzer: "다이알라이저",
  blood_line: "블러드라인",
  avf_needle: "AVF니들",
  dialysis_solution: "투석액",
  filter: "필터",
  medication: "약품",
  consumable: "소모품",
  equipment: "장비",
};

type SortKey = "id" | "official_name" | "short_name" | "category" | "manufacturer" | "unit" | "unit_price" | "standard_code" | "is_active";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

export function ProductSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const search = fd.get("search") as string;
    const category = fd.get("category") as string;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    const qs = params.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap">
      <Input
        name="search"
        placeholder="품목명 검색..."
        defaultValue={searchParams.get("search") || ""}
        className="max-w-sm"
      />
      <select
        name="category"
        defaultValue={searchParams.get("category") || ""}
        className="rounded-md border px-3 py-2 text-sm bg-background"
      >
        <option value="">전체 카테고리</option>
        {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      <Button type="submit" size="sm">검색</Button>
    </form>
  );
}

export function ProductTable({ products, hospitals }: { products: Product[]; hospitals: Hospital[] }) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("official_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { widths, onMouseDown } = useResizableColumns("products", PRODUCT_COL_DEFAULTS);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [aliasProduct, setAliasProduct] = useState<Product | null>(null);
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
    return [...products].sort((a, b) => {
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
  }, [products, sortKey, sortDir]);

  function handleDelete(id: number) {
    startTransition(async () => {
      await deleteProduct(id);
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
          <Plus className="h-4 w-4 mr-1" /> 품목 추가
        </Button>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">품목이 없습니다.</p>
      ) : view === "list" ? (
        <div className="rounded-md border overflow-x-auto">
          <Table className="table-fixed">
            <thead className="[&_tr]:border-b">
              <TableRow>
                <ResizableTh width={widths.id} colKey="id" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("id")}>
                  <span className="inline-flex items-center">ID<SortIcon active={sortKey === "id"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.official_name} colKey="official_name" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("official_name")}>
                  <span className="inline-flex items-center">품목명<SortIcon active={sortKey === "official_name"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.short_name} colKey="short_name" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("short_name")}>
                  <span className="inline-flex items-center">약칭<SortIcon active={sortKey === "short_name"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.category} colKey="category" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("category")}>
                  <span className="inline-flex items-center">카테고리<SortIcon active={sortKey === "category"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.manufacturer} colKey="manufacturer" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("manufacturer")}>
                  <span className="inline-flex items-center">제조사<SortIcon active={sortKey === "manufacturer"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.unit} colKey="unit" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("unit")}>
                  <span className="inline-flex items-center">단위<SortIcon active={sortKey === "unit"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.unit_price} colKey="unit_price" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("unit_price")}>
                  <span className="inline-flex items-center">단가<SortIcon active={sortKey === "unit_price"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.standard_code} colKey="standard_code" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("standard_code")}>
                  <span className="inline-flex items-center">표준코드<SortIcon active={sortKey === "standard_code"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.is_active} colKey="is_active" onResizeStart={onMouseDown} className="cursor-pointer select-none" onClick={() => toggleSort("is_active")}>
                  <span className="inline-flex items-center">상태<SortIcon active={sortKey === "is_active"} dir={sortDir} /></span>
                </ResizableTh>
                <ResizableTh width={widths.actions} colKey="actions" onResizeStart={onMouseDown}>관리</ResizableTh>
              </TableRow>
            </thead>
            <TableBody>
              {sorted.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs overflow-hidden text-ellipsis">{p.id}</TableCell>
                  <TableCell className="font-medium overflow-hidden text-ellipsis">{p.official_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm overflow-hidden text-ellipsis">{p.short_name || "-"}</TableCell>
                  <TableCell className="overflow-hidden text-ellipsis">
                    <Badge variant="outline">
                      {CATEGORY_LABEL[p.category] || p.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs overflow-hidden text-ellipsis">{p.manufacturer || "-"}</TableCell>
                  <TableCell className="text-sm overflow-hidden text-ellipsis">{p.unit || "-"}</TableCell>
                  <TableCell className="text-sm text-right font-mono overflow-hidden text-ellipsis">{p.unit_price != null ? p.unit_price.toLocaleString() : "-"}</TableCell>
                  <TableCell className="text-xs font-mono overflow-hidden text-ellipsis">{p.standard_code || "-"}</TableCell>
                  <TableCell className="overflow-hidden text-ellipsis">
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "활성" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="별칭 관리" onClick={() => setAliasProduct(p)}>
                        <Tags className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm leading-tight truncate">{p.official_name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.short_name || "-"}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {CATEGORY_LABEL[p.category] || p.category}
                  </Badge>
                </div>
                {p.unit && <p className="text-xs text-muted-foreground">단위: {p.unit}</p>}
                {p.unit_price != null && <p className="text-xs text-muted-foreground">단가: {p.unit_price.toLocaleString()}원</p>}
                {p.standard_code && <p className="text-xs text-muted-foreground font-mono">표준코드: {p.standard_code}</p>}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground">{p.manufacturer || "-"}</p>
                    <Badge variant={p.is_active ? "default" : "secondary"} className="text-xs">
                      {p.is_active ? "활성" : "비활성"}
                    </Badge>
                  </div>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="별칭 관리" onClick={() => setAliasProduct(p)}>
                      <Tags className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <ProductFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="품목 추가"
      />

      {/* Edit Dialog */}
      {editItem && (
        <ProductFormDialog
          open={!!editItem}
          onClose={() => setEditItem(null)}
          title="품목 수정"
          product={editItem}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>품목 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">이 품목을 비활성화하시겠습니까?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>취소</Button>
            <Button variant="destructive" disabled={isPending} onClick={() => deleteId && handleDelete(deleteId)}>
              {isPending ? "삭제중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alias Management Dialog */}
      {aliasProduct && (
        <AliasDialog
          open={!!aliasProduct}
          onClose={() => setAliasProduct(null)}
          product={aliasProduct}
          hospitals={hospitals}
        />
      )}
    </>
  );
}

function ProductFormDialog({
  open, onClose, title, product,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  product?: Product;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      official_name: fd.get("official_name") as string,
      short_name: fd.get("short_name") as string || undefined,
      category: fd.get("category") as string,
      manufacturer: fd.get("manufacturer") as string || undefined,
      ingredient: fd.get("ingredient") as string || undefined,
      standard_code: fd.get("standard_code") as string || undefined,
      unit: fd.get("unit") as string || undefined,
      unit_price: fd.get("unit_price") ? parseFloat(fd.get("unit_price") as string) : undefined,
    };

    startTransition(async () => {
      if (product) {
        await updateProduct(product.id, data);
      } else {
        await createProduct(data);
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
              <Label>품목명 *</Label>
              <Input name="official_name" required defaultValue={product?.official_name || ""} />
            </div>
            <div className="space-y-1">
              <Label>약칭</Label>
              <Input name="short_name" defaultValue={product?.short_name || ""} />
            </div>
            <div className="space-y-1">
              <Label>카테고리</Label>
              <select name="category" defaultValue={product?.category || "consumable"} className="w-full rounded-md border px-3 py-2 text-sm bg-background">
                {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>제조사</Label>
              <Input name="manufacturer" defaultValue={product?.manufacturer || ""} />
            </div>
            <div className="space-y-1">
              <Label>단위</Label>
              <Input name="unit" defaultValue={product?.unit || "개"} />
            </div>
            <div className="space-y-1">
              <Label>단가</Label>
              <Input name="unit_price" type="number" min={0} step="any" defaultValue={product?.unit_price ?? ""} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>성분</Label>
              <Input name="ingredient" defaultValue={product?.ingredient || ""} />
            </div>
            <div className="space-y-1">
              <Label>표준코드</Label>
              <Input name="standard_code" defaultValue={product?.standard_code || ""} />
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

/* ── Alias Management Dialog ── */

function AliasDialog({
  open, onClose, product, hospitals,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  hospitals: Hospital[];
}) {
  const [aliases, setAliases] = useState<ProductAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editAlias, setEditAlias] = useState<ProductAlias | null>(null);
  const [isPending, startTransition] = useTransition();

  const hospitalMap = new Map(hospitals.map(h => [h.id, h.name]));

  function loadAliases() {
    setLoading(true);
    getProductAliases(product.id).then((aliases) => {
      setAliases(aliases || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => { if (open) loadAliases(); }, [open]);

  function handleDelete(aliasId: number) {
    startTransition(async () => {
      await deleteProductAlias(product.id, aliasId);
      loadAliases();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            별칭 관리 — {product.official_name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            병원별로 다른 약칭을 등록할 수 있습니다.
          </p>
          <Button size="sm" onClick={() => { setEditAlias(null); setShowAdd(true); }}>
            <Plus className="h-4 w-4 mr-1" /> 별칭 추가
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <p className="text-sm text-center py-4">로딩중...</p>
          ) : aliases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">등록된 별칭이 없습니다.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>별칭</TableHead>
                    <TableHead>적용 거래처</TableHead>
                    <TableHead>출처</TableHead>
                    <TableHead className="w-[80px]">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aliases.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.alias}</TableCell>
                      <TableCell>
                        {a.hospital_id ? (
                          <Badge variant="outline">{hospitalMap.get(a.hospital_id) || `#${a.hospital_id}`}</Badge>
                        ) : (
                          <Badge variant="secondary">글로벌</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.source || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditAlias(a); setShowAdd(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={isPending} onClick={() => handleDelete(a.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
        </DialogFooter>

        {/* Add/Edit Alias Sub-dialog */}
        {showAdd && (
          <AliasFormDialog
            open={showAdd}
            onClose={() => { setShowAdd(false); setEditAlias(null); }}
            productId={product.id}
            hospitals={hospitals}
            alias={editAlias}
            onSaved={loadAliases}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AliasFormDialog({
  open, onClose, productId, hospitals, alias, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  productId: number;
  hospitals: Hospital[];
  alias: ProductAlias | null;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const aliasText = fd.get("alias") as string;
    const hospitalId = fd.get("hospital_id") as string;

    startTransition(async () => {
      if (alias) {
        await updateProductAlias(productId, alias.id, {
          alias: aliasText,
          hospital_id: hospitalId ? parseInt(hospitalId, 10) : null,
        });
      } else {
        await createProductAlias(productId, {
          alias: aliasText,
          hospital_id: hospitalId ? parseInt(hospitalId, 10) : null,
        });
      }
      onSaved();
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{alias ? "별칭 수정" : "별칭 추가"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>별칭 *</Label>
            <Input name="alias" required defaultValue={alias?.alias || ""} placeholder="병원에서 사용하는 품목명" />
          </div>
          <div className="space-y-1">
            <Label>적용 거래처</Label>
            <select
              name="hospital_id"
              defaultValue={alias?.hospital_id?.toString() || ""}
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
            >
              <option value="">글로벌 (모든 거래처)</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
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

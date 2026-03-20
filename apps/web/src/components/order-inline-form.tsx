"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PlusCircle,
  X,
  Loader2,
  Settings2,
  Plus,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalSearchBox } from "@/components/portal-search-box";
import { matchesChosungSearch } from "@/lib/chosung";
import {
  getRecentHospitalsAction,
  getRecentPartnerProductsAction,
  getRecentMfdsItemsAction,
  searchMfdsItemsAction,
  searchHospitalsAction,
  getPartnerProductsForOrderAction,
  createOrderWithDetailsAction,
} from "@/app/(dashboard)/orders/actions";
import { saveColumnWidthsAction } from "@/app/(dashboard)/settings/actions";

// ── Types ──────────────────────────────────────────────────

interface PartnerProduct {
  id: number;
  product_source: "drug" | "device" | "product";
  product_id: number;
  name: string;
  code: string;
  unit_price: number | null;
}

interface LineItem {
  key: string;
  product_id: number;
  product_name: string;
  standard_code: string | null;
  source_type: "drug" | "device" | "product";
  quantity: number;
  unit_price: number | null;
  kpis_number: string;
  sales_rep: string;
}

interface OrderInlineFormProps {
  displayColumns: { drug: string[]; device: string[] };
  columnWidths?: Record<string, number>;
  initialNotes?: string;
  sourceMessageId?: string;
}

// ── Optional column definitions ────────────────────────────

const OPTIONAL_COLUMNS = [
  { id: "kpis", label: "KPIS" },
  { id: "sales_rep", label: "영업담당자" },
];

let _keyCounter = 0;
function nextKey() { return `oi-${Date.now()}-${++_keyCounter}`; }

// ── Main Component ─────────────────────────────────────────

export function OrderInlineForm({
  columnWidths,
  initialNotes,
  sourceMessageId,
}: OrderInlineFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(!!initialNotes);

  // ── Header state ──
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [hospitalName, setHospitalName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [notes, setNotes] = useState(initialNotes ?? "");

  // ── Partner products ──
  const [partnerProducts, setPartnerProducts] = useState<PartnerProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // ── Line items ──
  const [items, setItems] = useState<LineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Optional columns visibility ──
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());
  const [showColSettings, setShowColSettings] = useState(false);

  // ── Column widths (resizable) ──
  const [colWidths, setColWidths] = useState<Record<string, number>>(columnWidths ?? {});
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);
  const lastSavedWidths = useRef<Record<string, number>>(columnWidths ?? {});
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleResizeStart = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const th = (e.target as HTMLElement).closest("th");
    const startW = th?.offsetWidth ?? 100;
    resizingRef.current = { col, startX, startW };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = ev.clientX - resizingRef.current.startX;
      const newW = Math.max(40, resizingRef.current.startW + diff);
      setColWidths((prev) => ({ ...prev, [resizingRef.current!.col]: newW }));
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setColWidths((current) => {
          if (JSON.stringify(current) !== JSON.stringify(lastSavedWidths.current)) {
            lastSavedWidths.current = { ...current };
            saveColumnWidthsAction(current);
          }
          return current;
        });
      }, 500);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  // ── Load partner products for selected hospital ──
  useEffect(() => {
    if (!hospitalId) { setPartnerProducts([]); return; }
    setProductsLoading(true);
    getPartnerProductsForOrderAction(hospitalId)
      .then((ppList) => setPartnerProducts(ppList))
      .finally(() => setProductsLoading(false));
  }, [hospitalId]);

  // ── Total price ──
  const totalPrice = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.unit_price ?? 0) * item.quantity, 0);
  }, [items]);

  // ── Toggle optional column ──
  function toggleCol(id: string) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Add partner product to line items ──
  function addProduct(pp: PartnerProduct) {
    const dupKey = `${pp.product_source}-${pp.product_id}`;
    if (items.some((i) => `${i.source_type}-${i.product_id}` === dupKey)) {
      toast.error("이미 추가된 품목입니다");
      return;
    }
    setItems((prev) => [...prev, {
      key: nextKey(),
      product_id: pp.product_id,
      product_name: pp.name,
      standard_code: pp.code || null,
      source_type: pp.product_source,
      quantity: 1,
      unit_price: pp.unit_price,
      kpis_number: "",
      sales_rep: "",
    }]);
  }

  // ── Add MFDS item ──
  interface MfdsSearchResult { id: number; name: string; code: string; source_type: "drug" | "device_std"; manufacturer?: string | null; }

  function addMfdsItem(item: MfdsSearchResult) {
    const sourceType = item.source_type === "device_std" ? "device" : "drug";
    if (items.some((i) => `${i.source_type}-${i.product_id}` === `${sourceType}-${item.id}`)) {
      toast.error("이미 추가된 품목입니다");
      return;
    }
    setItems((prev) => [...prev, {
      key: nextKey(),
      product_id: item.id,
      product_name: item.name,
      standard_code: item.code || null,
      source_type: sourceType as "drug" | "device",
      quantity: 1,
      unit_price: null,
      kpis_number: "",
      sales_rep: "",
    }]);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateItem(key: string, updates: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => i.key === key ? { ...i, ...updates } : i));
  }

  // ── Portal search helpers ──
  const fetchRecentPartnerProducts = useCallback(
    () => getRecentPartnerProductsAction(hospitalId!),
    [hospitalId]
  );

  const searchPartnerProductsLocal = useCallback(
    async (query: string) => {
      return partnerProducts.filter((pp) =>
        matchesChosungSearch(pp.name, query) || (pp.code ?? "").toLowerCase().includes(query.toLowerCase())
      );
    },
    [partnerProducts]
  );

  interface PartnerProductItem { id: number; product_source: string; product_id: number; name: string; code: string; unit_price: number | null; }

  function addPartnerProduct(pp: PartnerProductItem) {
    addProduct(pp as PartnerProduct);
  }

  function renderProductItem(item: PartnerProductItem) {
    return (
      <div className="flex items-center gap-2 w-full">
        <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 shrink-0 ${
          item.product_source === "drug" ? "text-blue-600 bg-blue-50 border-blue-200" : "text-emerald-600 bg-emerald-50 border-emerald-200"
        }`}>
          {item.product_source === "drug" ? "약" : "기기"}
        </Badge>
        <span className="font-medium truncate">{item.name}</span>
        {item.unit_price != null && (
          <span className="text-xs text-muted-foreground ml-auto shrink-0">{item.unit_price.toLocaleString()}원</span>
        )}
      </div>
    );
  }

  function renderMfdsItem(item: MfdsSearchResult) {
    const isDrug = item.source_type !== "device_std";
    return (
      <div className="flex items-center gap-2 w-full">
        <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 shrink-0 ${
          isDrug ? "text-blue-600 bg-blue-50 border-blue-200" : "text-emerald-600 bg-emerald-50 border-emerald-200"
        }`}>
          {isDrug ? "약" : "기기"}
        </Badge>
        <span className="font-medium truncate">{item.name}</span>
        {item.code && <span className="text-xs text-muted-foreground ml-auto shrink-0">{item.code}</span>}
      </div>
    );
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!hospitalId) { toast.error("거래처를 선택해주세요"); return; }
    if (items.length === 0) { toast.error("품목을 추가해주세요"); return; }
    setIsSubmitting(true);
    try {
      const result = await createOrderWithDetailsAction({
        hospital_id: hospitalId,
        order_date: orderDate,
        delivery_date: deliveryDate || null,
        delivered_at: deliveredAt || null,
        notes: notes || null,
        source_message_id: sourceMessageId ?? null,
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          source_type: i.source_type,
          supplier_id: null,
          quantity: i.quantity,
          unit_type: "piece",
          purchase_price: null,
          unit_price: i.unit_price,
          kpis_reference_number: i.kpis_number || null,
          sales_rep: i.sales_rep || null,
        })),
      });
      toast.success(`주문이 생성되었습니다 (${result.orderNumber})`);
      resetForm();
      if (sourceMessageId) router.replace("/orders");
    } catch (err) {
      toast.error("주문 생성 실패: " + (err as Error).message);
    } finally { setIsSubmitting(false); }
  }

  function resetForm() {
    setIsOpen(false);
    setHospitalId(null);
    setHospitalName("");
    setItems([]);
    setNotes("");
    setDeliveryDate("");
    setDeliveredAt("");
    setPartnerProducts([]);
  }

  function handleClose(open: boolean) {
    if (!open) { if (sourceMessageId) router.replace("/orders"); resetForm(); }
    setIsOpen(open);
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setIsOpen(true)} className="gap-1.5">
        <PlusCircle className="h-4 w-4" />
        새 주문
      </Button>

      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
          <div className="max-w-5xl mx-auto">
            <SheetHeader className="pb-3">
              <SheetTitle className="flex items-center gap-2 text-base">
                <PlusCircle className="h-4 w-4" />
                새 주문 생성
                {sourceMessageId && <Badge variant="secondary" className="text-xs font-normal">메시지에서</Badge>}
              </SheetTitle>
            </SheetHeader>

            {/* ── Top row: hospital + dates ── */}
            <div className="flex flex-wrap items-end gap-3 pb-4 border-b">
              <div className="space-y-1 min-w-[250px]">
                <Label className="text-xs">거래처</Label>
                {hospitalId ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm py-0.5 px-2">{hospitalName}</Badge>
                    <button type="button" onClick={() => { setHospitalId(null); setHospitalName(""); setPartnerProducts([]); }} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <PortalSearchBox
                    placeholder="거래처 검색..."
                    fetchRecent={getRecentHospitalsAction}
                    searchAction={searchHospitalsAction}
                    onSelect={(h) => { setHospitalId(h.id); setHospitalName(h.name); }}
                    className="w-full"
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">주문일</Label>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="h-8 text-sm w-[140px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">예상배송</Label>
                <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="h-8 text-sm w-[140px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">실배송</Label>
                <Input type="date" value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)} className="h-8 text-sm w-[140px]" />
              </div>
            </div>

            {/* ── Product search tabs ── */}
            <div className="py-3 border-b">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                품목 추가
              </h3>

              <Tabs defaultValue={hospitalId ? "partner" : "mfds"} className="space-y-2">
                <TabsList>
                  <TabsTrigger value="partner" className="text-xs" disabled={!hospitalId}>
                    거래처 품목
                    {partnerProducts.length > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 ml-1.5">
                        {partnerProducts.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="mfds" className="text-xs">식약처 아이템</TabsTrigger>
                </TabsList>

                <TabsContent value="partner">
                  {!hospitalId ? (
                    <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                      먼저 거래처를 선택하세요
                    </p>
                  ) : productsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <PortalSearchBox
                      placeholder="거래처 등록 품목 검색..."
                      fetchRecent={fetchRecentPartnerProducts}
                      searchAction={searchPartnerProductsLocal}
                      onSelect={addPartnerProduct}
                      renderItem={renderProductItem}
                    />
                  )}
                </TabsContent>

                <TabsContent value="mfds">
                  <PortalSearchBox
                    placeholder="식약처 품목 검색 (품목명, 코드, 업체명)..."
                    fetchRecent={getRecentMfdsItemsAction}
                    searchAction={searchMfdsItemsAction}
                    onSelect={addMfdsItem}
                    renderItem={renderMfdsItem}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* ── Items table ── */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">
                  주문 품목 {items.length > 0 && <span className="text-muted-foreground font-normal">({items.length}건)</span>}
                </h3>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-muted-foreground h-7"
                    onClick={() => setShowColSettings(!showColSettings)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    컬럼
                  </Button>
                  {showColSettings && (
                    <div className="absolute right-0 top-8 z-10 bg-white border rounded-lg shadow-lg p-2 min-w-[140px] animate-in fade-in zoom-in-95 duration-100">
                      {OPTIONAL_COLUMNS.map((col) => (
                        <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleCols.has(col.id)}
                            onChange={() => toggleCol(col.id)}
                            className="rounded border-gray-300"
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground border rounded-md border-dashed">
                  위에서 품목을 검색하여 추가하세요
                </div>
              ) : (
                <div className="border rounded-md overflow-x-auto">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[11px] relative" style={{ width: colWidths["no"] ?? 36 }}>
                          #
                          <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("no", e)} />
                        </TableHead>
                        <TableHead className="text-[11px] relative" style={{ width: colWidths["type"] ?? 45 }}>
                          유형
                          <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("type", e)} />
                        </TableHead>
                        <TableHead className="text-[11px] relative" style={{ width: colWidths["name"] ?? 200 }}>
                          품목명
                          <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("name", e)} />
                        </TableHead>
                        <TableHead className="text-[11px] text-right relative" style={{ width: colWidths["qty"] ?? 65 }}>
                          수량
                          <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("qty", e)} />
                        </TableHead>
                        <TableHead className="text-[11px] text-right relative" style={{ width: colWidths["unit_price"] ?? 85 }}>
                          단가
                          <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("unit_price", e)} />
                        </TableHead>
                        <TableHead className="text-[11px] text-right relative" style={{ width: colWidths["amount"] ?? 90 }}>
                          소계
                          <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("amount", e)} />
                        </TableHead>
                        {visibleCols.has("kpis") && (
                          <TableHead className="text-[11px] relative" style={{ width: colWidths["kpis"] ?? 100 }}>
                            KPIS
                            <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("kpis", e)} />
                          </TableHead>
                        )}
                        {visibleCols.has("sales_rep") && (
                          <TableHead className="text-[11px] relative" style={{ width: colWidths["sales_rep"] ?? 100 }}>
                            영업담당자
                            <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("sales_rep", e)} />
                          </TableHead>
                        )}
                        <TableHead className="text-[11px] w-[32px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => {
                        const subtotal = (item.unit_price ?? 0) * item.quantity;
                        return (
                          <TableRow key={item.key}>
                            <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 shrink-0 ${
                                item.source_type === "drug" ? "text-blue-600 bg-blue-50 border-blue-200"
                                  : item.source_type === "device" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                                  : "text-gray-500 bg-gray-50 border-gray-200"
                              }`}>
                                {item.source_type === "drug" ? "약" : item.source_type === "device" ? "기기" : "기타"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[11px] truncate overflow-hidden" title={item.product_name}>
                              <span className="font-medium">{item.product_name}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number" min={1} value={item.quantity}
                                onChange={(e) => updateItem(item.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                className="w-[55px] h-7 text-xs text-right ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number" min={0} value={item.unit_price ?? ""}
                                onChange={(e) => updateItem(item.key, { unit_price: e.target.value ? parseFloat(e.target.value) : null })}
                                placeholder="0" className="w-[75px] h-7 text-xs text-right ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-[11px] text-right tabular-nums font-medium">
                              {subtotal > 0 ? subtotal.toLocaleString() : "-"}
                            </TableCell>
                            {visibleCols.has("kpis") && (
                              <TableCell>
                                <Input
                                  value={item.kpis_number}
                                  onChange={(e) => updateItem(item.key, { kpis_number: e.target.value.slice(0, 100) })}
                                  placeholder="KPIS No."
                                  className="w-[90px] h-7 text-xs"
                                />
                              </TableCell>
                            )}
                            {visibleCols.has("sales_rep") && (
                              <TableCell>
                                <Input
                                  value={item.sales_rep}
                                  onChange={(e) => updateItem(item.key, { sales_rep: e.target.value.slice(0, 100) })}
                                  placeholder="담당자"
                                  className="h-7 w-full text-xs"
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(item.key)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* ── Totals row ── */}
                      <TableRow className="bg-muted/40 font-semibold border-t-2">
                        <TableCell className="text-xs" />
                        <TableCell />
                        <TableCell className="text-xs">합계</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {items.reduce((s, i) => s + i.quantity, 0)}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right text-xs tabular-nums font-bold">
                          {totalPrice.toLocaleString()}원
                        </TableCell>
                        {visibleCols.has("kpis") && <TableCell />}
                        {visibleCols.has("sales_rep") && <TableCell />}
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* ── Bottom: notes + submit ── */}
            <div className="flex items-start gap-4 mt-3 pt-3 border-t">
              <div className="flex-1">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="주문 메모..." rows={2} className="text-sm" />
              </div>
              <div className="flex gap-2 shrink-0 pt-1">
                <Button variant="outline" size="sm" onClick={() => handleClose(false)}>취소</Button>
                <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />생성 중...</> : "주문 생성"}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

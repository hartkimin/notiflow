"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  FileText,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPartnerProductsForOrderAction,
  createOrderWithDetailsAction,
} from "@/app/(dashboard)/orders/actions";
import { UNIT_OPTIONS, CUSTOM_UNIT_VALUE } from "@/lib/unit-types";
import type { OrderDisplayColumns } from "@/lib/queries/settings";
import type { ProductSupplierOption } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalSearchBox } from "@/components/portal-search-box";
import { matchesChosungSearch } from "@/lib/chosung";
import {
  getRecentHospitalsAction,
  getRecentPartnerProductsAction,
  getRecentMfdsItemsAction,
  searchMfdsItemsAction,
  searchHospitalsAction,
} from "@/app/(dashboard)/orders/actions";
import { saveColumnWidthsAction } from "@/app/(dashboard)/settings/actions";

// ── Partner product (from partner_products table) ─────────
interface PartnerProduct {
  id: number;
  product_source: "drug" | "device" | "product";
  product_id: number;
  name: string;
  code: string;
  unit_price: number | null;
}

// ── Types ──────────────────────────────────────────────────

interface LineItem {
  key: string;
  product_id: number;
  product_name: string;
  standard_code: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  suppliers: ProductSupplierOption[];
  quantity: number;
  unit_type: string;
  custom_unit: boolean;
  purchase_price: number | null;
  selling_price: number | null;
  kpis_number: string;
  source_type: "drug" | "device" | "product";
  sales_rep: string;
}

interface Props {
  displayColumns: OrderDisplayColumns;
  columnWidths?: Record<string, number>;
  sourceMessageId?: string;
}

// ── Optional column definitions ────────────────────────────

interface OptionalColumn {
  id: string;
  label: string;
  matchKeys: string[]; // displayColumns keys that activate this
}

const OPTIONAL_COLUMNS: OptionalColumn[] = [
  { id: "standard_code", label: "표준코드", matchKeys: ["BAR_CODE", "UDIDI_CD"] },
  { id: "supplier", label: "공급사", matchKeys: ["ENTP_NAME", "MNFT_IPRT_ENTP_NM"] },
  { id: "unit", label: "단위", matchKeys: [] },
  { id: "purchase_price", label: "매입가", matchKeys: [] },
  { id: "kpis", label: "KPIS", matchKeys: [] },
  { id: "sales_rep", label: "영업담당자", matchKeys: [] },
];

let _keyCounter = 0;
function nextKey() { return `po-${Date.now()}-${++_keyCounter}`; }

// ── Main Component ─────────────────────────────────────────

export function PurchaseOrderForm({ displayColumns, columnWidths, sourceMessageId }: Props) {
  const router = useRouter();

  // ── Header state ──
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [hospitalName, setHospitalName] = useState("");

  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");

  // ── Partner products (거래처 등록 품목) ──
  const [partnerProducts, setPartnerProducts] = useState<PartnerProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // ── Line items ──
  const [items, setItems] = useState<LineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Optional columns visibility ──
  const defaultVisibleCols = useMemo(() => {
    const allKeys = [...(displayColumns.drug ?? []), ...(displayColumns.device ?? [])];
    const visible = new Set<string>();
    for (const col of OPTIONAL_COLUMNS) {
      if (col.matchKeys.some((k) => allKeys.includes(k))) {
        visible.add(col.id);
      }
    }
    return visible;
  }, [displayColumns]);

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

  useEffect(() => { setVisibleCols(defaultVisibleCols); }, [defaultVisibleCols]);

  function toggleCol(id: string) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Load partner products for selected hospital ──
  useEffect(() => {
    if (!hospitalId) { setPartnerProducts([]); return; }
    setProductsLoading(true);
    getPartnerProductsForOrderAction(hospitalId)
      .then((ppList) => setPartnerProducts(ppList))
      .finally(() => setProductsLoading(false));
  }, [hospitalId]);

  // ── Add product directly to line items ──
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
      supplier_id: null,
      supplier_name: null,
      suppliers: [],
      quantity: 1,
      unit_type: "piece",
      custom_unit: false,
      purchase_price: null,
      selling_price: pp.unit_price,
      kpis_number: "",
      source_type: pp.product_source,
      sales_rep: "",
    }]);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateItem(key: string, updates: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => i.key === key ? { ...i, ...updates } : i));
  }

  // ── Calculations ──
  const totalPurchase = items.reduce((s, i) => s + (i.purchase_price ?? 0) * i.quantity, 0);
  const totalSelling = items.reduce((s, i) => s + (i.selling_price ?? 0) * i.quantity, 0);
  const totalMargin = totalSelling - totalPurchase;
  const marginRate = totalSelling > 0 ? (totalMargin / totalSelling) * 100 : 0;

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
        delivered_at: null,
        notes: notes || null,
        source_message_id: sourceMessageId ?? null,
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          source_type: i.source_type,
          supplier_id: i.supplier_id,
          quantity: i.quantity,
          unit_type: i.unit_type,
          purchase_price: i.purchase_price,
          unit_price: i.selling_price,
          kpis_reference_number: i.kpis_number || null,
          sales_rep: i.sales_rep || null,
        })),
      });
      toast.success(`주문이 생성되었습니다 (${result.orderNumber})`);
      router.push("/orders");
    } catch (err) {
      toast.error("주문 생성 실패: " + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
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
      supplier_id: null,
      supplier_name: null,
      suppliers: [],
      quantity: 1,
      unit_type: "piece",
      custom_unit: false,
      purchase_price: null,
      selling_price: null,
      kpis_number: "",
      source_type: sourceType as "drug" | "device",
      sales_rep: "",
    }]);
  }

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

  return (
    <div className="w-full space-y-0">
      {/* ── PO Header ────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/orders"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-bold">Purchase Order</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">취소</Link>
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />생성 중...</> : "주문 생성"}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg bg-white shadow-sm">
        {/* ── PO Info ──────────────────────────────────── */}
        <div className="p-6 border-b">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: 거래처 */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">거래처 (납품처)</Label>
                {hospitalId ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm py-1 px-3">
                      {hospitalName}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => { setHospitalId(null); setHospitalName(""); setPartnerProducts([]); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-1.5">
                    <PortalSearchBox
                      placeholder="거래처명을 입력하세요..."
                      fetchRecent={getRecentHospitalsAction}
                      searchAction={searchHospitalsAction}
                      onSelect={(h) => { setHospitalId(h.id); setHospitalName(h.name); }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right: 날짜/번호 */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">주문일</Label>
                  <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">배송예정일</Label>
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">주문번호</Label>
                <p className="text-sm text-muted-foreground mt-1.5">자동 생성됩니다</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Item Add Section ─────────────────────────── */}
        <div className="p-6 border-b bg-muted/20">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            품목 추가
          </h3>

          <Tabs defaultValue={hospitalId ? "partner" : "mfds"} className="space-y-3">
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
                <div className="flex justify-center py-6">
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

        {/* ── Line Items Table ─────────────────────────── */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              주문 품목 {items.length > 0 && <span className="text-muted-foreground font-normal">({items.length}건)</span>}
            </h3>
            {/* Column settings toggle */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground h-7"
                onClick={() => setShowColSettings(!showColSettings)}
              >
                <Settings2 className="h-3.5 w-3.5" />
                컬럼 설정
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
            <div className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg">
              위에서 품목을 추가하세요
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs relative" style={{ width: colWidths["no"] ?? 40 }}>
                      #
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("no", e)} />
                    </TableHead>
                    <TableHead className="text-xs relative" style={{ width: colWidths["name"] ?? 200 }}>
                      품목명
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("name", e)} />
                    </TableHead>
                    {visibleCols.has("standard_code") && (
                      <TableHead className="text-xs relative" style={{ width: colWidths["standard_code"] ?? 120 }}>
                        표준코드
                        <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("standard_code", e)} />
                      </TableHead>
                    )}
                    {visibleCols.has("supplier") && (
                      <TableHead className="text-xs relative" style={{ width: colWidths["supplier"] ?? 120 }}>
                        공급사
                        <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("supplier", e)} />
                      </TableHead>
                    )}
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["qty"] ?? 70 }}>
                      수량
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("qty", e)} />
                    </TableHead>
                    {visibleCols.has("unit") && (
                      <TableHead className="text-xs relative" style={{ width: colWidths["unit"] ?? 80 }}>
                        단위
                        <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("unit", e)} />
                      </TableHead>
                    )}
                    {visibleCols.has("purchase_price") && (
                      <TableHead className="text-xs text-right relative" style={{ width: colWidths["purchase_price"] ?? 90 }}>
                        매입가
                        <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("purchase_price", e)} />
                      </TableHead>
                    )}
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["selling_price"] ?? 90 }}>
                      공급가
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("selling_price", e)} />
                    </TableHead>
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["amount"] ?? 100 }}>
                      금액
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("amount", e)} />
                    </TableHead>
                    {visibleCols.has("kpis") && (
                      <TableHead className="text-xs relative" style={{ width: colWidths["kpis"] ?? 100 }}>
                        KPIS
                        <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("kpis", e)} />
                      </TableHead>
                    )}
                    {visibleCols.has("sales_rep") && (
                      <TableHead className="text-xs relative" style={{ width: colWidths["sales_rep"] ?? 100 }}>
                        영업담당자
                        <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("sales_rep", e)} />
                      </TableHead>
                    )}
                    <TableHead className="text-xs w-[36px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => {
                    const lineTotal = (item.selling_price ?? 0) * item.quantity;
                    return (
                      <TableRow key={item.key}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-sm truncate overflow-hidden" title={item.product_name}>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 shrink-0 ${
                              item.source_type === "drug" ? "text-blue-600 bg-blue-50 border-blue-200"
                                : item.source_type === "device" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                                : "text-gray-500 bg-gray-50 border-gray-200"
                            }`}>
                              {item.source_type === "drug" ? "약" : item.source_type === "device" ? "기기" : "기타"}
                            </Badge>
                            <span className="font-medium truncate max-w-[180px]">{item.product_name}</span>
                          </div>
                        </TableCell>
                        {visibleCols.has("standard_code") && (
                          <TableCell className="text-xs text-muted-foreground font-mono truncate overflow-hidden" title={item.standard_code || ""}>
                            {item.standard_code || "-"}
                          </TableCell>
                        )}
                        {visibleCols.has("supplier") && (
                          <TableCell className="text-xs truncate overflow-hidden" title={item.supplier_name ?? ""}>{item.supplier_name ?? "-"}</TableCell>
                        )}
                        <TableCell className="text-right">
                          <Input
                            type="number" min={1} value={item.quantity}
                            onChange={(e) => updateItem(item.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="h-7 w-[60px] text-xs text-right ml-auto"
                          />
                        </TableCell>
                        {visibleCols.has("unit") && (
                          <TableCell>
                            {item.custom_unit ? (
                              <Input
                                value={item.unit_type}
                                onChange={(e) => updateItem(item.key, { unit_type: e.target.value.slice(0, 20) })}
                                className="h-7 w-[70px] text-xs"
                              />
                            ) : (
                              <Select value={item.unit_type} onValueChange={(v: string) => {
                                if (v === CUSTOM_UNIT_VALUE) updateItem(item.key, { custom_unit: true, unit_type: "" });
                                else updateItem(item.key, { unit_type: v });
                              }}>
                                <SelectTrigger className="h-7 w-[70px] text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {UNIT_OPTIONS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                                  <SelectItem value={CUSTOM_UNIT_VALUE}>직접입력</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                        )}
                        {visibleCols.has("purchase_price") && (
                          <TableCell className="text-right">
                            <Input
                              type="number" min={0} value={item.purchase_price ?? ""}
                              onChange={(e) => updateItem(item.key, { purchase_price: e.target.value ? parseFloat(e.target.value) : null })}
                              className="h-7 w-[80px] text-xs text-right ml-auto"
                            />
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <Input
                            type="number" min={0} value={item.selling_price ?? ""}
                            onChange={(e) => updateItem(item.key, { selling_price: e.target.value ? parseFloat(e.target.value) : null })}
                            className="h-7 w-[80px] text-xs text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums font-medium">
                          {lineTotal.toLocaleString()}
                        </TableCell>
                        {visibleCols.has("kpis") && (
                          <TableCell>
                            <Input
                              value={item.kpis_number}
                              onChange={(e) => updateItem(item.key, { kpis_number: e.target.value.slice(0, 100) })}
                              placeholder="신고번호"
                              className="h-7 w-[90px] text-xs"
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
                    <TableCell className="text-xs">합계</TableCell>
                    {visibleCols.has("standard_code") && <TableCell />}
                    {visibleCols.has("supplier") && <TableCell />}
                    <TableCell className="text-right text-xs tabular-nums">
                      {items.reduce((s, i) => s + i.quantity, 0)}
                    </TableCell>
                    {visibleCols.has("unit") && <TableCell />}
                    {visibleCols.has("purchase_price") && (
                      <TableCell className="text-right text-xs tabular-nums">
                        {totalPurchase.toLocaleString()}
                      </TableCell>
                    )}
                    <TableCell className="text-right text-xs tabular-nums">
                      {items.reduce((s, i) => s + (i.selling_price ?? 0), 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums font-bold">
                      {totalSelling.toLocaleString()}원
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

        {/* ── Footer: Notes + Summary ──────────────────── */}
        {items.length > 0 && (
          <div className="p-6 border-t bg-muted/10">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">메모</Label>
                <Textarea
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="주문 관련 메모..." rows={3} className="mt-1.5 text-sm"
                />
              </div>
              <div className="md:w-[260px] space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">총 매입액</span>
                  <span className="tabular-nums">{totalPurchase.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">총 공급액</span>
                  <span className="tabular-nums font-semibold">{totalSelling.toLocaleString()}원</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">마진</span>
                  <span className={`tabular-nums font-semibold ${totalMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {totalMargin.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">마진율</span>
                  <span className="tabular-nums">{marginRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

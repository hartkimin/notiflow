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
  ClipboardList,
  Settings2,
  PackagePlus,
  Trash2,
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
  searchMyItemsAction,
} from "@/app/(dashboard)/orders/actions";
import { UNIT_OPTIONS, CUSTOM_UNIT_VALUE } from "@/lib/unit-types";
import type { OrderDisplayColumns } from "@/lib/queries/settings";
import type { ProductSupplierOption } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalSearchBox } from "@/components/portal-search-box";
import { matchesChosungSearch } from "@/lib/chosung";
import { vatToExcl, exclToVat, calcLine, calcOrderTotals, lineSupply, lineTax, fmt4, round4 } from "@/lib/price-calc";
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
  box_spec_id?: number | null;
}

export interface SourceMessage {
  id: string;
  sender: string | null;
  app_name: string;
  content: string;
  received_at: string;
}

interface SupplierOption {
  id: number;
  name: string;
}

interface CopyData {
  hospitalId: number;
  hospitalName: string;
  orderDate?: string;
  deliveryDate?: string;
  notes: string;
  items: Array<{
    product_id: number;
    product_name: string;
    source_type: "drug" | "device" | "product";
    supplier_id: number | null;
    supplier_name: string | null;
    quantity: number;
    unit_type: string;
    purchase_price: number | null;
    selling_price: number | null;
    sales_rep: string;
    box_spec_id?: number | null;
    calculated_pieces?: number | null;
    line_total?: number | null;
  }>;
}

interface Props {
  displayColumns: OrderDisplayColumns;
  columnWidths?: Record<string, number>;
  sourceMessageId?: string;
  initialNotes?: string;
  sourceMessages?: SourceMessage[];
  suppliers?: SupplierOption[];
  copyData?: CopyData;
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
  { id: "kpis", label: "KPIS", matchKeys: [] },
];

let _keyCounter = 0;
function nextKey() { return `po-${Date.now()}-${++_keyCounter}`; }

// ── Main Component ─────────────────────────────────────────

export function PurchaseOrderForm({ displayColumns, columnWidths, sourceMessageId, initialNotes, sourceMessages, suppliers = [], copyData }: Props) {
  const router = useRouter();

  // ── Header state ──
  const [hospitalId, setHospitalId] = useState<number | null>(copyData?.hospitalId ?? null);
  const [hospitalName, setHospitalName] = useState(copyData?.hospitalName ?? "");
  const [hospitalContactPerson, setHospitalContactPerson] = useState<string | null>(null);

  const [orderDate, setOrderDate] = useState(copyData?.orderDate || new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState(copyData?.deliveryDate || "");
  const [notes, setNotes] = useState(copyData?.notes || initialNotes || "");

  // ── Partner products (거래처 등록 품목) ──
  const [partnerProducts, setPartnerProducts] = useState<PartnerProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // ── Line items (pre-filled from copyData if available) ──
  const [items, setItems] = useState<LineItem[]>(() => {
    if (!copyData?.items.length) return [];
    return copyData.items.map((i, idx) => ({
      key: `copy-${idx}-${Date.now()}`,
      product_id: i.product_id,
      product_name: i.product_name,
      standard_code: null,
      supplier_id: i.supplier_id,
      supplier_name: i.supplier_name,
      suppliers: [],
      quantity: i.quantity,
      unit_type: i.unit_type,
      custom_unit: false,
      purchase_price: i.purchase_price,
      selling_price: i.selling_price,
      kpis_number: "",
      source_type: i.source_type,
      sales_rep: i.sales_rep,
      box_spec_id: i.box_spec_id ?? null,
    }));
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Unsaved changes warning ──
  const isDirty = items.length > 0 || hospitalId !== null || notes !== (initialNotes || "");
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && !isSubmitting) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, isSubmitting]);

  // ── Keyboard shortcut: Ctrl+Enter to submit ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // ── Optional columns visibility ──
  const defaultVisibleCols = useMemo(() => {
    const allKeys = [...(displayColumns.drug ?? []), ...(displayColumns.device ?? [])];
    const visible = new Set<string>();
    for (const col of OPTIONAL_COLUMNS) {
      if (col.matchKeys.some((k) => allKeys.includes(k))) {
        visible.add(col.id);
      }
    }
    // Always show supplier column when suppliers are available
    if (suppliers.length > 0) visible.add("supplier");
    return visible;
  }, [displayColumns, suppliers]);

  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());
  const [showColSettings, setShowColSettings] = useState(false);

  // ── Outside click to close column settings ──
  const colSettingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showColSettings) return;
    const handler = (e: MouseEvent) => {
      if (colSettingsRef.current && !colSettingsRef.current.contains(e.target as Node)) {
        setShowColSettings(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColSettings]);

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

  // ── Tab state for item add section ──
  const [addTab, setAddTab] = useState<string>(hospitalId ? "partner" : "mfds");

  // ── Load partner products for selected hospital ──
  useEffect(() => {
    if (!hospitalId) { setPartnerProducts([]); return; }
    setProductsLoading(true);
    setAddTab("partner"); // auto-switch to partner tab
    getPartnerProductsForOrderAction(hospitalId)
      .then((ppList) => setPartnerProducts(ppList))
      .finally(() => setProductsLoading(false));
  }, [hospitalId]);

  // ── Add product directly to line items ──
  function addProduct(pp: PartnerProduct) {
    const dupKey = `${pp.product_source}-${pp.product_id}`;
    if (items.some((i) => `${i.source_type}-${i.product_id}` === dupKey)) {
      toast.warning("이미 추가된 품목입니다");
      return;
    }
    const key = nextKey();
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 1200);
    setItems((prev) => [...prev, {
      key,
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
      sales_rep: hospitalContactPerson ?? "",
    }]);
  }

  const [flashKey, setFlashKey] = useState<string | null>(null);

  function removeItem(key: string) {
    const removed = items.find((i) => i.key === key);
    if (!removed) return;
    const idx = items.indexOf(removed);
    setItems((prev) => prev.filter((i) => i.key !== key));
    toast("품목이 삭제되었습니다", {
      action: { label: "되돌리기", onClick: () => setItems((prev) => { const next = [...prev]; next.splice(idx, 0, removed); return next; }) },
      duration: 4000,
    });
  }

  function updateItem(key: string, updates: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => i.key === key ? { ...i, ...updates } : i));
  }

  // ── Calculations (price-calc 통일 모듈) ──
  const orderTotals = calcOrderTotals(
    items.map((i) => ({ purchasePrice: i.purchase_price ?? 0, sellingPrice: i.selling_price ?? 0, qty: i.quantity })),
  );
  const { purchaseTotal: totalPurchase, sellingTotal: totalSelling, supplyTotal: totalSupply, taxTotal: totalTax, totalMargin, marginRate } = orderTotals;

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
          box_spec_id: i.box_spec_id ?? null,
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

  // ── Check if item already added ──
  const isPartnerItemSelected = useCallback((pp: PartnerProduct) => {
    return items.some((i) => `${i.source_type}-${i.product_id}` === `${pp.product_source}-${pp.product_id}`);
  }, [items]);

  interface MyItemResult { id: number; type: "drug" | "device"; name: string; code: string | null; manufacturer: string | null; unit_price: number | null; }

  function addMyItem(item: MyItemResult) {
    if (items.some((i) => `${i.source_type}-${i.product_id}` === `${item.type}-${item.id}`)) {
      toast.warning("이미 추가된 품목입니다");
      return;
    }
    const key = nextKey();
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 1200);
    setItems((prev) => [...prev, {
      key,
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
      selling_price: item.unit_price,
      kpis_number: "",
      source_type: item.type,
      sales_rep: hospitalContactPerson ?? "",
    }]);
  }

  const isMyItemSelected = useCallback((item: MyItemResult) => {
    return items.some((i) => `${i.source_type}-${i.product_id}` === `${item.type}-${item.id}`);
  }, [items]);

  function renderMyItem(item: MyItemResult) {
    return (
      <div className="flex items-center gap-2 w-full">
        <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 shrink-0 ${
          item.type === "drug" ? "text-blue-600 bg-blue-50 border-blue-200" : "text-emerald-600 bg-emerald-50 border-emerald-200"
        }`}>
          {item.type === "drug" ? "약" : "기기"}
        </Badge>
        <span className="font-medium truncate">{item.name}</span>
        {item.manufacturer && <span className="text-xs text-muted-foreground truncate">{item.manufacturer}</span>}
        {item.unit_price != null && (
          <span className="text-xs text-muted-foreground ml-auto shrink-0">{fmt4(item.unit_price)}원</span>
        )}
      </div>
    );
  }

  const fetchRecentMyItems = useCallback(async () => [] as MyItemResult[], []);

  interface MfdsSearchResult { id: number; name: string; code: string; source_type: "drug" | "device_std"; manufacturer?: string | null; }

  function addMfdsItem(item: MfdsSearchResult) {
    const sourceType = item.source_type === "device_std" ? "device" : "drug";
    if (items.some((i) => `${i.source_type}-${i.product_id}` === `${sourceType}-${item.id}`)) {
      toast.warning("이미 추가된 품목입니다");
      return;
    }
    const key = nextKey();
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 1200);
    setItems((prev) => [...prev, {
      key,
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
      sales_rep: hospitalContactPerson ?? "",
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
          <span className="text-xs text-muted-foreground ml-auto shrink-0">{fmt4(item.unit_price)}원</span>
        )}
      </div>
    );
  }

  const isMfdsItemSelected = useCallback((item: MfdsSearchResult) => {
    const sourceType = item.source_type === "device_std" ? "device" : "drug";
    return items.some((i) => `${i.source_type}-${i.product_id}` === `${sourceType}-${item.id}`);
  }, [items]);

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

  const hasMessages = sourceMessages && sourceMessages.length > 0;

  return (
    <div className="w-full space-y-0">
      {/* ── PO Header ────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/orders"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-bold">주문서 작성</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">취소</Link>
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting} title="Ctrl+Enter">
            {isSubmitting ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />생성 중...</> : "주문 생성"}
          </Button>
        </div>
      </div>

      {/* ── 2-Column Layout: Order Form (left) + Messages (right) ── */}
      <div className={hasMessages ? "grid grid-cols-[1fr_360px] gap-4 items-start" : ""}>
        {/* ── Left: Order Form ── */}
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
                        onClick={() => {
                          if (items.length > 0 && !confirm("거래처를 변경하면 추가된 품목이 모두 삭제됩니다. 계속하시겠습니까?")) return;
                          setHospitalId(null); setHospitalName(""); setHospitalContactPerson(null); setPartnerProducts([]);
                          if (items.length > 0) setItems([]);
                        }}
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
                        onSelect={(h: { id: number; name: string; contact_person?: string | null }) => { setHospitalId(h.id); setHospitalName(h.name); setHospitalContactPerson(h.contact_person ?? null); }}
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
                    <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">배송예정일 <span className="font-normal normal-case">(선택)</span></Label>
                    <Input type="date" value={deliveryDate} min={orderDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
                {hospitalContactPerson && (
                  <div>
                    <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">담당자</Label>
                    <p className="text-sm mt-1.5">{hospitalContactPerson}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Item Add Section ─────────────────────────── */}
          <div className="p-6 border-b bg-muted/20">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              품목 추가
            </h3>

            <Tabs value={addTab} onValueChange={setAddTab} className="space-y-3">
              <TabsList>
                <TabsTrigger value="partner" className="text-xs" disabled={!hospitalId}>
                  거래처
                  {partnerProducts.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 ml-1.5">
                      {partnerProducts.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="myitems" className="text-xs">내품목</TabsTrigger>
                <TabsTrigger value="mfds" className="text-xs">식약처 DB</TabsTrigger>
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
                    isSelected={isPartnerItemSelected}
                  />
                )}
              </TabsContent>

              <TabsContent value="myitems">
                <PortalSearchBox
                  placeholder="내품목 검색 (품목명, 업체명, 코드)..."
                  fetchRecent={fetchRecentMyItems}
                  searchAction={searchMyItemsAction}
                  onSelect={addMyItem}
                  renderItem={renderMyItem}
                  isSelected={isMyItemSelected}
                />
              </TabsContent>

              <TabsContent value="mfds">
                <PortalSearchBox
                  placeholder="식약처 의약품 검색 (품목명, 코드, 업체명)..."
                  fetchRecent={getRecentMfdsItemsAction}
                  searchAction={searchMfdsItemsAction}
                  onSelect={addMfdsItem}
                  renderItem={renderMfdsItem}
                  isSelected={isMfdsItemSelected}
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
            <div className="relative" ref={colSettingsRef}>
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
              <PackagePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p>위에서 품목을 검색하여 추가하세요</p>
              <p className="text-xs mt-1 text-muted-foreground/60">거래처 품목 또는 식약처 데이터에서 검색할 수 있습니다</p>
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
                    <TableHead className="text-xs relative" style={{ width: colWidths["name"] ?? 160 }}>
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
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["qty"] ?? 55 }}>
                      수량
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("qty", e)} />
                    </TableHead>
                    {visibleCols.has("unit") && (
                      <TableHead className="text-xs relative" style={{ width: colWidths["unit"] ?? 80 }}>
                        단위
                        <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("unit", e)} />
                      </TableHead>
                    )}
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["p_vat"] ?? 85 }}>
                      매입(VAT)
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("p_vat", e)} />
                    </TableHead>
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["p_excl"] ?? 75 }}>
                      매입단가
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("p_excl", e)} />
                    </TableHead>
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["p_supply"] ?? 85 }}>
                      매입공급가
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("p_supply", e)} />
                    </TableHead>
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["p_tax"] ?? 65 }}>
                      매입부가세
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("p_tax", e)} />
                    </TableHead>
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["s_vat"] ?? 85 }}>
                      판매(VAT)
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("s_vat", e)} />
                    </TableHead>
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["s_excl"] ?? 75 }}>
                      판매단가
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("s_excl", e)} />
                    </TableHead>
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["s_supply"] ?? 85 }}>
                      판매공급가
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("s_supply", e)} />
                    </TableHead>
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["s_tax"] ?? 65 }}>
                      판매부가세
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("s_tax", e)} />
                    </TableHead>
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["profit"] ?? 110 }}>
                      매출이익
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("profit", e)} />
                    </TableHead>
                    <TableHead className="text-xs text-right relative" style={{ width: colWidths["profit_rate"] ?? 70 }}>
                      이익률
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("profit_rate", e)} />
                    </TableHead>
                    <TableHead className="text-xs relative" style={{ width: colWidths["sales_rep"] ?? 65 }}>
                      담당자
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("sales_rep", e)} />
                    </TableHead>
                    {visibleCols.has("kpis") && (
                      <TableHead className="text-xs relative" style={{ width: colWidths["kpis"] ?? 100 }}>
                        KPIS
                        <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400/50" onMouseDown={(e) => handleResizeStart("kpis", e)} />
                      </TableHead>
                    )}
                    <TableHead className="text-xs w-[36px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => {
                    return (
                      <TableRow key={item.key} className={`${idx % 2 === 1 ? "bg-muted/20" : ""} ${flashKey === item.key ? "animate-pulse bg-green-50" : ""} transition-colors`}>
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
                          <TableCell>
                            <Select
                              value={item.supplier_id != null ? String(item.supplier_id) : ""}
                              onValueChange={(v) => {
                                const sup = suppliers.find(s => String(s.id) === v);
                                updateItem(item.key, {
                                  supplier_id: sup ? sup.id : null,
                                  supplier_name: sup ? sup.name : null,
                                });
                              }}
                            >
                              <SelectTrigger className="h-7 w-[110px] text-xs">
                                <SelectValue placeholder="공급사 선택" />
                              </SelectTrigger>
                              <SelectContent>
                                {suppliers.map((s) => (
                                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
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
                        {/* 매입(VAT) — 입력 */}
                        <TableCell className="text-right">
                          <Input
                            type="number" min={0} step="any"
                            value={item.purchase_price != null ? exclToVat(item.purchase_price) : ""}
                            onChange={(e) => {
                              const vatIncl = e.target.value ? parseFloat(e.target.value) : null;
                              updateItem(item.key, { purchase_price: vatIncl != null ? vatToExcl(vatIncl) : null });
                            }}
                            className="h-7 w-[80px] text-xs text-right ml-auto"
                            placeholder="VAT포함"
                          />
                        </TableCell>
                        {/* 매입단가 — 자동 */}
                        <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                          {item.purchase_price != null ? fmt4(item.purchase_price) : "-"}
                        </TableCell>
                        {/* 매입공급가 — 자동 */}
                        <TableCell className="text-xs text-right tabular-nums">
                          {item.purchase_price != null ? fmt4(lineSupply(item.purchase_price, item.quantity)) : "-"}
                        </TableCell>
                        {/* 매입부가세 — 자동 */}
                        <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                          {item.purchase_price != null ? fmt4(lineTax(item.purchase_price, item.quantity)) : "-"}
                        </TableCell>
                        {/* 판매(VAT) — 입력 */}
                        <TableCell className="text-right">
                          <Input
                            type="number" min={0} step="any"
                            value={item.selling_price != null ? exclToVat(item.selling_price) : ""}
                            onChange={(e) => {
                              const vatIncl = e.target.value ? parseFloat(e.target.value) : null;
                              updateItem(item.key, { selling_price: vatIncl != null ? vatToExcl(vatIncl) : null });
                            }}
                            className="h-7 w-[80px] text-xs text-right ml-auto"
                            placeholder="VAT포함"
                          />
                        </TableCell>
                        {/* 판매단가 — 자동 */}
                        <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                          {item.selling_price != null ? fmt4(item.selling_price) : "-"}
                        </TableCell>
                        {/* 판매공급가 — 자동 */}
                        <TableCell className="text-xs text-right tabular-nums font-medium">
                          {item.selling_price != null ? fmt4(lineSupply(item.selling_price, item.quantity)) : "-"}
                        </TableCell>
                        {/* 판매부가세 — 자동 */}
                        <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                          {item.selling_price != null ? fmt4(lineTax(item.selling_price, item.quantity)) : "-"}
                        </TableCell>
                        {/* 이익 */}
                        <TableCell className="text-xs text-right font-mono">
                          {(() => {
                            const lc = calcLine(item.purchase_price ?? 0, item.selling_price ?? 0, item.quantity);
                            return <span className={lc.profit < 0 ? "text-red-500" : "text-green-600"}>{fmt4(lc.profit)}</span>;
                          })()}
                        </TableCell>
                        {/* 이익률 */}
                        <TableCell className="text-xs text-right font-mono">
                          {(() => {
                            const lc = calcLine(item.purchase_price ?? 0, item.selling_price ?? 0, item.quantity);
                            return <span className={lc.marginRate < 0 ? "text-red-500" : ""}>{lc.marginRate.toFixed(1)}%</span>;
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <Input
                              value={item.sales_rep}
                              onChange={(e) => updateItem(item.key, { sales_rep: e.target.value.slice(0, 100) })}
                              placeholder="담당자"
                              className="h-7 w-[80px] text-xs"
                              list={`sales-rep-options-${item.key}`}
                            />
                            {hospitalContactPerson && (
                              <datalist id={`sales-rep-options-${item.key}`}>
                                <option value={hospitalContactPerson} />
                              </datalist>
                            )}
                          </div>
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
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500" onClick={() => removeItem(item.key)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* ── Totals row ── */}
                  <TableRow className="bg-muted/60 font-semibold border-t-2 border-t-foreground/20">
                    <TableCell className="text-xs" />
                    <TableCell className="text-xs">합계</TableCell>
                    {visibleCols.has("standard_code") && <TableCell />}
                    {visibleCols.has("supplier") && <TableCell />}
                    <TableCell className="text-right text-xs tabular-nums">
                      {items.reduce((s, i) => s + i.quantity, 0)}
                    </TableCell>
                    {visibleCols.has("unit") && <TableCell />}
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right text-xs tabular-nums font-bold">
                      {fmt4(totalPurchase)}원
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right text-xs tabular-nums font-bold">
                      {fmt4(totalSelling)}원
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      <span className={totalMargin < 0 ? "text-red-500" : "text-green-600"}>{fmt4(totalMargin)}원</span>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      <span className={marginRate < 0 ? "text-red-500" : ""}>{marginRate.toFixed(1)}%</span>
                    </TableCell>
                    <TableCell />
                    {visibleCols.has("kpis") && <TableCell />}
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
                    <span className="text-muted-foreground">매입 합계</span>
                    <span className="tabular-nums">₩{fmt4(totalPurchase)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">매출 합계</span>
                    <span className="tabular-nums font-semibold">₩{fmt4(totalSelling)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">이익</span>
                    <span className={`tabular-nums font-semibold ${totalMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      ₩{fmt4(totalMargin)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">이익률</span>
                    <span className="tabular-nums">{marginRate.toFixed(1)}%</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">공급가액</span>
                    <span className="tabular-nums">₩{fmt4(totalSupply)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">세액</span>
                    <span className="tabular-nums">₩{fmt4(totalTax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">합계</span>
                    <span className="tabular-nums font-semibold">₩{fmt4(round4(totalSupply + totalTax))}</span>

                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: 수신 메시지 카드 ── */}
        {hasMessages && (
          <div className="sticky top-4 space-y-3">
            <div className="border rounded-lg bg-white shadow-sm">
              <div className="px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">수신 메시지</Label>
                  <Badge variant="secondary" className="text-[10px]">{sourceMessages!.length}건</Badge>
                </div>
              </div>
              <div className="p-3 space-y-2 max-h-[calc(100vh-8rem)] overflow-y-auto">
                {sourceMessages!.map((msg) => {
                  const time = new Date(msg.received_at).toLocaleString("ko-KR", {
                    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <div key={msg.id} className="border rounded-lg p-3 bg-muted/10 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                          {msg.app_name}
                        </Badge>
                        <span className="text-xs font-medium truncate">{msg.sender || "(발신자 없음)"}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{time}</span>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed text-muted-foreground">{msg.content}</pre>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

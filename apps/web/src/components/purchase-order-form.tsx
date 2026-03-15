"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
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
  searchHospitalsAction,
  getHospitalProductsAction,
  getProductSuppliersAction,
  createOrderWithDetailsAction,
} from "@/app/(dashboard)/orders/actions";
import { UNIT_OPTIONS, CUSTOM_UNIT_VALUE } from "@/lib/unit-types";
import type { OrderDisplayColumns } from "@/lib/queries/settings";
import type { HospitalProduct, ProductSupplierOption } from "@/lib/types";

// ── Column label maps ──────────────────────────────────────

const DRUG_LABELS: Record<string, string> = {
  ITEM_SEQ: "품목기준코드", ITEM_NAME: "품목명", ITEM_ENG_NAME: "영문명",
  ENTP_NAME: "업체명", BAR_CODE: "표준코드", MATERIAL_NAME: "성분",
  EDI_CODE: "보험코드", STORAGE_METHOD: "저장방법", PACK_UNIT: "포장단위",
  ATC_CODE: "ATC코드", ETC_OTC_CODE: "전문/일반",
};
const DEVICE_LABELS: Record<string, string> = {
  PRDLST_NM: "품목명", UDIDI_CD: "UDI-DI코드", MNFT_IPRT_ENTP_NM: "제조수입업체명",
  MDEQ_CLSF_NO: "분류번호", CLSF_NO_GRAD_CD: "등급", FOML_INFO: "모델명",
  PRDT_NM_INFO: "제품명",
};

// ── Types ──────────────────────────────────────────────────

interface LineItem {
  key: string;
  product_id: number;
  product_name: string;
  manufacturer: string | null;
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
  raw: Record<string, unknown>;
  source_type: "drug" | "device" | "product";
}

interface Props {
  displayColumns: OrderDisplayColumns;
  sourceMessageId?: string;
}

let _keyCounter = 0;
function nextKey() { return `po-${Date.now()}-${++_keyCounter}`; }

// ── Main Component ─────────────────────────────────────────

export function PurchaseOrderForm({ displayColumns, sourceMessageId }: Props) {
  const router = useRouter();

  // ── Header state ──
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [hospitalResults, setHospitalResults] = useState<Array<{ id: number; name: string }>>([]);
  const [hospitalSearching, setHospitalSearching] = useState(false);
  const [showHospitalList, setShowHospitalList] = useState(false);

  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");

  // ── Hospital products ──
  const [hospitalProducts, setHospitalProducts] = useState<HospitalProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [hpSearch, setHpSearch] = useState("");
  const [hpPage, setHpPage] = useState(1);
  const HP_PAGE_SIZE = 10;

  // ── Item add state (stepped) ──
  const [selectedProduct, setSelectedProduct] = useState<HospitalProduct | null>(null);
  const [productSuppliers, setProductSuppliers] = useState<ProductSupplierOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [addQuantity, setAddQuantity] = useState(1);
  const [addUnitType, setAddUnitType] = useState("piece");
  const [addCustomUnit, setAddCustomUnit] = useState(false);
  const [addSellingPrice, setAddSellingPrice] = useState<number | null>(null);
  const [addKpis, setAddKpis] = useState("");

  // ── Line items ──
  const [items, setItems] = useState<LineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── All hospitals (pre-load) ──
  const [allHospitals, setAllHospitals] = useState<Array<{ id: number; name: string }>>([]);
  const [hospitalsLoaded, setHospitalsLoaded] = useState(false);

  useEffect(() => {
    // Load all hospitals on mount via server action
    (async () => {
      const { getAllHospitalsAction } = await import("@/app/(dashboard)/orders/actions");
      const hospitals = await getAllHospitalsAction();
      setAllHospitals(hospitals);
      setHospitalsLoaded(true);
    })();
  }, []);

  // ── Hospital search (filter from pre-loaded list) ──
  const filteredHospitals = hospitalSearch.length > 0
    ? allHospitals.filter((h) => h.name.toLowerCase().includes(hospitalSearch.toLowerCase()))
    : allHospitals;

  // ── Load hospital products + fallback to all products ──
  const [allProducts, setAllProducts] = useState<Array<{ id: number; name: string; official_name: string; manufacturer: string | null; standard_code: string | null }>>([]);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    if (!hospitalId) { setHospitalProducts([]); return; }
    setProductsLoading(true);
    Promise.all([
      getHospitalProductsAction(hospitalId),
      import("@/app/(dashboard)/orders/actions").then(({ getAllProductsAction }) => getAllProductsAction()),
    ])
      .then(([hpProducts, catalog]) => {
        setHospitalProducts(hpProducts);
        setAllProducts(catalog);
      })
      .finally(() => setProductsLoading(false));
  }, [hospitalId]);

  function selectHospital(h: { id: number; name: string }) {
    setHospitalId(h.id);
    setHospitalName(h.name);
    setHospitalSearch("");
    setShowHospitalList(false);
    setHospitalResults([]);
    // Reset product selection
    setSelectedProduct(null);
    setProductSuppliers([]);
    setHpSearch("");
    setHpPage(1);
  }

  // ── Product selection → load suppliers ──
  async function selectProduct(hp: HospitalProduct) {
    setSelectedProduct(hp);
    setAddQuantity(hp.default_quantity ?? 1);
    setAddSellingPrice(hp.selling_price);
    setAddKpis("");
    setAddUnitType("piece");
    setAddCustomUnit(false);

    const suppliers = hp.suppliers.length > 0 ? hp.suppliers : await getProductSuppliersAction(hp.product_id);
    setProductSuppliers(suppliers);
    const primary = suppliers.find((s) => s.is_primary) ?? suppliers[0];
    setSelectedSupplierId(primary?.supplier_id ?? null);
  }

  // ── Add line item ──
  function addLineItem() {
    if (!selectedProduct) return;
    if (items.some((i) => i.product_id === selectedProduct.product_id)) {
      toast.error("이미 추가된 품목입니다");
      return;
    }

    const supplier = productSuppliers.find((s) => s.supplier_id === selectedSupplierId);

    setItems((prev) => [...prev, {
      key: nextKey(),
      product_id: selectedProduct.product_id,
      product_name: selectedProduct.product_name,
      manufacturer: selectedProduct.manufacturer,
      standard_code: selectedProduct.standard_code,
      supplier_id: selectedSupplierId,
      supplier_name: supplier?.supplier_name ?? null,
      suppliers: productSuppliers,
      quantity: addQuantity,
      unit_type: addUnitType,
      custom_unit: addCustomUnit,
      purchase_price: supplier?.purchase_price ?? null,
      selling_price: addSellingPrice,
      kpis_number: addKpis,
      raw: {},
      source_type: "product",
    }]);

    // Reset add form
    setSelectedProduct(null);
    setProductSuppliers([]);
    setSelectedSupplierId(null);
    setAddQuantity(1);
    setAddSellingPrice(null);
    setAddKpis("");
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
          supplier_id: i.supplier_id,
          quantity: i.quantity,
          unit_type: i.unit_type,
          purchase_price: i.purchase_price,
          unit_price: i.selling_price,
          kpis_reference_number: i.kpis_number || null,
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

  const selectedSupplier = productSuppliers.find((s) => s.supplier_id === selectedSupplierId);

  return (
    <div className="max-w-5xl mx-auto space-y-0">
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
                      onClick={() => { setHospitalId(null); setHospitalName(""); setHospitalProducts([]); setSelectedProduct(null); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative mt-1.5">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="거래처 검색 (입력하면 필터링됩니다)..."
                        value={hospitalSearch}
                        onChange={(e) => setHospitalSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <div className="mt-1.5 border rounded-md max-h-[200px] overflow-y-auto bg-white">
                      {!hospitalsLoaded ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                      ) : filteredHospitals.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-3">검색 결과 없음</p>
                      ) : (
                        filteredHospitals.map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent text-left border-b last:border-b-0"
                            onClick={() => selectHospital(h)}
                          >
                            {h.name}
                          </button>
                        ))
                      )}
                    </div>
                  </>
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

          {!hospitalId ? (
            <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
              먼저 거래처를 선택하세요
            </p>
          ) : productsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Step 1: Product selection */}
              <div>
                <Label className="text-xs font-medium">1. 품목 선택</Label>

                {/* Hospital registered products */}
                {hospitalProducts.length > 0 && (() => {
                  const filtered = hpSearch.length > 0
                    ? hospitalProducts.filter((hp) =>
                        hp.product_name.toLowerCase().includes(hpSearch.toLowerCase()) ||
                        (hp.manufacturer ?? "").toLowerCase().includes(hpSearch.toLowerCase())
                      )
                    : hospitalProducts;
                  const totalPages = Math.ceil(filtered.length / HP_PAGE_SIZE);
                  const safePage = Math.min(hpPage, Math.max(1, totalPages));
                  const paged = filtered.slice((safePage - 1) * HP_PAGE_SIZE, safePage * HP_PAGE_SIZE);

                  return (
                    <>
                      <div className="flex items-center justify-between mt-1 mb-1">
                        <p className="text-[11px] text-muted-foreground">
                          거래처 등록 품목
                          <span className="ml-1 text-foreground font-medium">{filtered.length}건</span>
                        </p>
                      </div>
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="등록 품목 검색 (품목명, 제조사)..."
                          value={hpSearch}
                          onChange={(e) => { setHpSearch(e.target.value); setHpPage(1); }}
                          className="pl-8 h-8 text-xs"
                        />
                      </div>
                      {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
                          검색 결과 없음
                        </p>
                      ) : (
                        <>
                          <div className="border rounded-md bg-white">
                            {paged.map((hp) => {
                              const isSelected = selectedProduct?.product_id === hp.product_id;
                              const isAdded = items.some((i) => i.product_id === hp.product_id);
                              return (
                                <button
                                  key={hp.product_id}
                                  type="button"
                                  disabled={isAdded}
                                  className={`flex w-full items-center justify-between px-3 py-2 text-sm border-b last:border-b-0 text-left transition-colors ${
                                    isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-accent"
                                  } ${isAdded ? "opacity-40 cursor-not-allowed" : ""}`}
                                  onClick={() => selectProduct(hp)}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-medium truncate">{hp.product_name}</span>
                                    {hp.manufacturer && <span className="text-xs text-muted-foreground shrink-0">{hp.manufacturer}</span>}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {hp.selling_price != null && (
                                      <span className="text-xs text-muted-foreground">판매 {hp.selling_price.toLocaleString()}원</span>
                                    )}
                                    {isAdded && <Badge variant="outline" className="text-[10px]">추가됨</Badge>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-1 mt-2">
                              <Button
                                variant="outline" size="icon" className="h-7 w-7"
                                disabled={safePage <= 1}
                                onClick={() => setHpPage(safePage - 1)}
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </Button>
                              <span className="text-xs text-muted-foreground px-2">
                                {safePage} / {totalPages}
                              </span>
                              <Button
                                variant="outline" size="icon" className="h-7 w-7"
                                disabled={safePage >= totalPages}
                                onClick={() => setHpPage(safePage + 1)}
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  );
                })()}

                {/* Product search (all products) */}
                <div className="mt-3">
                  <p className="text-[11px] text-muted-foreground mb-1">
                    {hospitalProducts.length > 0 ? "또는 전체 품목에서 검색" : "전체 품목에서 검색"}
                  </p>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="품목명으로 검색..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                  {productSearch.length >= 1 && (
                    <div className="mt-1 border rounded-md max-h-[180px] overflow-y-auto bg-white">
                      {(() => {
                        const filtered = allProducts.filter((p) =>
                          (p.official_name || p.name).toLowerCase().includes(productSearch.toLowerCase())
                        ).slice(0, 30);
                        if (filtered.length === 0) return <p className="text-sm text-muted-foreground text-center py-3">검색 결과 없음</p>;
                        return filtered.map((p) => {
                          const isAdded = items.some((i) => i.product_id === p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={isAdded}
                              className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left border-b last:border-b-0 ${isAdded ? "opacity-40 cursor-not-allowed" : ""}`}
                              onClick={() => {
                                const asHp: HospitalProduct = {
                                  id: 0, hospital_id: hospitalId!, product_id: p.id,
                                  product_name: p.official_name || p.name,
                                  manufacturer: p.manufacturer, standard_code: p.standard_code,
                                  selling_price: null, default_quantity: null, suppliers: [],
                                };
                                selectProduct(asHp);
                                setProductSearch("");
                              }}
                            >
                              <span className="font-medium truncate">{p.official_name || p.name}</span>
                              {isAdded && <Badge variant="outline" className="text-[10px]">추가됨</Badge>}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2-7: Details (only when product selected) */}
              {selectedProduct && (
                <div className="border rounded-lg p-4 bg-white space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Badge variant="secondary">{selectedProduct.product_name}</Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* 2. Supplier */}
                    <div className="col-span-2 md:col-span-1">
                      <Label className="text-xs font-medium">2. 공급사</Label>
                      {productSuppliers.length > 0 ? (
                        <Select
                          value={selectedSupplierId?.toString() ?? ""}
                          onValueChange={(v) => setSelectedSupplierId(Number(v))}
                        >
                          <SelectTrigger className="mt-1 h-9 text-xs">
                            <SelectValue placeholder="선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {productSuppliers.map((s) => (
                              <SelectItem key={s.supplier_id} value={s.supplier_id.toString()}>
                                {s.supplier_name}
                                {s.purchase_price != null && ` — ${s.purchase_price.toLocaleString()}원`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">공급사 없음</p>
                      )}
                      {selectedSupplier?.purchase_price != null && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          매입가: <span className="font-medium">{selectedSupplier.purchase_price.toLocaleString()}원</span>
                        </p>
                      )}
                    </div>

                    {/* 3. Quantity */}
                    <div>
                      <Label className="text-xs font-medium">3. 수량</Label>
                      <Input
                        type="number" min={1} value={addQuantity}
                        onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="mt-1 h-9 text-xs"
                      />
                    </div>

                    {/* 4. Unit */}
                    <div>
                      <Label className="text-xs font-medium">4. 단위</Label>
                      {addCustomUnit ? (
                        <Input
                          value={addUnitType} placeholder="단위 입력"
                          onChange={(e) => setAddUnitType(e.target.value.slice(0, 20))}
                          className="mt-1 h-9 text-xs" autoFocus
                        />
                      ) : (
                        <Select value={addUnitType} onValueChange={(v) => {
                          if (v === CUSTOM_UNIT_VALUE) { setAddCustomUnit(true); setAddUnitType(""); }
                          else setAddUnitType(v);
                        }}>
                          <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                            <SelectItem value={CUSTOM_UNIT_VALUE}>직접입력</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* 5. Selling price */}
                    <div>
                      <Label className="text-xs font-medium">5. 공급가</Label>
                      <Input
                        type="number" min={0} value={addSellingPrice ?? ""}
                        onChange={(e) => setAddSellingPrice(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="0" className="mt-1 h-9 text-xs"
                      />
                      {addSellingPrice != null && addQuantity > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          총액: <span className="font-medium">{(addSellingPrice * addQuantity).toLocaleString()}원</span>
                        </p>
                      )}
                    </div>

                    {/* 7. KPIS */}
                    <div>
                      <Label className="text-xs font-medium">6. KPIS</Label>
                      <Input
                        value={addKpis} placeholder="신고번호"
                        onChange={(e) => setAddKpis(e.target.value.slice(0, 100))}
                        className="mt-1 h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button size="sm" onClick={addLineItem} className="gap-1">
                      <Plus className="h-3.5 w-3.5" />
                      품목 추가
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Line Items Table ─────────────────────────── */}
        <div className="p-6">
          <h3 className="text-sm font-semibold mb-3">
            주문 품목 {items.length > 0 && <span className="text-muted-foreground font-normal">({items.length}건)</span>}
          </h3>

          {items.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg">
              위에서 품목을 추가하세요
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs w-[40px]">#</TableHead>
                    <TableHead className="text-xs min-w-[160px]">품목명</TableHead>
                    <TableHead className="text-xs min-w-[120px]">공급사</TableHead>
                    <TableHead className="text-xs w-[70px] text-right">수량</TableHead>
                    <TableHead className="text-xs w-[60px]">단위</TableHead>
                    <TableHead className="text-xs w-[90px] text-right">매입가</TableHead>
                    <TableHead className="text-xs w-[90px] text-right">공급가</TableHead>
                    <TableHead className="text-xs w-[100px] text-right">금액</TableHead>
                    <TableHead className="text-xs w-[80px]">KPIS</TableHead>
                    <TableHead className="text-xs w-[36px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => {
                    const lineTotal = (item.selling_price ?? 0) * item.quantity;
                    return (
                      <TableRow key={item.key}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium truncate max-w-[200px]">{item.product_name}</div>
                          {item.manufacturer && <div className="text-[11px] text-muted-foreground">{item.manufacturer}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{item.supplier_name ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number" min={1} value={item.quantity}
                            onChange={(e) => updateItem(item.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="h-7 w-[60px] text-xs text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.custom_unit ? item.unit_type : UNIT_OPTIONS.find((u) => u.value === item.unit_type)?.label ?? item.unit_type}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {item.purchase_price != null ? item.purchase_price.toLocaleString() : "-"}
                        </TableCell>
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
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[80px]">
                          {item.kpis_number || "-"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(item.key)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

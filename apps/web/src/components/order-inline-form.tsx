"use client";

import { useState, useEffect } from "react";
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
  Search,
  X,
  Loader2,
} from "lucide-react";
import {
  searchMyItemsAction,
  createOrderAction,
  searchHospitalsAction,
} from "@/app/(dashboard)/orders/actions";
import { SearchableCombobox } from "@/components/searchable-combobox";

// Column label lookup maps
const DRUG_LABELS: Record<string, string> = {
  ITEM_SEQ: "품목기준코드", ITEM_NAME: "품목명", ITEM_ENG_NAME: "영문명",
  ENTP_NAME: "업체명", ENTP_NO: "업체허가번호", ITEM_PERMIT_DATE: "허가일자",
  CNSGN_MANUF: "위탁제조업체", ETC_OTC_CODE: "전문/일반", CHART: "성상",
  BAR_CODE: "표준코드", MATERIAL_NAME: "성분", EE_DOC_ID: "효능효과",
  UD_DOC_ID: "용법용량", NB_DOC_ID: "주의사항", STORAGE_METHOD: "저장방법",
  VALID_TERM: "유효기간", PACK_UNIT: "포장단위", EDI_CODE: "보험코드",
  PERMIT_KIND_NAME: "허가구분", CANCEL_DATE: "취소일자", CANCEL_NAME: "상태",
  CHANGE_DATE: "변경일자", ATC_CODE: "ATC코드", RARE_DRUG_YN: "희귀의약품",
};

const DEVICE_LABELS: Record<string, string> = {
  UDIDI_CD: "UDI-DI코드", PRDLST_NM: "품목명", MNFT_IPRT_ENTP_NM: "제조수입업체명",
  MDEQ_CLSF_NO: "분류번호", CLSF_NO_GRAD_CD: "등급", PERMIT_NO: "품목허가번호",
  PRMSN_YMD: "허가일자", FOML_INFO: "모델명", PRDT_NM_INFO: "제품명",
  HMBD_TRSPT_MDEQ_YN: "인체이식형여부", DSPSBL_MDEQ_YN: "일회용여부",
  TRCK_MNG_TRGT_YN: "추적관리대상", TOTAL_DEV: "한벌구성여부",
  CMBNMD_YN: "조합의료기기", USE_BEFORE_STRLZT_NEED_YN: "사전멸균필요",
  STERILIZATION_METHOD_NM: "멸균방법", USE_PURPS_CONT: "사용목적",
  STRG_CND_INFO: "저장조건", CIRC_CND_INFO: "유통취급조건",
  RCPRSLRY_TRGT_YN: "요양급여대상",
};

type SearchResult = Awaited<ReturnType<typeof searchMyItemsAction>>[number];

interface SelectedItem {
  id: number;
  type: "drug" | "device";
  name: string;
  code: string | null;
  manufacturer: string | null;
  quantity: number;
  unit_price: number | null;
  raw: Record<string, unknown>;
}

interface OrderInlineFormProps {
  displayColumns: { drug: string[]; device: string[] };
  initialNotes?: string;
  sourceMessageId?: string;
}

export function OrderInlineForm({
  displayColumns,
  initialNotes,
  sourceMessageId,
}: OrderInlineFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(!!initialNotes);
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchMyItemsAction(searchQuery);
        setSearchResults(results);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  function addItem(result: SearchResult) {
    if (selectedItems.some((i) => i.id === result.id && i.type === result.type)) {
      toast.error("이미 추가된 품목입니다");
      return;
    }
    setSelectedItems((prev) => [
      ...prev,
      {
        id: result.id, type: result.type, name: result.name,
        code: result.code, manufacturer: result.manufacturer,
        quantity: 1, unit_price: result.unit_price, raw: result.raw,
      },
    ]);
    setSearchQuery("");
    setSearchResults([]);
  }

  function removeItem(index: number) {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItemQuantity(index: number, quantity: number) {
    setSelectedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity } : item)),
    );
  }

  function updateItemPrice(index: number, unit_price: number | null) {
    setSelectedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, unit_price } : item)),
    );
  }

  function getColumnLabel(key: string, type: "drug" | "device"): string {
    return (type === "drug" ? DRUG_LABELS : DEVICE_LABELS)[key] ?? key;
  }

  function getColumnValue(raw: Record<string, unknown>, key: string): string {
    const val = raw[key] ?? raw[key.toLowerCase()] ?? raw[key.toUpperCase()];
    if (val === null || val === undefined) return "";
    return String(val);
  }

  function getDisplayHeaders(): Array<{ key: string; label: string }> {
    const seen = new Set<string>();
    const headers: Array<{ key: string; label: string }> = [];
    for (const col of displayColumns.drug) {
      if (!seen.has(col)) { seen.add(col); headers.push({ key: col, label: getColumnLabel(col, "drug") }); }
    }
    for (const col of displayColumns.device) {
      if (!seen.has(col)) { seen.add(col); headers.push({ key: col, label: getColumnLabel(col, "device") }); }
    }
    return headers;
  }

  async function handleSubmit() {
    if (!hospitalId) { toast.error("거래처를 선택해주세요"); return; }
    if (selectedItems.length === 0) { toast.error("품목을 추가해주세요"); return; }
    setIsSubmitting(true);
    try {
      const result = await createOrderAction({
        hospital_id: hospitalId, order_date: orderDate,
        delivery_date: deliveryDate || null, delivered_at: deliveredAt || null,
        notes: notes || null, source_message_id: sourceMessageId ?? null,
        items: selectedItems.map((item) => ({
          my_item_id: item.id, my_item_type: item.type,
          quantity: item.quantity, unit_price: item.unit_price,
        })),
      });
      toast.success(`주문이 생성되었습니다 (${result.orderNumber})`);
      resetForm();
      if (sourceMessageId) router.replace("/orders");
    } catch (err) {
      toast.error("주문 생성 실패: " + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setIsOpen(false);
    setHospitalId(null);
    setSelectedItems([]);
    setNotes("");
    setDeliveryDate("");
    setDeliveredAt("");
    setSearchQuery("");
    setSearchResults([]);
  }

  function handleClose(open: boolean) {
    if (!open) {
      if (sourceMessageId) router.replace("/orders");
      resetForm();
    }
    setIsOpen(open);
  }

  const displayHeaders = getDisplayHeaders();

  return (
    <>
      {/* Trigger button rendered in the page header */}
      <Button variant="default" size="sm" onClick={() => setIsOpen(true)} className="gap-1.5">
        <PlusCircle className="h-4 w-4" />
        새 주문
      </Button>

      {/* Sheet panel */}
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              새 주문 생성
              {sourceMessageId && (
                <Badge variant="secondary" className="text-xs font-normal">메시지에서</Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5 pt-5">
            {/* Hospital + Dates */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">거래처</Label>
                <SearchableCombobox
                  value={hospitalId}
                  placeholder="거래처 선택"
                  searchPlaceholder="거래처 검색..."
                  emptyText="거래처 없음"
                  onSelect={(id) => setHospitalId(id)}
                  searchAction={searchHospitalsAction}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">주문일</Label>
                  <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">예상배송일</Label>
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">실제배송일</Label>
                  <Input type="date" value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t" />

            {/* Item search */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">품목 추가</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="품목명, 코드, 업체명으로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
                {isSearching && (
                  <Loader2 className="absolute right-2.5 top-2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="rounded-md border bg-popover shadow-lg max-h-[200px] overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                      onClick={() => addItem(result)}
                    >
                      <Badge variant={result.type === "drug" ? "default" : "secondary"} className="text-[10px] shrink-0">
                        {result.type === "drug" ? "약" : "기기"}
                      </Badge>
                      <span className="truncate font-medium text-xs">{result.name}</span>
                      {result.code && <span className="text-muted-foreground text-[10px] shrink-0">{result.code}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected items */}
            {selectedItems.length > 0 && (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] text-[11px]">유형</TableHead>
                      {displayHeaders.map((h) => (
                        <TableHead key={h.key} className="text-[11px]">{h.label}</TableHead>
                      ))}
                      <TableHead className="w-[70px] text-[11px]">수량</TableHead>
                      <TableHead className="w-[90px] text-[11px]">가격</TableHead>
                      <TableHead className="w-[36px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedItems.map((item, index) => {
                      const itemCols = item.type === "drug" ? displayColumns.drug : displayColumns.device;
                      return (
                        <TableRow key={`${item.type}-${item.id}`}>
                          <TableCell>
                            <Badge variant={item.type === "drug" ? "default" : "secondary"} className="text-[10px]">
                              {item.type === "drug" ? "약" : "기기"}
                            </Badge>
                          </TableCell>
                          {displayHeaders.map((h) => (
                            <TableCell key={h.key} className="text-[11px] max-w-[150px] truncate">
                              {itemCols.includes(h.key) ? getColumnValue(item.raw, h.key) : ""}
                            </TableCell>
                          ))}
                          <TableCell>
                            <Input
                              type="number" min={1} value={item.quantity}
                              onChange={(e) => updateItemQuantity(index, Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-[60px] h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number" min={0} value={item.unit_price ?? ""}
                              onChange={(e) => updateItemPrice(index, e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="0" className="w-[80px] h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(index)}>
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

            {selectedItems.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground border rounded-md border-dashed">
                위 검색창에서 품목을 검색하여 추가하세요
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">메모</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="주문 메모..."
                rows={2}
                className="text-sm"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
                취소
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-1 h-4 w-4 animate-spin" />생성 중...</>
                ) : (
                  "주문 생성"
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

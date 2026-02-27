"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  PlusCircle,
  Search,
  X,
  Check,
  ChevronsUpDown,
  Loader2,
} from "lucide-react";
import {
  searchMyItemsAction,
  createOrderAction,
} from "@/app/(dashboard)/orders/actions";

// Column label lookup maps
const DRUG_LABELS: Record<string, string> = {
  ITEM_SEQ: "품목기준코드",
  ITEM_NAME: "품목명",
  ITEM_ENG_NAME: "영문명",
  ENTP_NAME: "업체명",
  ENTP_NO: "업체허가번호",
  ITEM_PERMIT_DATE: "허가일자",
  CNSGN_MANUF: "위탁제조업체",
  ETC_OTC_CODE: "전문/일반",
  CHART: "성상",
  BAR_CODE: "표준코드",
  MATERIAL_NAME: "성분",
  EE_DOC_ID: "효능효과",
  UD_DOC_ID: "용법용량",
  NB_DOC_ID: "주의사항",
  STORAGE_METHOD: "저장방법",
  VALID_TERM: "유효기간",
  PACK_UNIT: "포장단위",
  EDI_CODE: "보험코드",
  PERMIT_KIND_NAME: "허가구분",
  CANCEL_DATE: "취소일자",
  CANCEL_NAME: "상태",
  CHANGE_DATE: "변경일자",
  ATC_CODE: "ATC코드",
  RARE_DRUG_YN: "희귀의약품",
};

const DEVICE_LABELS: Record<string, string> = {
  UDIDI_CD: "UDI-DI코드",
  PRDLST_NM: "품목명",
  MNFT_IPRT_ENTP_NM: "제조수입업체명",
  MDEQ_CLSF_NO: "분류번호",
  CLSF_NO_GRAD_CD: "등급",
  PERMIT_NO: "품목허가번호",
  PRMSN_YMD: "허가일자",
  FOML_INFO: "모델명",
  PRDT_NM_INFO: "제품명",
  HMBD_TRSPT_MDEQ_YN: "인체이식형여부",
  DSPSBL_MDEQ_YN: "일회용여부",
  TRCK_MNG_TRGT_YN: "추적관리대상",
  TOTAL_DEV: "한벌구성여부",
  CMBNMD_YN: "조합의료기기",
  USE_BEFORE_STRLZT_NEED_YN: "사전멸균필요",
  STERILIZATION_METHOD_NM: "멸균방법",
  USE_PURPS_CONT: "사용목적",
  STRG_CND_INFO: "저장조건",
  CIRC_CND_INFO: "유통취급조건",
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
  hospitals: Array<{ id: number; name: string }>;
  displayColumns: { drug: string[]; device: string[] };
}

export function OrderInlineForm({
  hospitals,
  displayColumns,
}: OrderInlineFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hospitalOpen, setHospitalOpen] = useState(false);

  // Debounced item search
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
    // Prevent duplicate
    if (
      selectedItems.some((i) => i.id === result.id && i.type === result.type)
    ) {
      toast.error("이미 추가된 품목입니다");
      return;
    }
    setSelectedItems((prev) => [
      ...prev,
      {
        id: result.id,
        type: result.type,
        name: result.name,
        code: result.code,
        manufacturer: result.manufacturer,
        quantity: 1,
        unit_price: result.unit_price,
        raw: result.raw,
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

  // Get the label for a column key
  function getColumnLabel(key: string, type: "drug" | "device"): string {
    const labels = type === "drug" ? DRUG_LABELS : DEVICE_LABELS;
    return labels[key] ?? key;
  }

  // Get the value for a column key from the raw record
  function getColumnValue(
    raw: Record<string, unknown>,
    key: string,
  ): string {
    // Keys in displayColumns are UPPERCASE (e.g., "ITEM_NAME"),
    // raw keys from DB are lowercase (e.g., "item_name")
    const dbKey = key.toLowerCase();
    const val = raw[dbKey];
    if (val === null || val === undefined) return "";
    return String(val);
  }

  // Collect all unique column keys used by selected items
  function getDisplayHeaders(): Array<{
    key: string;
    label: string;
  }> {
    const seen = new Set<string>();
    const headers: Array<{ key: string; label: string }> = [];

    for (const item of selectedItems) {
      const cols =
        item.type === "drug" ? displayColumns.drug : displayColumns.device;
      for (const col of cols) {
        if (!seen.has(col)) {
          seen.add(col);
          headers.push({ key: col, label: getColumnLabel(col, item.type) });
        }
      }
    }
    return headers;
  }

  async function handleSubmit() {
    if (!hospitalId) {
      toast.error("거래처를 선택해주세요");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("품목을 추가해주세요");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createOrderAction({
        hospital_id: hospitalId,
        order_date: orderDate,
        delivery_date: deliveryDate || null,
        delivered_at: deliveredAt || null,
        notes: notes || null,
        items: selectedItems.map((item) => ({
          my_item_id: item.id,
          my_item_type: item.type,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      });
      toast.success(`주문이 생성되었습니다 (${result.orderNumber})`);
      // Reset form
      setIsOpen(false);
      setHospitalId(null);
      setSelectedItems([]);
      setNotes("");
      setDeliveryDate("");
      setDeliveredAt("");
    } catch (err) {
      toast.error("주문 생성 실패: " + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    setIsOpen(false);
    setHospitalId(null);
    setSelectedItems([]);
    setNotes("");
    setDeliveryDate("");
    setDeliveredAt("");
    setSearchQuery("");
    setSearchResults([]);
  }

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1"
      >
        <PlusCircle className="h-4 w-4" />
        주문 추가
      </Button>
    );
  }

  const displayHeaders = getDisplayHeaders();

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          새 주문 생성
          <span className="text-xs text-muted-foreground font-normal ml-2">
            주문번호: 자동생성
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Header row: Hospital + Dates */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Hospital combobox */}
          <div className="space-y-1">
            <Label className="text-xs">거래처</Label>
            <Popover open={hospitalOpen} onOpenChange={setHospitalOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-[200px] justify-between"
                >
                  {hospitalId
                    ? hospitals.find((h) => h.id === hospitalId)?.name
                    : "거래처 선택"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="거래처 검색..." />
                  <CommandList>
                    <CommandEmpty>결과 없음</CommandEmpty>
                    <CommandGroup>
                      {hospitals.map((h) => (
                        <CommandItem
                          key={h.id}
                          value={h.name}
                          onSelect={() => {
                            setHospitalId(h.id);
                            setHospitalOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              hospitalId === h.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {h.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">주문일</Label>
            <Input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-[160px]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">예상배송일</Label>
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-[160px]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">실제배송일</Label>
            <Input
              type="date"
              value={deliveredAt}
              onChange={(e) => setDeliveredAt(e.target.value)}
              className="w-[160px]"
            />
          </div>
        </div>

        {/* Item search */}
        <div className="relative">
          <Label className="text-xs mb-1 block">품목 검색</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="품목명, 코드, 업체명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
            {isSearching && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-[300px] overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent text-left"
                  onClick={() => addItem(result)}
                >
                  <Badge
                    variant={
                      result.type === "drug" ? "default" : "secondary"
                    }
                    className="text-xs shrink-0"
                  >
                    {result.type === "drug" ? "의약품" : "의료기기"}
                  </Badge>
                  <span className="truncate font-medium">{result.name}</span>
                  {result.code && (
                    <span className="text-muted-foreground text-xs shrink-0">
                      {result.code}
                    </span>
                  )}
                  {result.manufacturer && (
                    <span className="text-muted-foreground text-xs shrink-0">
                      {result.manufacturer}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected items table */}
        {selectedItems.length > 0 && (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px] text-xs">유형</TableHead>
                  {displayHeaders.map((h) => (
                    <TableHead key={h.key} className="text-xs">
                      {h.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-[80px] text-xs">수량</TableHead>
                  <TableHead className="w-[100px] text-xs">가격</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedItems.map((item, index) => {
                  const itemCols =
                    item.type === "drug"
                      ? displayColumns.drug
                      : displayColumns.device;
                  return (
                    <TableRow key={`${item.type}-${item.id}`}>
                      <TableCell>
                        <Badge
                          variant={
                            item.type === "drug" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {item.type === "drug" ? "의약품" : "의료기기"}
                        </Badge>
                      </TableCell>
                      {displayHeaders.map((h) => (
                        <TableCell
                          key={h.key}
                          className="text-xs max-w-[200px] truncate"
                        >
                          {itemCols.includes(h.key)
                            ? getColumnValue(item.raw, h.key)
                            : ""}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemQuantity(
                              index,
                              Math.max(1, parseInt(e.target.value) || 1),
                            )
                          }
                          className="w-[70px] h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={item.unit_price ?? ""}
                          onChange={(e) =>
                            updateItemPrice(
                              index,
                              e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            )
                          }
                          placeholder="0"
                          className="w-[90px] h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeItem(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Footer: notes + buttons */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">메모</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="주문 메모..."
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                "주문 생성"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

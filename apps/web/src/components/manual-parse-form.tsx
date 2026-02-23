"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { createManualOrder } from "@/app/(dashboard)/messages/actions";
import type { Hospital, Product } from "@/lib/types";

interface ParseItem {
  product_id: string;
  quantity: string;
  unit_price: string;
}

export function ManualParseForm({
  messageId,
  hospitals,
  products,
  onSuccess,
}: {
  messageId: number;
  hospitals: Hospital[];
  products: Product[];
  onSuccess?: (orderNumber: string) => void;
}) {
  const [hospitalId, setHospitalId] = useState("");
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const [items, setItems] = useState<ParseItem[]>([
    { product_id: "", quantity: "1", unit_price: "" },
  ]);
  const [productOpenIdx, setProductOpenIdx] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedHospital = hospitals.find((h) => String(h.id) === hospitalId);

  function addItem() {
    setItems((prev) => [...prev, { product_id: "", quantity: "1", unit_price: "" }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof ParseItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        // Auto-fill unit_price when product is selected
        if (field === "product_id") {
          const product = products.find((p) => String(p.id) === value);
          if (product?.unit_price) {
            updated.unit_price = String(product.unit_price);
          }
        }
        return updated;
      }),
    );
  }

  function handleSubmit() {
    if (!hospitalId) {
      toast.error("거래처를 선택해주세요.");
      return;
    }
    const validItems = items.filter((i) => i.product_id && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      toast.error("최소 1개의 품목을 추가해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createManualOrder(
          messageId,
          Number(hospitalId),
          validItems.map((i) => ({
            product_id: Number(i.product_id),
            quantity: Number(i.quantity),
            unit_price: Number(i.unit_price) || 0,
          })),
        );
        toast.success(`주문 ${result.orderNumber}이 생성되었습니다.`);
        onSuccess?.(result.orderNumber);
      } catch {
        toast.error("주문 생성에 실패했습니다.");
      }
    });
  }

  function getProductName(productId: string): string {
    const p = products.find((p) => String(p.id) === productId);
    return p?.name ?? "";
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>거래처</Label>
        <Popover open={hospitalOpen} onOpenChange={setHospitalOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={hospitalOpen}
              className="w-full justify-between font-normal"
            >
              {selectedHospital ? selectedHospital.name : "거래처 검색..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="거래처명 검색..." />
              <CommandList>
                <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                <CommandGroup>
                  {hospitals.map((h) => (
                    <CommandItem
                      key={h.id}
                      value={`${h.name} ${h.short_name ?? ""} ${h.contact_person ?? ""}`}
                      onSelect={() => {
                        setHospitalId(String(h.id));
                        setHospitalOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          hospitalId === String(h.id) ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{h.name}</span>
                        {h.contact_person && (
                          <span className="text-xs text-muted-foreground">{h.contact_person}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-3">
        <Label>주문 항목</Label>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <div className="flex-1">
              {idx === 0 && <span className="text-xs text-muted-foreground">품목</span>}
              <Popover
                open={productOpenIdx === idx}
                onOpenChange={(open: boolean) => setProductOpenIdx(open ? idx : null)}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productOpenIdx === idx}
                    className="w-full justify-between font-normal"
                  >
                    {item.product_id ? getProductName(item.product_id) : "품목 검색..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="품목명, 제조사 검색..." />
                    <CommandList>
                      <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                      <CommandGroup>
                        {products.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.name} ${p.official_name} ${p.short_name ?? ""} ${p.manufacturer ?? ""} ${p.category}`}
                            onSelect={() => {
                              updateItem(idx, "product_id", String(p.id));
                              setProductOpenIdx(null);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                item.product_id === String(p.id) ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{p.name}</span>
                              <span className="text-xs text-muted-foreground truncate">
                                {[p.manufacturer, p.category].filter(Boolean).join(" · ")}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="w-20">
              {idx === 0 && <span className="text-xs text-muted-foreground">수량</span>}
              <Input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => updateItem(idx, "quantity", e.target.value)}
              />
            </div>
            <div className="w-28">
              {idx === 0 && <span className="text-xs text-muted-foreground">단가</span>}
              <Input
                type="number"
                min="0"
                value={item.unit_price}
                onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                placeholder="0"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => removeItem(idx)}
              disabled={items.length <= 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-1" /> 항목 추가
        </Button>
      </div>

      <Button className="w-full" onClick={handleSubmit} disabled={isPending}>
        {isPending ? "처리중..." : "주문 생성"}
      </Button>
    </div>
  );
}

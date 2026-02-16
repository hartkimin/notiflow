"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [items, setItems] = useState<ParseItem[]>([
    { product_id: "", quantity: "1", unit_price: "" },
  ]);
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="space-y-4">
      <div>
        <Label>거래처</Label>
        <Select value={hospitalId} onValueChange={setHospitalId}>
          <SelectTrigger>
            <SelectValue placeholder="거래처 선택" />
          </SelectTrigger>
          <SelectContent>
            {hospitals.map((h) => (
              <SelectItem key={h.id} value={String(h.id)}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label>주문 항목</Label>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <div className="flex-1">
              {idx === 0 && <span className="text-xs text-muted-foreground">품목</span>}
              <Select
                value={item.product_id}
                onValueChange={(v) => updateItem(idx, "product_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="품목 선택" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

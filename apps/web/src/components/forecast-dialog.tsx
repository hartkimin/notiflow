"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { createForecast } from "@/app/(dashboard)/messages/forecast-actions";
import type { Hospital, Product } from "@/lib/types";

interface ForecastItemState {
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_type: string;
}

interface ForecastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitals: Hospital[];
  products: Product[];
  initialDate?: string;
}

export function ForecastDialog({
  open, onOpenChange, hospitals, products, initialDate,
}: ForecastDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const [forecastDate, setForecastDate] = useState(initialDate ?? "");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ForecastItemState[]>([]);

  const selectedHospital = hospitals.find((h) => h.id === hospitalId);

  function addItem() {
    setItems([...items, { product_id: null, product_name: "", quantity: 1, unit_type: "piece" }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, update: Partial<ForecastItemState>) {
    setItems(items.map((item, i) => (i === index ? { ...item, ...update } : item)));
  }

  function handleSubmit() {
    if (!hospitalId || !forecastDate) {
      toast.error("거래처와 날짜를 선택해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        await createForecast({
          hospital_id: hospitalId,
          forecast_date: forecastDate,
          notes: notes || undefined,
          items: items.length > 0
            ? items.map((i) => ({
                product_id: i.product_id,
                product_name: i.product_name || undefined,
                quantity: i.quantity,
                unit_type: i.unit_type,
              }))
            : undefined,
        });
        toast.success("예상 주문이 등록되었습니다.");
        onOpenChange(false);
        resetForm();
        router.refresh();
      } catch (err) {
        toast.error(`등록 실패: ${(err as Error).message}`);
      }
    });
  }

  function resetForm() {
    setHospitalId(null);
    setForecastDate(initialDate ?? "");
    setNotes("");
    setItems([]);
  }

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>예상 주문 등록</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date */}
          <div className="space-y-1.5">
            <Label>날짜</Label>
            <Input
              type="date"
              value={forecastDate}
              onChange={(e) => setForecastDate(e.target.value)}
            />
          </div>

          {/* Hospital */}
          <div className="space-y-1.5">
            <Label>거래처</Label>
            <Popover open={hospitalOpen} onOpenChange={setHospitalOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
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
                      {hospitals.filter((h) => h.is_active).map((h) => (
                        <CommandItem
                          key={h.id}
                          value={`${h.name} ${h.short_name ?? ""}`}
                          onSelect={() => { setHospitalId(h.id); setHospitalOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", hospitalId === h.id ? "opacity-100" : "opacity-0")} />
                          {h.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Items */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>예상 품목</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />품목 추가
              </Button>
            </div>
            {items.map((item, i) => (
              <ForecastItemRow
                key={i}
                item={item}
                products={products}
                onChange={(update) => updateItem(i, update)}
                onRemove={() => removeItem(i)}
              />
            ))}
            {items.length === 0 && (
              <p className="text-xs text-muted-foreground">품목 없이 노트만으로도 등록할 수 있습니다.</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>노트</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="메모 (선택사항)"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "등록중..." : "등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ForecastItemRow({
  item, products, onChange, onRemove,
}: {
  item: ForecastItemState;
  products: Product[];
  onChange: (update: Partial<ForecastItemState>) => void;
  onRemove: () => void;
}) {
  const [productOpen, setProductOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Popover open={productOpen} onOpenChange={setProductOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal text-xs h-8">
            {item.product_id
              ? products.find((p) => p.id === item.product_id)?.name ?? item.product_name
              : item.product_name || "품목 선택..."}
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="품목 검색..." />
            <CommandList>
              <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
              <CommandGroup>
                {products.filter((p) => p.is_active).map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.name} ${p.short_name ?? ""} ${p.official_name ?? ""}`}
                    onSelect={() => {
                      onChange({ product_id: p.id, product_name: p.name });
                      setProductOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-3 w-3", item.product_id === p.id ? "opacity-100" : "opacity-0")} />
                    <span className="text-xs">{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        type="number"
        min={1}
        value={item.quantity}
        onChange={(e) => onChange({ quantity: parseInt(e.target.value) || 1 })}
        className="w-20 h-8 text-xs"
        placeholder="수량"
      />

      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

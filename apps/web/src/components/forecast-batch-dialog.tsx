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
import { createForecastBatch } from "@/app/(dashboard)/messages/forecast-actions";
import { getWeekMonday, getWeekDates, toLocalDateStr } from "@/lib/schedule-utils";
import type { Hospital, Product } from "@/lib/types";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

interface ForecastBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitals: Hospital[];
  products: Product[];
  referenceDate: Date;
}

export function ForecastBatchDialog({
  open, onOpenChange, hospitals, products, referenceDate,
}: ForecastBatchDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const monday = getWeekMonday(referenceDate);
  const weekDates = getWeekDates(monday);

  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Array<{ product_id: number | null; product_name: string; quantity: number }>>([]);

  const selectedHospital = hospitals.find((h) => h.id === hospitalId);

  function toggleDay(index: number) {
    const next = [...selectedDays];
    next[index] = !next[index];
    setSelectedDays(next);
  }

  function addItem() {
    setItems([...items, { product_id: null, product_name: "", quantity: 1 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, update: Partial<typeof items[number]>) {
    setItems(items.map((item, i) => (i === index ? { ...item, ...update } : item)));
  }

  function handleSubmit() {
    if (!hospitalId) {
      toast.error("거래처를 선택해주세요.");
      return;
    }

    const dates = weekDates
      .filter((_, i) => selectedDays[i])
      .map((d) => toLocalDateStr(d));

    if (dates.length === 0) {
      toast.error("최소 1일을 선택해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createForecastBatch({
          hospital_id: hospitalId,
          dates,
          notes: notes || undefined,
          items: items.length > 0 ? items : undefined,
        });
        toast.success(`${result.created}건의 예상 주문이 등록되었습니다.`);
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
    setSelectedDays([true, true, true, true, true, false, false]);
    setNotes("");
    setItems([]);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>주간 예상 일괄 등록</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hospital */}
          <div className="space-y-1.5">
            <Label>거래처</Label>
            <Popover open={hospitalOpen} onOpenChange={setHospitalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
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

          {/* Day selection */}
          <div className="space-y-1.5">
            <Label>요일 선택</Label>
            <div className="flex gap-2">
              {weekDates.map((date, i) => (
                <label
                  key={i}
                  className={cn(
                    "flex flex-col items-center gap-1 px-2 py-1.5 rounded-md border cursor-pointer transition-colors",
                    selectedDays[i] ? "bg-primary/10 border-primary" : "hover:bg-muted",
                  )}
                  onClick={() => toggleDay(i)}
                >
                  <span className="text-xs font-medium">{DAY_LABELS[i]}</span>
                  <span className="text-[10px] text-muted-foreground">{date.getDate()}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>공통 품목</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />품목 추가
              </Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal text-xs h-8">
                      {item.product_id
                        ? products.find((p) => p.id === item.product_id)?.name ?? item.product_name
                        : "품목 선택..."}
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
                              value={`${p.name} ${p.short_name ?? ""}`}
                              onSelect={() => updateItem(i, { product_id: p.id, product_name: p.name })}
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
                  onChange={(e) => updateItem(i, { quantity: parseInt(e.target.value) || 1 })}
                  className="w-20 h-8 text-xs"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeItem(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>노트</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="메모 (선택사항)"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "등록중..." : `${selectedDays.filter(Boolean).length}일 일괄 등록`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

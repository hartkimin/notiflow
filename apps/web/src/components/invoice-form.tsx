"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createInvoiceFromOrder,
  createConsolidatedInvoice,
} from "@/lib/tax-invoice/service";
import type { UnbilledOrder } from "@/lib/tax-invoice/types";
import type { Hospital } from "@/lib/types";

interface InvoiceFormProps {
  orders: UnbilledOrder[];
  hospitals: Hospital[];
}

export default function InvoiceForm({ orders, hospitals }: InvoiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [hospitalFilter, setHospitalFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [issueDate, setIssueDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });

  const filteredOrders = useMemo(() => {
    if (hospitalFilter === "all") return orders;
    return orders.filter((o) => o.hospital_id === Number(hospitalFilter));
  }, [orders, hospitalFilter]);

  const allSelected =
    filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.has(o.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    }
  }

  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)),
    [orders, selectedIds],
  );

  const summary = useMemo(() => {
    return selectedOrders.reduce(
      (acc, o) => ({
        supply: acc.supply + (o.supply_amount || 0),
        tax: acc.tax + (o.tax_amount || 0),
        total: acc.total + (o.total_amount || 0),
      }),
      { supply: 0, tax: 0, total: 0 },
    );
  }, [selectedOrders]);

  const allItems = useMemo(() => {
    return selectedOrders.flatMap((o) =>
      (o.items ?? []).map((item) => ({ ...item, order_number: o.order_number }))
    );
  }, [selectedOrders]);

  function handleSubmit() {
    if (selectedIds.size === 0) return;

    const hospitalIds = [...new Set(selectedOrders.map((o) => o.hospital_id))];
    if (hospitalIds.length > 1) {
      toast.error("합산 발행은 같은 병원의 주문만 가능합니다. 병원을 필터링하여 선택해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        let result: { invoiceId: number };
        const ids = [...selectedIds];
        if (ids.length === 1) {
          result = await createInvoiceFromOrder(ids[0], issueDate);
        } else {
          result = await createConsolidatedInvoice(ids, issueDate);
        }
        toast.success("세금계산서가 생성되었습니다.");
        router.push(`/invoices/${result.invoiceId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "세금계산서 생성에 실패했습니다.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Order selection */}
      <Card>
        <CardHeader>
          <CardTitle>미발행 주문 선택</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={hospitalFilter} onValueChange={setHospitalFilter}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="전체 병원" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 병원</SelectItem>
                {hospitals.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {allSelected ? "선택 해제" : "전체 선택"}
            </Button>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              미발행 주문이 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>주문번호</TableHead>
                  <TableHead>주문일</TableHead>
                  <TableHead>병원</TableHead>
                  <TableHead className="text-right">품목수</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(order.id)}
                        onCheckedChange={() => toggleOne(order.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.order_date}</TableCell>
                    <TableCell>{order.hospital_name || "-"}</TableCell>
                    <TableCell className="text-right">{order.items?.length ?? 0}</TableCell>
                    <TableCell className="text-right">
                      ₩{(order.total_amount || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Selected items preview */}
      {allItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>발행 품목 내역 ({allItems.length}건)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">주문번호</TableHead>
                    <TableHead className="text-xs">품목명</TableHead>
                    <TableHead className="text-xs text-right w-14">수량</TableHead>
                    <TableHead className="text-xs text-right w-20">매입단가</TableHead>
                    <TableHead className="text-xs text-right w-20">매출단가</TableHead>
                    <TableHead className="text-xs text-right w-20">매출액</TableHead>
                    <TableHead className="text-xs text-right w-20">이익</TableHead>
                    <TableHead className="text-xs w-16">담당자</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allItems.map((item, idx) => {
                    const profit = ((item.unit_price ?? 0) - (item.purchase_price ?? 0)) * item.quantity;
                    return (
                      <TableRow key={`${item.id}-${idx}`}>
                        <TableCell className="text-xs text-muted-foreground">{item.order_number}</TableCell>
                        <TableCell className="text-xs">{item.product_name || "-"}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{item.quantity}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{item.purchase_price?.toLocaleString() ?? "-"}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{item.unit_price?.toLocaleString() ?? "-"}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{item.line_total?.toLocaleString() ?? "-"}</TableCell>
                        <TableCell className={`text-xs text-right tabular-nums ${profit < 0 ? "text-red-500" : "text-green-600"}`}>
                          {profit.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">{item.sales_rep || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Issue info */}
      <Card>
        <CardHeader>
          <CardTitle>발행 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label htmlFor="issue-date" className="text-sm font-medium whitespace-nowrap">
              작성일자
            </label>
            <Input
              id="issue-date"
              type="date"
              className="w-[200px]"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>

          <div className="rounded-md border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">선택 건수</span>
              <span className="font-medium">{selectedIds.size}건 ({allItems.length}품목)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">공급가액</span>
              <span>₩{summary.supply.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">세액</span>
              <span>₩{summary.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-medium border-t pt-2">
              <span>합계</span>
              <span>₩{summary.total.toLocaleString()}</span>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={selectedIds.size === 0 || isPending}
            onClick={handleSubmit}
          >
            {isPending ? "생성 중..." : "세금계산서 생성"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

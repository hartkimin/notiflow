"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronRight,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { confirmOrderAction, updateOrderStatusAction } from "@/app/(dashboard)/orders/actions";
import { toast } from "sonner";
import type { OrderItemFlat } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "임시",
  confirmed: "확인됨",
  processing: "처리중",
  delivered: "배송완료",
  cancelled: "취소",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  confirmed: "default",
  processing: "default",
  delivered: "outline",
  cancelled: "destructive",
};

const KPIS_LABEL: Record<string, string> = {
  pending: "미신고",
  reported: "신고완료",
  confirmed: "확인됨",
};

const KPIS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  reported: "default",
  confirmed: "outline",
};

interface OrderGroup {
  order_id: number;
  order_number: string;
  order_date: string;
  delivery_date: string | null;
  hospital_name: string;
  status: string;
  items: OrderItemFlat[];
}

function formatMMDD(dateStr: string | null): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[1]}/${parts[2]}`;
}

export function OrderTable({ items }: { items: OrderItemFlat[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const groups = useMemo(() => {
    const map = new Map<number, OrderGroup>();
    for (const item of items) {
      let group = map.get(item.order_id);
      if (!group) {
        group = {
          order_id: item.order_id,
          order_number: item.order_number,
          order_date: item.order_date,
          delivery_date: item.delivery_date,
          hospital_name: item.hospital_name,
          status: item.status,
          items: [],
        };
        map.set(item.order_id, group);
      }
      group.items.push(item);
    }
    return Array.from(map.values());
  }, [items]);

  function toggleExpand(orderId: number) {
    setExpandedId((prev) => (prev === orderId ? null : orderId));
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[28px]" />
            <TableHead className="w-[120px]">주문번호</TableHead>
            <TableHead className="w-[70px]">발주일</TableHead>
            <TableHead className="w-[70px]">배송일</TableHead>
            <TableHead>거래처</TableHead>
            <TableHead className="text-right w-[60px]">품목수</TableHead>
            <TableHead className="w-[80px]">상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-24 text-center text-muted-foreground"
              >
                주문이 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => {
              const isExpanded = expandedId === group.order_id;
              return (
                <OrderGroupRow
                  key={group.order_id}
                  group={group}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpand(group.order_id)}
                />
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function OrderGroupRow({
  group,
  isExpanded,
  onToggle,
}: {
  group: OrderGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* Summary row */}
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        data-state={isExpanded && "selected"}
        onClick={onToggle}
      >
        <TableCell className="px-2">
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? "rotate-90" : ""
            }`}
          />
        </TableCell>
        <TableCell className="text-sm font-medium tabular-nums">
          {group.order_number}
        </TableCell>
        <TableCell className="text-sm tabular-nums">
          {formatMMDD(group.order_date)}
        </TableCell>
        <TableCell className="text-sm tabular-nums">
          {formatMMDD(group.delivery_date)}
        </TableCell>
        <TableCell className="text-sm">
          {group.hospital_name}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {group.items.length}
        </TableCell>
        <TableCell>
          <Badge
            variant={STATUS_VARIANT[group.status] ?? "secondary"}
            className="text-xs"
          >
            {STATUS_LABEL[group.status] ?? group.status}
          </Badge>
        </TableCell>
      </TableRow>

      {/* Accordion detail */}
      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={7} className="p-0">
            <OrderAccordionContent group={group} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function OrderAccordionContent({ group }: { group: OrderGroup }) {
  async function handleConfirm() {
    try {
      await confirmOrderAction(group.order_id);
      toast.success("주문이 확인되었습니다.");
    } catch {
      toast.error("주문 확인에 실패했습니다.");
    }
  }

  async function handleCancel() {
    try {
      await updateOrderStatusAction(group.order_id, "cancelled");
      toast.success("주문이 취소되었습니다.");
    } catch {
      toast.error("주문 취소에 실패했습니다.");
    }
  }

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Order info summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">주문번호</span>
          <p className="font-medium">{group.order_number}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">주문일</span>
          <p>{group.order_date}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">배송예정</span>
          <p>{group.delivery_date || "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">상태</span>
          <p>
            <Badge variant={STATUS_VARIANT[group.status] ?? "secondary"}>
              {STATUS_LABEL[group.status] ?? group.status}
            </Badge>
          </p>
        </div>
      </div>

      <Separator />

      {/* Items table */}
      <div>
        <h4 className="mb-2 text-sm font-medium">
          주문 품목 ({group.items.length}건)
        </h4>
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">품목</TableHead>
                <TableHead className="text-xs text-right w-[70px]">수량/개</TableHead>
                <TableHead className="text-xs text-right w-[70px]">수량/박스</TableHead>
                <TableHead className="text-xs w-[80px]">매입처</TableHead>
                <TableHead className="text-xs w-[80px]">KPIS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm font-medium">
                    {item.product_name}
                    {item.match_status !== "matched" && (
                      <Badge variant="outline" className="text-xs ml-2">
                        {item.match_status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.box_quantity != null ? item.box_quantity.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.supplier_name ?? "-"}
                  </TableCell>
                  <TableCell>
                    {item.kpis_status ? (
                      <Badge
                        variant={KPIS_VARIANT[item.kpis_status] ?? "secondary"}
                        className="text-xs"
                      >
                        {KPIS_LABEL[item.kpis_status] ?? item.kpis_status}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {group.status === "draft" && (
          <Button size="sm" onClick={handleConfirm}>
            주문 확인
          </Button>
        )}
        {group.status === "draft" && (
          <Button size="sm" variant="destructive" onClick={handleCancel}>
            취소
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link href={`/orders/${group.order_id}`}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            상세 페이지
          </Link>
        </Button>
      </div>
    </div>
  );
}

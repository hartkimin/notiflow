"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManualParseForm } from "@/components/manual-parse-form";
import type { RawMessage, Hospital, Product } from "@/lib/types";

interface OrderPanelProps {
  message: RawMessage | null;
  hospitals: Hospital[];
  products: Product[];
}

export function OrderPanel({ message, hospitals, products }: OrderPanelProps) {
  const router = useRouter();

  if (!message) {
    return (
      <div className="flex flex-col w-[280px] shrink-0 border-l">
        <div className="px-3 py-2 border-b">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">주문</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">메시지를 선택하세요</p>
        </div>
      </div>
    );
  }

  if (message.order_id) {
    return (
      <div className="flex flex-col w-[280px] shrink-0 border-l">
        <div className="px-3 py-2 border-b">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">주문 정보</h3>
        </div>
        <div className="flex-1 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">주문 #{message.order_id}</span>
          </div>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={`/orders/${message.order_id}`}>주문 상세 보기</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[280px] shrink-0 border-l">
      <div className="px-3 py-2 border-b">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">주문 생성</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <ManualParseForm
          messageId={message.id}
          hospitals={hospitals}
          products={products}
          onSuccess={() => router.refresh()}
        />
      </div>
    </div>
  );
}

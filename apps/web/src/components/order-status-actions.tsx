"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmOrderAction, updateOrderStatusAction } from "@/app/(dashboard)/orders/actions";

const NEXT_STATUS: Record<string, { label: string; status: string } | null> = {
  draft: { label: "주문 확인", status: "confirmed" },
  confirmed: { label: "처리 시작", status: "processing" },
  processing: { label: "배송 완료", status: "delivered" },
  delivered: null,
  cancelled: null,
};

export function OrderStatusActions({
  orderId,
  currentStatus,
}: {
  orderId: number;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const next = NEXT_STATUS[currentStatus];

  if (!next) return null;

  return (
    <Button
      size="sm"
      className="h-8"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            if (currentStatus === "draft") {
              await confirmOrderAction(orderId);
            } else {
              await updateOrderStatusAction(orderId, next.status);
            }
            toast.success(`주문 상태가 변경되었습니다.`);
            router.refresh();
          } catch {
            toast.error("상태 변경에 실패했습니다.");
          }
        })
      }
    >
      {isPending ? "처리중..." : next.label}
    </Button>
  );
}

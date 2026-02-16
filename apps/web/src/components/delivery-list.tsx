"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { markDeliveredAction } from "@/app/(dashboard)/deliveries/actions";
import { toast } from "sonner";
import type { Delivery } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { Truck } from "lucide-react";

export function DeliveryList({ deliveries }: { deliveries: Delivery[] }) {
  async function handleDeliver(orderId: number) {
    try {
      await markDeliveredAction(orderId);
      toast.success("배송완료 처리되었습니다.");
    } catch {
      toast.error("처리에 실패했습니다.");
    }
  }

  if (deliveries.length === 0) {
    return <EmptyState icon={Truck} title="오늘 배송 예정이 없습니다." />;
  }

  return (
    <div className="space-y-3">
      {deliveries.map((d) => (
        <Card key={d.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{d.order_number}</p>
              <p className="text-sm text-muted-foreground">
                {d.total_items}품목 | 배송일: {d.delivery_date}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{d.status}</Badge>
              <Button size="sm" onClick={() => handleDeliver(d.id)}>
                배송완료
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

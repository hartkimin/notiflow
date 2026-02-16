import { getTodayDeliveries } from "@/lib/queries/deliveries";
import { DeliveryList } from "@/components/delivery-list";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function DeliveriesPage() {
  const result = await getTodayDeliveries().catch(() => ({ count: 0, deliveries: [] }));

  return (
    <>
      <div className="flex items-center">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold md:text-2xl">배송현황</h1>
          <Badge variant="secondary">{result.count}건</Badge>
        </div>
      </div>
      <DeliveryList deliveries={result.deliveries} />
    </>
  );
}

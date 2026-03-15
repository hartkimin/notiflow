import { getOrderDisplayColumns } from "@/lib/queries/settings";
import { PurchaseOrderForm } from "@/components/purchase-order-form";

interface Props {
  searchParams: Promise<{ source_message_id?: string }>;
}

export default async function NewOrderPage({ searchParams }: Props) {
  const params = await searchParams;
  const displayColumns = await getOrderDisplayColumns();

  return (
    <div className="space-y-4">
      <PurchaseOrderForm
        displayColumns={displayColumns}
        sourceMessageId={params.source_message_id}
      />
    </div>
  );
}

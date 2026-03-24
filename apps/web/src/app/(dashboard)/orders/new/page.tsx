import { getOrderDisplayColumns, getOrderColumnWidths } from "@/lib/queries/settings";
import { getMessagesByIds, formatMessagesAsNotes } from "@/lib/queries/messages";
import { getSuppliers } from "@/lib/queries/suppliers";
import { PurchaseOrderForm } from "@/components/purchase-order-form";

interface Props {
  searchParams: Promise<{ source_message_id?: string; source_message_ids?: string }>;
}

export default async function NewOrderPage({ searchParams }: Props) {
  const params = await searchParams;

  const ids = params.source_message_ids?.split(",").filter(Boolean) || [];
  if (!ids.length && params.source_message_id) ids.push(params.source_message_id);

  const [displayColumns, columnWidths, messages, { suppliers: allSuppliers }] = await Promise.all([
    getOrderDisplayColumns(),
    getOrderColumnWidths(),
    ids.length ? getMessagesByIds(ids) : Promise.resolve([]),
    getSuppliers({ limit: 500 }),
  ]);

  const initialNotes = messages.length ? formatMessagesAsNotes(messages) : "";

  const sourceMessages = messages.map((m) => ({
    id: m.id,
    sender: m.sender,
    app_name: m.app_name || m.source_app,
    content: m.content,
    received_at: m.received_at,
  }));

  return (
    <div className="space-y-4">
      <PurchaseOrderForm
        displayColumns={displayColumns}
        columnWidths={columnWidths}
        sourceMessageId={ids[0]}
        initialNotes={initialNotes}
        sourceMessages={sourceMessages}
        suppliers={allSuppliers.map(s => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}

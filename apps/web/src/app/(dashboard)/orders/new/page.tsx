import { getOrderDisplayColumns, getOrderColumnWidths } from "@/lib/queries/settings";
import { getMessagesByIds, formatMessagesAsNotes } from "@/lib/queries/messages";
import { getSuppliers } from "@/lib/queries/suppliers";
import { PurchaseOrderForm } from "@/components/purchase-order-form";
import { createClient } from "@/lib/supabase/server";

interface Props {
  searchParams: Promise<{ source_message_id?: string; source_message_ids?: string; copy_from?: string }>;
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

  // Load order data for copy
  let copyData: {
    hospitalId: number;
    hospitalName: string;
    notes: string;
    items: Array<{
      product_id: number;
      product_name: string;
      source_type: "drug" | "device" | "product";
      supplier_id: number | null;
      supplier_name: string | null;
      quantity: number;
      unit_type: string;
      purchase_price: number | null;
      selling_price: number | null;
      sales_rep: string;
    }>;
  } | undefined;

  if (params.copy_from) {
    const supabase = await createClient();
    const orderId = parseInt(params.copy_from);
    const { data: order } = await supabase
      .from("orders")
      .select("hospital_id, notes, hospitals(name), order_items(product_id, product_name, supplier_id, quantity, unit_type, unit_price, purchase_price, sales_rep)")
      .eq("id", orderId)
      .single();

    if (order) {
      // Load supplier names for items that have supplier_id
      const supplierIds = [...new Set(((order.order_items ?? []) as Array<{ supplier_id: number | null }>).map(i => i.supplier_id).filter(Boolean))] as number[];
      const supplierMap = new Map<number, string>();
      if (supplierIds.length > 0) {
        const supSb = await createClient();
        const { data: sups } = await supSb.from("suppliers").select("id, name").in("id", supplierIds);
        for (const s of sups ?? []) supplierMap.set(s.id, s.name);
      }

      const items = ((order.order_items ?? []) as Array<{
        product_id: number | null; product_name: string; supplier_id: number | null;
        quantity: number; unit_type: string; unit_price: number | null;
        purchase_price: number | null; sales_rep: string | null;
      }>).map((i) => ({
        product_id: i.product_id ?? 0,
        product_name: i.product_name,
        source_type: "drug" as const,
        supplier_id: i.supplier_id,
        supplier_name: i.supplier_id ? supplierMap.get(i.supplier_id) ?? null : null,
        quantity: i.quantity,
        unit_type: i.unit_type ?? "개",
        purchase_price: i.purchase_price,
        selling_price: i.unit_price,
        sales_rep: i.sales_rep ?? "",
      }));
      copyData = {
        hospitalId: order.hospital_id,
        hospitalName: (order.hospitals as unknown as { name: string })?.name ?? "",
        notes: "",
        items,
      };
    }
  }

  return (
    <div className="space-y-4">
      <PurchaseOrderForm
        displayColumns={displayColumns}
        columnWidths={columnWidths}
        sourceMessageId={ids[0]}
        initialNotes={copyData?.notes || initialNotes}
        sourceMessages={sourceMessages}
        suppliers={allSuppliers.map(s => ({ id: s.id, name: s.name }))}
        copyData={copyData}
      />
    </div>
  );
}

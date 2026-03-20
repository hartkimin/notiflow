import { getUnbilledOrders } from "@/lib/queries/invoices";
import InvoiceForm from "@/components/invoice-form";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function NewInvoicePage() {
  const orders = await getUnbilledOrders();

  // Extract unique hospitals from unbilled orders only
  const hospitalMap = new Map<number, string>();
  for (const o of orders) {
    if (o.hospital_id && !hospitalMap.has(o.hospital_id)) {
      hospitalMap.set(o.hospital_id, o.hospital_name ?? `거래처 #${o.hospital_id}`);
    }
  }
  const hospitals = Array.from(hospitalMap, ([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold md:text-2xl">세금계산서 발행</h1>
      </div>
      <InvoiceForm orders={orders} hospitals={hospitals} />
    </>
  );
}

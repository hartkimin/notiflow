import { getUnbilledOrders } from "@/lib/queries/invoices";
import { getHospitals } from "@/lib/queries/hospitals";
import InvoiceForm from "@/components/invoice-form";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function NewInvoicePage() {
  const [orders, { hospitals }] = await Promise.all([
    getUnbilledOrders(),
    getHospitals({ limit: 200 }),
  ]);

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

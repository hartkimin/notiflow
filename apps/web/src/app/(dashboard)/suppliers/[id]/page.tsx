import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupplier } from "@/lib/queries/suppliers";
import { getSupplierItems } from "@/lib/queries/supplier-items";
import { SupplierDetail } from "@/components/supplier-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SupplierDetailPage({ params }: Props) {
  const { id } = await params;
  const supplierId = parseInt(id, 10);
  if (isNaN(supplierId)) notFound();

  let supplier;
  try {
    supplier = await getSupplier(supplierId);
  } catch {
    notFound();
  }

  const items = await getSupplierItems(supplierId);

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/suppliers">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold md:text-2xl">{supplier.name}</h1>
      </div>
      <SupplierDetail supplier={supplier} items={items} />
    </>
  );
}

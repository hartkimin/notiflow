import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getHospital } from "@/lib/queries/hospitals";
import { getHospitalItems } from "@/lib/queries/hospital-items";
import { HospitalDetail } from "@/components/hospital-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HospitalDetailPage({ params }: Props) {
  const { id } = await params;
  const hospitalId = parseInt(id, 10);
  if (isNaN(hospitalId)) notFound();

  let hospital;
  try {
    hospital = await getHospital(hospitalId);
  } catch {
    notFound();
  }

  const { items, defaultMarginRate } = await getHospitalItems(hospitalId);

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/hospitals">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold md:text-2xl">{hospital.name}</h1>
      </div>
      <HospitalDetail
        hospital={hospital}
        items={items}
        defaultMarginRate={defaultMarginRate}
      />
    </>
  );
}

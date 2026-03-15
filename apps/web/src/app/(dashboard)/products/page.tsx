import { getExistingStandardCodes } from "@/lib/queries/products";
import { getMfdsSyncStatus } from "@/lib/actions";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const MfdsSearchPanel = dynamic(
  () => import("@/components/mfds-search-panel").then(m => ({ default: m.MfdsSearchPanel })),
  { loading: () => <Skeleton className="h-[600px] w-full rounded-md" /> },
);

export default async function ProductsPage() {
  const [existingCodes, syncStatus] = await Promise.all([
    getExistingStandardCodes(),
    getMfdsSyncStatus(),
  ]);

  return (
    <MfdsSearchPanel mode="browse" existingStandardCodes={existingCodes} syncStatus={syncStatus} />
  );
}

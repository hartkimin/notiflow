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
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">품목 검색</h1>
        <p className="text-sm text-muted-foreground mt-1">
          식약처 데이터베이스에서 의약품/의료기기를 검색하고 내 품목에 추가합니다.
        </p>
      </div>
      <MfdsSearchPanel mode="browse" existingStandardCodes={existingCodes} syncStatus={syncStatus} />
    </>
  );
}

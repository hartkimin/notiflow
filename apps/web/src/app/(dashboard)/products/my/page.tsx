import { getExistingStandardCodes } from "@/lib/queries/products";
import { getMfdsSyncStatus } from "@/lib/actions";
import { MfdsSearchPanel } from "@/components/mfds-search-panel";

export default async function MyProductsPage() {
  const [existingStandardCodes, syncStatus] = await Promise.all([
    getExistingStandardCodes().catch(() => []),
    getMfdsSyncStatus().catch(() => null),
  ]);

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">내 품목</h1>
        <p className="text-sm text-muted-foreground mt-1">
          등록된 품목을 관리하고 식약처 API와 동기화합니다.
        </p>
      </div>
      <MfdsSearchPanel
        mode="manage"
        existingStandardCodes={existingStandardCodes}
        syncStatus={syncStatus ?? undefined}
      />
    </>
  );
}

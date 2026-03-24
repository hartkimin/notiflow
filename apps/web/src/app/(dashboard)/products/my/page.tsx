import { getExistingStandardCodes } from "@/lib/queries/products";
import { getMfdsSyncStatus } from "@/lib/actions";
import { MfdsSearchPanel } from "@/components/mfds-search-panel";

export default async function MyProductsPage() {
  const [existingStandardCodes, syncStatus] = await Promise.all([
    getExistingStandardCodes().catch(() => []),
    getMfdsSyncStatus().catch(() => null),
  ]);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">내 관리 품목</h1>
      <MfdsSearchPanel
        mode="manage"
        existingStandardCodes={existingStandardCodes}
        syncStatus={syncStatus ?? undefined}
      />
    </div>
  );
}

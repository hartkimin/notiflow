import { getExistingStandardCodes } from "@/lib/queries/products";
import { getMfdsSyncStatus } from "@/lib/actions";
import { MfdsSearchPanel } from "@/components/mfds-search-panel";

export default async function MyProductsPage() {
  const [existingStandardCodes, syncStatus] = await Promise.all([
    getExistingStandardCodes().catch(() => []),
    getMfdsSyncStatus().catch(() => null),
  ]);

  return (
    <MfdsSearchPanel
      mode="manage"
      existingStandardCodes={existingStandardCodes}
      syncStatus={syncStatus ?? undefined}
    />
  );
}

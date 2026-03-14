import { getSettings, getOrderDisplayColumns } from "@/lib/queries/settings";
import { AISettingsForm } from "@/components/ai-settings";
import { SyncSettingsForm } from "@/components/sync-settings";
import { OrderColumnSettings } from "@/components/order-column-settings";

export default async function SettingsPage() {
  const [settings, displayColumns] = await Promise.all([
    getSettings(),
    getOrderDisplayColumns(),
  ]);

  return (
    <>
      <SyncSettingsForm syncInterval={settings.sync_interval_minutes} />
      <OrderColumnSettings initialColumns={displayColumns} />
      <AISettingsForm settings={settings} />
    </>
  );
}

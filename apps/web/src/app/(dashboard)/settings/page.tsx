import { getSettings, getOrderDisplayColumns } from "@/lib/queries/settings";
import { SettingsGeneral } from "@/components/settings-general";

export default async function SettingsPage() {
  const [settings, displayColumns] = await Promise.all([
    getSettings(),
    getOrderDisplayColumns(),
  ]);

  return <SettingsGeneral settings={settings} displayColumns={displayColumns} />;
}

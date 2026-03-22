import { getSettings } from "@/lib/queries/settings";
import { AISettingsPage } from "@/components/ai-settings-page";

export default async function SettingsAIPage() {
  const settings = await getSettings();
  return <AISettingsPage settings={settings} />;
}

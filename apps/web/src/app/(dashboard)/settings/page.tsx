import { getSettings } from "@/lib/queries/settings";
import { AISettingsForm } from "@/components/ai-settings";
import { SyncSettingsForm } from "@/components/sync-settings";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">설정</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI 파싱 및 동기화 설정을 관리합니다.
        </p>
      </div>
      <SyncSettingsForm syncInterval={settings.sync_interval_minutes} />
      <AISettingsForm settings={settings} />
    </>
  );
}

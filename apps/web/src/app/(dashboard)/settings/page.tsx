import { getSettings } from "@/lib/queries/settings";
import { AISettingsForm } from "@/components/ai-settings";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">AI 설정</h1>
        <p className="text-sm text-muted-foreground mt-1">
          메시지 파싱 및 주문 자동 생성에 사용되는 AI 설정을 관리합니다.
        </p>
      </div>
      <AISettingsForm settings={settings} />
    </>
  );
}

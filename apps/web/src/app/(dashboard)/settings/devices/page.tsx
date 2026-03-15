import { Smartphone, SmartphoneCharging, TabletSmartphone, Activity } from "lucide-react";

import { getDevices } from "@/lib/queries/devices";
import { DeviceTable, SyncAllButton } from "@/components/device-list";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RealtimeListener } from "@/components/realtime-listener";

export default async function SettingsDevicesPage() {
  const result = await getDevices();
  const { devices } = result;

  const activeCount = devices.filter((d) => d.is_active).length;
  const uniqueUsers = new Set(devices.map((d) => d.user_id)).size;

  const now = Date.now();
  const onlineCount = devices.filter((d) => {
    const diff = (now - new Date(d.last_sync_at).getTime()) / 60000;
    return diff < 5;
  }).length;
  const awayCount = devices.filter((d) => {
    const diff = (now - new Date(d.last_sync_at).getTime()) / 60000;
    return diff >= 5 && diff < 60;
  }).length;

  return (
    <>
      <RealtimeListener tables={["mobile_devices"]} />
      <div className="flex items-center justify-end">
        <SyncAllButton />
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <StatCard
          title="전체 기기"
          value={devices.length}
          icon={TabletSmartphone}
          color="blue"
          description={`비활성 ${devices.length - activeCount}대 포함`}
        />
        <StatCard
          title="활성 기기"
          value={activeCount}
          icon={SmartphoneCharging}
          color="green"
        />
        <StatCard
          title="연결된 사용자"
          value={uniqueUsers}
          icon={Smartphone}
          color="purple"
        />
        <StatCard
          title="Heartbeat"
          value={`${onlineCount} 온라인`}
          icon={Activity}
          color="amber"
          description={awayCount > 0 ? `자리비움 ${awayCount}대` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>기기 목록</CardTitle>
          <CardDescription>
            모바일 앱이 설치된 기기를 조회하고 활성/비활성을 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeviceTable devices={devices} />
        </CardContent>
      </Card>
    </>
  );
}

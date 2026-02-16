import { Smartphone, SmartphoneCharging, TabletSmartphone, Clock } from "lucide-react";

import { getDevices } from "@/lib/queries/devices";
import { DeviceTable } from "@/components/device-list";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RealtimeListener } from "@/components/realtime-listener";

export default async function DevicesPage() {
  const result = await getDevices().catch(() => ({ devices: [], total: 0 }));
  const { devices } = result;

  const activeCount = devices.filter((d) => d.is_active).length;
  const uniqueUsers = new Set(devices.map((d) => d.user_id)).size;

  // Find the most recent sync
  const lastSync = devices.length > 0
    ? devices.reduce((latest, d) =>
        new Date(d.last_sync_at) > new Date(latest.last_sync_at) ? d : latest
      )
    : null;
  const lastSyncLabel = lastSync
    ? new Date(lastSync.last_sync_at).toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  return (
    <>
      <RealtimeListener tables={["mobile_devices"]} />
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">모바일 기기 관리</h1>
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
          title="마지막 동기화"
          value={lastSyncLabel}
          icon={Clock}
          color="amber"
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

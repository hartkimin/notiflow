import { getChatRooms, getAvailableApps } from "@/lib/queries/notifications";
import { RealtimeListener } from "@/components/realtime-listener";
import { NotificationDashboard } from "@/components/notification-dashboard";

interface Props {
  searchParams: Promise<{
    q?: string;
    source?: string;
  }>;
}

export default async function NotificationsPage({ searchParams }: Props) {
  const params = await searchParams;

  const [chatRooms, availableApps] = await Promise.all([
    getChatRooms({
      query: params.q,
      source: params.source,
    }).catch(() => []),
    getAvailableApps().catch(() => []),
  ]);

  return (
    <>
      <RealtimeListener tables={["captured_messages"]} />
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">알림 대시보드</h1>
      </div>
      <NotificationDashboard
        initialRooms={chatRooms}
        availableApps={availableApps}
        initialQuery={params.q ?? ""}
        initialSource={params.source ?? ""}
      />
    </>
  );
}

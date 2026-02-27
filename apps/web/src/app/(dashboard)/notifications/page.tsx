import { getChatRooms, getAvailableApps } from "@/lib/queries/notifications";
import { NotificationDashboard } from "@/components/notification-dashboard";
import { RealtimeListener } from "@/components/realtime-listener";

interface Props {
  searchParams: Promise<{
    q?: string;
    source?: string;
  }>;
}

export default async function NotificationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.q || "";
  const source = params.source || "";

  const [rooms, availableApps] = await Promise.all([
    getChatRooms({ query, source }),
    getAvailableApps(),
  ]);

  return (
    <>
      <RealtimeListener tables={["captured_messages"]} />
      <NotificationDashboard
        initialRooms={rooms}
        availableApps={availableApps}
        initialQuery={query}
        initialSource={source}
      />
    </>
  );
}

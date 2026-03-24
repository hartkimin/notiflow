import { DashboardShell } from "@/components/dashboard-shell";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { GlobalNotifications } from "@/components/global-notifications";
import { ChatWidget } from "@/components/chat-widget";
import { PushInitializer } from "@/components/push-initializer";
import { requireAuth } from "@/lib/auth";
import { getSettings } from "@/lib/queries/settings";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const settings = await getSettings().catch(() => ({ sync_interval_minutes: 5 }));

  return (
    <DashboardShell userName={user.name}>
      <div className="flex flex-1 flex-col min-w-0 min-h-screen">
        <Nav syncInterval={settings.sync_interval_minutes} userName={user.name} />
        <GlobalNotifications />
        <PushInitializer userId={user.id} />
        <main className="flex-1 overflow-y-auto p-4 pb-16 md:pb-4 lg:p-6 lg:pb-4">
          <div className="w-full space-y-4">
            {children}
          </div>
        </main>
      </div>
      <MobileNav />
      <ChatWidget />
    </DashboardShell>
  );
}

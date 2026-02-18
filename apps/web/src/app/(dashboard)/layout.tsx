import { DashboardShell } from "@/components/dashboard-shell";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { GlobalNotifications } from "@/components/global-notifications";
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
      <div className="flex flex-col">
        <Nav syncInterval={settings.sync_interval_minutes} />
        <GlobalNotifications />
        <main className="flex flex-1 flex-col gap-4 p-4 pb-20 md:pb-4 lg:gap-6 lg:p-6 lg:pb-6 overflow-auto">
          {children}
        </main>
      </div>
      <MobileNav />
    </DashboardShell>
  );
}

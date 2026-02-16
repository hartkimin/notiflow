import { AppSidebar } from "@/components/app-sidebar";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { GlobalNotifications } from "@/components/global-notifications";
import { requireAuth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <AppSidebar userName={user.name} />
      <div className="flex flex-col">
        <Nav />
        <GlobalNotifications />
        <main className="flex flex-1 flex-col gap-4 p-4 pb-20 md:pb-4 lg:gap-6 lg:p-6 lg:pb-6 overflow-auto">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

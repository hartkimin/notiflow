"use client";

import { cn } from "@/lib/utils";
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse";
import { AppSidebar } from "./app-sidebar";

interface DashboardShellProps {
  userName?: string;
  children: React.ReactNode;
}

export function DashboardShell({ userName, children }: DashboardShellProps) {
  const { collapsed, toggle } = useSidebarCollapse();

  return (
    <div
      className={cn(
        "grid min-h-screen w-full transition-[grid-template-columns] duration-300 ease-in-out",
        collapsed
          ? "md:grid-cols-[64px_1fr]"
          : "md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]"
      )}
    >
      <AppSidebar
        userName={userName}
        collapsed={collapsed}
        onToggle={toggle}
      />
      {children}
    </div>
  );
}

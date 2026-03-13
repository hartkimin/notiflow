"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse";
import { AppSidebar } from "./app-sidebar";

interface DashboardShellProps {
  userName?: string;
  children: React.ReactNode;
}

export function DashboardShell({ userName, children }: DashboardShellProps) {
  const { collapsed, toggle } = useSidebarCollapse();
  const [pinned, setPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // If collapsed, it's effectively always unpinned.
  // If not collapsed, it can be pinned (fixed) or unpinned (hover to expand).
  const isExpanded = isHovered || pinned;

  return (
    <div className="flex min-h-screen w-full bg-background overflow-hidden relative">
      {/* Sidebar Container */}
      <aside 
        className={cn(
          "hidden md:flex h-screen shrink-0 border-r transition-all duration-300 z-50 bg-background",
          pinned ? "w-[304px]" : "w-[64px]"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={cn(
          "h-full transition-all duration-300 ease-in-out border-r",
          isExpanded ? "w-[304px]" : "w-[64px]",
          !pinned && isExpanded && "absolute left-0 shadow-2xl shadow-black/20"
        )}>
          <AppSidebar
            userName={userName}
            collapsed={!isExpanded}
            pinned={pinned}
            onPinToggle={() => setPinned(!pinned)}
            onToggle={toggle}
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
        {children}
      </div>
    </div>
  );
}

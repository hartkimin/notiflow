"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navGroups } from "@/lib/nav-items";
import { APP_VERSION } from "@/lib/version";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LayoutDashboard, Pin, PinOff } from "lucide-react";

interface AppSidebarProps {
  userName?: string;
  collapsed?: boolean;
  pinned?: boolean;
  onPinToggle?: () => void;
  onToggle?: () => void;
}

export function AppSidebar({ collapsed = false, pinned = false, onPinToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const allItems = navGroups.flatMap(g => g.items.map(item => ({ ...item, groupId: g.id })));

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full bg-white border-r select-none">
        {/* ── Collapsed: Icon-only bar ── */}
        {collapsed && (
          <div className="flex w-[64px] flex-col items-center py-4 shrink-0 overflow-y-auto no-scrollbar">
            <Link
              href="/dashboard"
              className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm hover:scale-105 transition-transform shrink-0"
            >
              <LayoutDashboard className="h-6 w-6" />
            </Link>

            <div className="flex flex-1 flex-col gap-1 w-full items-center">
              {allItems.map((item) => {
                const isActive = item.exact
                  ? item.href === pathname
                  : item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "relative flex h-[44px] w-10 items-center justify-center rounded-lg transition-all duration-200 shrink-0",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                        )}
                        <item.icon className="h-5 w-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={12}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            <div className="mt-auto pt-4 shrink-0" />
          </div>
        )}

        {/* ── Expanded: Text menu ── */}
        {!collapsed && (
          <div className="flex w-[240px] flex-col bg-white">
            <div className="flex h-[60px] items-center justify-between px-6 border-b shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black tracking-[0.2em] uppercase text-zinc-900">NotiFlow</span>
                <span className="text-[9px] font-bold text-zinc-400">v{APP_VERSION}</span>
              </div>
              <button
                onClick={onPinToggle}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  pinned ? "text-primary bg-primary/10" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                )}
              >
                {pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-6 no-scrollbar">
              {navGroups.map((group) => (
                <div key={group.id} className="mb-6">
                  <h3 className="mb-2 px-6 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                    {group.label}
                  </h3>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = item.exact
                        ? item.href === pathname
                        : item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "group flex h-[44px] items-center gap-3 px-6 text-sm transition-all duration-200",
                            isActive
                              ? "bg-primary/5 text-primary font-bold border-r-2 border-primary"
                              : "text-zinc-700 hover:bg-zinc-50"
                          )}
                        >
                          <item.icon className={cn(
                            "h-5 w-5 shrink-0 transition-colors",
                            isActive ? "text-primary" : "text-zinc-400 group-hover:text-zinc-700"
                          )} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t shrink-0" />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

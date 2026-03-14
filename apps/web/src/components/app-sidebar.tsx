"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navGroups } from "@/lib/nav-items";
import { APP_VERSION } from "@/lib/version";
import { NotificationToggle } from "./notification-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LayoutDashboard, Settings, User, Pin, PinOff } from "lucide-react";

interface AppSidebarProps {
  userName?: string;
  collapsed?: boolean;
  pinned?: boolean;
  onPinToggle?: () => void;
  onToggle?: () => void;
}

export function AppSidebar({ userName, collapsed = false, pinned = false, onPinToggle }: AppSidebarProps) {
  const pathname = usePathname();

  // Flatten all nav items for the 1:1 icon bar
  const allItems = navGroups.flatMap(g => g.items.map(item => ({ ...item, groupId: g.id })));

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full bg-background select-none">
        {/* Step 1: Icon Strip (Always visible 64px) */}
        <div className="flex w-[64px] flex-col items-center border-r bg-zinc-950 py-4 dark:bg-black shrink-0 z-20 overflow-y-auto no-scrollbar">
          <Link 
            href="/dashboard" 
            className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 transition-transform shrink-0"
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
                          ? "bg-zinc-800 text-primary" 
                          : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <item.icon className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12} className="bg-zinc-900 border-zinc-800 text-white font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <div className="mt-auto flex flex-col gap-4 pt-4 border-t border-zinc-800/50 w-full items-center shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/settings" className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                  pathname === "/settings" ? "bg-zinc-800 text-primary" : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                )}>
                  <Settings className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12}>설정</TooltipContent>
            </Tooltip>
            
            <div className="p-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-xs font-bold text-white shadow-inner">
                {userName?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Details Panel */}
        {!collapsed && (
          <div className="flex w-[240px] flex-col bg-background border-r shadow-xl">
            <div className="flex h-[60px] items-center justify-between px-6 border-b shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black tracking-[0.2em] uppercase text-zinc-950">NotiFlow</span>
                <span className="text-[9px] font-bold text-zinc-400">v{APP_VERSION}</span>
              </div>
              <button 
                onClick={onPinToggle}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  pinned ? "text-primary bg-primary/10" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950"
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
                              : "text-zinc-950 hover:bg-zinc-50"
                          )}
                        >
                          <item.icon className={cn(
                            "h-5 w-5 transition-colors", 
                            isActive ? "text-primary" : "text-zinc-400 group-hover:text-zinc-950"
                          )} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t bg-zinc-50/50">
              <NotificationToggle />
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

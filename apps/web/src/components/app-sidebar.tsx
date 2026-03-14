"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { navGroups } from "@/lib/nav-items";
import { APP_VERSION } from "@/lib/version";
import { createClient } from "@/lib/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, Settings, User, Pin, PinOff, LogOut, HelpCircle } from "lucide-react";

interface AppSidebarProps {
  userName?: string;
  collapsed?: boolean;
  pinned?: boolean;
  onPinToggle?: () => void;
  onToggle?: () => void;
}

export function AppSidebar({ userName, collapsed = false, pinned = false, onPinToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const allItems = navGroups.flatMap(g => g.items.map(item => ({ ...item, groupId: g.id })));

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const userInitial = userName?.charAt(0).toUpperCase();

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

            <div className="mt-auto flex flex-col gap-4 pt-4 border-t border-zinc-200 w-full items-center shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/settings" className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                    pathname.startsWith("/settings") ? "bg-primary/10 text-primary" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  )}>
                    <Settings className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>설정</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded-lg hover:bg-zinc-100 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-700">
                      {userInitial || <User className="h-4 w-4" />}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" sideOffset={8}>
                  <DropdownMenuLabel>{userName ?? "사용자"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      설정
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/help">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      도움말
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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

            <div className="border-t">
              <Link href="/settings" className={cn(
                "flex h-[44px] items-center gap-3 px-6 text-sm transition-colors",
                pathname.startsWith("/settings") ? "text-primary font-bold" : "text-zinc-700 hover:bg-zinc-50"
              )}>
                <Settings className={cn("h-5 w-5 shrink-0", pathname.startsWith("/settings") ? "text-primary" : "text-zinc-400")} />
                <span>설정</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-3 px-6 py-3 border-t hover:bg-zinc-50 transition-colors">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-700">
                      {userInitial || <User className="h-3.5 w-3.5" />}
                    </div>
                    <span className="text-sm text-zinc-700 truncate">{userName ?? "사용자"}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[200px]">
                  <DropdownMenuLabel>{userName ?? "사용자"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      설정
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/help">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      도움말
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

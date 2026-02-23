"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { navGroups, Package2 } from "@/lib/nav-items";
import { APP_VERSION } from "@/lib/version";
import { NotificationToggle } from "./notification-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppSidebarProps {
  userName?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function AppSidebar({ userName, collapsed = false, onToggle }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <div className="hidden border-r bg-muted/40 md:block overflow-hidden">
        <div className="flex h-full max-h-screen flex-col">
          {/* Header */}
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-2 font-semibold transition-opacity hover:opacity-80",
                collapsed && "justify-center"
              )}
            >
              <Package2 className="h-6 w-6 shrink-0 text-primary" />
              {!collapsed && (
                <span className="whitespace-nowrap">
                  NotiFlow
                  <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                    v{APP_VERSION}
                  </span>
                </span>
              )}
            </Link>
            {!collapsed && (
              <div className="ml-auto">
                <NotificationToggle />
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-2">
            {navGroups.map((group, groupIdx) => (
              <div key={group.label} className={cn(groupIdx > 0 && "mt-2")}>
                {!collapsed && (
                  <div className="px-4 lg:px-6 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {group.label}
                    </span>
                  </div>
                )}
                {collapsed && groupIdx > 0 && (
                  <div className="mx-3 border-t" />
                )}
                <nav className={cn("grid gap-0.5", collapsed ? "px-1.5" : "px-2 lg:px-3")}>
                  {group.items.map((item) => {
                    const isActive =
                      item.href === pathname ||
                      (item.href !== "/" && pathname.startsWith(item.href));

                    const linkContent = (
                      <Link
                        href={item.href}
                        className={cn(
                          "group relative flex items-center rounded-md text-sm font-medium text-muted-foreground",
                          "transition-all duration-150 ease-out",
                          "hover:bg-accent hover:text-accent-foreground",
                          "active:scale-[0.98] active:bg-accent/80",
                          collapsed
                            ? "justify-center px-2 py-2"
                            : "gap-3 px-3 py-2",
                          isActive && [
                            "bg-primary/10 text-primary font-semibold",
                            "hover:bg-primary/15",
                          ]
                        )}
                      >
                        {isActive && !collapsed && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />
                        )}
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground/70 group-hover:text-accent-foreground"
                          )}
                        />
                        {!collapsed && (
                          <span className="whitespace-nowrap">{item.label}</span>
                        )}
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                          <TooltipContent side="right" sideOffset={8}>
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return <span key={item.href}>{linkContent}</span>;
                  })}
                </nav>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t">
            {/* User info */}
            {userName && (
              <div className={cn("px-4 py-3", collapsed ? "flex justify-center px-2" : "lg:px-6")}>
                <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2")}>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  {!collapsed && (
                    <span className="text-sm text-muted-foreground truncate">
                      {userName}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Toggle button */}
            <div className={cn("px-4 pb-3", collapsed ? "flex justify-center px-2" : "lg:px-6")}>
              <button
                onClick={onToggle}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  collapsed && "justify-center"
                )}
              >
                {collapsed ? (
                  <ChevronsRight className="h-4 w-4" />
                ) : (
                  <>
                    <ChevronsLeft className="h-4 w-4" />
                    <span className="whitespace-nowrap">접기</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

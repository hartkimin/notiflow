"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { navGroups, Package2 } from "@/lib/nav-items";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";
import { NotificationToggle } from "./notification-toggle";
import { AutoRefreshProvider } from "./auto-refresh";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function Nav({ syncInterval = 5 }: { syncInterval?: number }) {
  const pathname = usePathname();
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col w-72">
          <Link
            href="/orders"
            className="flex items-center gap-2 text-lg font-semibold mb-2 px-1"
          >
            <Package2 className="h-6 w-6 text-primary" />
            <span>NotiFlow</span>
          </Link>
          <div className="flex-1 overflow-y-auto -mx-2">
            {navGroups.map((group, groupIdx) => (
              <div key={group.label} className={cn(groupIdx > 0 && "mt-3")}>
                <div className="px-4 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {group.label}
                  </span>
                </div>
                <nav className="grid gap-0.5 px-2">
                  {group.items.map((item) => {
                    const isActive = item.exact
                      ? item.href === pathname
                      : item.href === pathname ||
                        (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-muted-foreground",
                          "transition-all duration-150 ease-out",
                          "hover:bg-accent hover:text-accent-foreground",
                          "active:scale-[0.98] active:bg-accent/80",
                          isActive && [
                            "bg-primary/10 text-primary font-semibold",
                            "hover:bg-primary/15",
                          ]
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />
                        )}
                        <item.icon
                          className={cn(
                            "h-5 w-5 shrink-0 transition-colors",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground/70 group-hover:text-accent-foreground"
                          )}
                        />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <div className="flex-1" />
      <AutoRefreshProvider intervalMinutes={syncInterval} />
      <NotificationToggle />
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}

"use client";

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
import Link from "next/link";

export function Nav({ syncInterval = 5 }: { syncInterval?: number }) {
  const pathname = usePathname();
  
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6 lg:h-[60px] sticky top-0 z-40 transition-all duration-200 shadow-sm">
      {/* Mobile Toggle - Only visible on small screens */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden -ml-2 hover:bg-accent/50">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col w-72 p-0 bg-background border-r shadow-2xl">
          <div className="p-6 flex items-center gap-3 border-b bg-zinc-950 dark:bg-black text-white">
            <Package2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg tracking-tight">NotiFlow</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {navGroups.map((group, idx) => (
              <div key={group.label} className={cn(idx > 0 && "mt-8")}>
                <h3 className="px-3 mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                  {group.label}
                </h3>
                <nav className="grid gap-1.5">
                  {group.items.map((item) => {
                    const isActive = item.exact
                      ? item.href === pathname
                      : item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href));
                    
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-150",
                          isActive 
                            ? "bg-primary/10 text-primary shadow-[0_0_0_1px_inset] shadow-primary/20" 
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <item.icon className={cn("h-4.5 w-4.5", isActive ? "text-primary" : "text-muted-foreground/60")} />
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

      {/* Page Title or Breadcrumb (Contextual) */}
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-bold capitalize hidden sm:block">
          {pathname.split("/").pop()?.replace("-", " ") || "Dashboard"}
        </h1>
      </div>

      <div className="flex-1" />
      
      {/* Global Actions */}
      <div className="flex items-center gap-2">
        <AutoRefreshProvider intervalMinutes={syncInterval} />
        <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />
        <NotificationToggle />
        <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}

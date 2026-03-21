"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, Settings, HelpCircle, LogOut, User } from "lucide-react";
import { navGroups, Package2 } from "@/lib/nav-items";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface NavProps {
  syncInterval?: number;
  userName?: string;
}

export function Nav({ syncInterval = 5, userName }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Silent auto-refresh (no UI button)
  const doRefresh = useCallback(() => { router.refresh(); }, [router]);
  useEffect(() => {
    if (syncInterval <= 0) return;
    const timer = setInterval(doRefresh, syncInterval * 60 * 1000);
    return () => clearInterval(timer);
  }, [syncInterval, doRefresh]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const userInitial = userName?.charAt(0).toUpperCase();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6 lg:h-[60px] sticky top-0 z-40 transition-all duration-200 shadow-sm">
      {/* Mobile Toggle */}
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

      {/* Page Title */}
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-bold capitalize hidden sm:block">
          {pathname.split("/").pop()?.replace("-", " ") || "Dashboard"}
        </h1>
      </div>

      <div className="flex-1" />

      {/* Right: Settings + Profile */}
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-200 transition-colors">
              {userInitial || <User className="h-3.5 w-3.5" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8}>
            <DropdownMenuLabel>{userName ?? "사용자"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />설정
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/help">
                <HelpCircle className="mr-2 h-4 w-4" />도움말
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

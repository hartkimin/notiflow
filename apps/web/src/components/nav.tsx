"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Settings, HelpCircle, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      {/* Page Title */}
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-bold capitalize hidden sm:block">
          {pathname.split("/").pop()?.replace("-", " ") || "Dashboard"}
        </h1>
      </div>

      <div className="flex-1" />

      {/* Right: Settings + Profile */}
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-200 transition-colors">
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

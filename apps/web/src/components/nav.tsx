"use client";

import { useEffect, useCallback, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Settings, HelpCircle, LogOut, User, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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

      {/* Right: Sync + Settings + Profile */}
      <div className="flex items-center gap-1.5">
        <SyncButton />

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

function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const router = useRouter();

  const handleSync = () => {
    startTransition(async () => {
      try {
        const { requestAllDevicesSync } = await import("@/lib/actions");
        const result = await requestAllDevicesSync();
        router.refresh();

        if (result.fcm_sent > 0) {
          toast.success(`${result.fcm_sent}대 기기에 동기화 요청 완료`);
        } else if (result.realtime_updated > 0) {
          toast.success("Realtime으로 동기화 요청을 보냈습니다");
        } else {
          toast.info("활성 기기가 없습니다");
        }
        setLastSynced(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
      } catch {
        toast.error("동기화 요청 실패");
      }
    });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleSync}
            disabled={isPending}
            className={cn(
              "group relative flex items-center gap-2 rounded-full px-3 py-1.5",
              "bg-gradient-to-r from-blue-500/10 to-indigo-500/10",
              "border border-blue-200/60 dark:border-blue-800/40",
              "hover:from-blue-500/20 hover:to-indigo-500/20",
              "hover:border-blue-300 dark:hover:border-blue-700",
              "hover:shadow-[0_0_12px_rgba(59,130,246,0.15)]",
              "active:scale-[0.97]",
              "transition-all duration-200 ease-out",
              "disabled:opacity-50 disabled:pointer-events-none",
            )}
          >
            <span className="relative flex h-5 w-5 items-center justify-center">
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5 text-blue-600 dark:text-blue-400 transition-transform duration-300",
                  isPending && "animate-spin",
                )}
              />
              <Smartphone className="absolute -bottom-0.5 -right-0.5 h-2 w-2 text-blue-500/70" />
            </span>
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300 hidden sm:inline">
              {isPending ? "동기화 중..." : "동기화"}
            </span>
            {lastSynced && !isPending && (
              <span className="text-[10px] text-blue-400 dark:text-blue-500 hidden md:inline">
                {lastSynced}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>모든 모바일 기기에 동기화 요청</p>
          {lastSynced && <p className="text-muted-foreground">마지막: {lastSynced}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

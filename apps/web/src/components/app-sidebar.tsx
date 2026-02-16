"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Home,
  Package,
  Package2,
  Users,
  Brain,
  MessageSquare,
  ClipboardList,
  CalendarDays,
  Truck,
  BarChart3,
  Shield,
  Building2,
  Factory,
} from "lucide-react";

const navGroups = [
  {
    label: "메인",
    items: [
      { href: "/orders", label: "주문관리", icon: ClipboardList },
      { href: "/messages", label: "수신메시지", icon: MessageSquare },
      { href: "/calendar", label: "캘린더", icon: CalendarDays },
    ],
  },
  {
    label: "운영",
    items: [
      { href: "/deliveries", label: "배송현황", icon: Truck },
      { href: "/reports", label: "매출리포트", icon: BarChart3 },
      { href: "/kpis", label: "KPIS신고", icon: Shield },
    ],
  },
  {
    label: "마스터 데이터",
    items: [
      { href: "/hospitals", label: "거래처", icon: Building2 },
      { href: "/products", label: "품목", icon: Package },
      { href: "/suppliers", label: "공급사", icon: Factory },
    ],
  },
  {
    label: "시스템",
    items: [
      { href: "/users", label: "사용자", icon: Users },
      { href: "/settings", label: "AI 설정", icon: Brain },
    ],
  },
];

export function AppSidebar({ userName }: { userName?: string }) {
  const pathname = usePathname();

  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col">
        {/* Header */}
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link
            href="/orders"
            className="flex items-center gap-2 font-semibold transition-opacity hover:opacity-80"
          >
            <Package2 className="h-6 w-6 text-primary" />
            <span>NotiFlow</span>
          </Link>
          <Button
            variant="outline"
            size="icon"
            className="ml-auto h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="sr-only">Toggle notifications</span>
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-2">
          {navGroups.map((group, groupIdx) => (
            <div key={group.label} className={cn(groupIdx > 0 && "mt-2")}>
              <div className="px-4 lg:px-6 py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </span>
              </div>
              <nav className="grid gap-0.5 px-2 lg:px-3">
                {group.items.map((item) => {
                  const isActive =
                    item.href === pathname ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground",
                        "transition-all duration-150 ease-out",
                        "hover:bg-accent hover:text-accent-foreground",
                        "active:scale-[0.98] active:bg-accent/80",
                        isActive && [
                          "bg-primary/10 text-primary font-semibold",
                          "hover:bg-primary/15",
                        ]
                      )}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
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
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer - User info */}
        {userName && (
          <div className="border-t px-4 py-3 lg:px-6">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-muted-foreground truncate">
                {userName}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

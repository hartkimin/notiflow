"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  MessageSquare,
  CalendarDays,
  LayoutDashboard,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/orders", label: "주문", icon: ClipboardList },
  { href: "/messages", label: "메시지", icon: MessageSquare },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
];

/**
 * Fixed bottom navigation bar visible only on mobile (<md breakpoint).
 * Shows the 4 most-used pages + the sidebar hamburger handles the rest.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around h-14">
        {mobileNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-full h-full text-muted-foreground transition-colors",
                "active:bg-accent/50",
                isActive && "text-primary",
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className={cn("text-[10px]", isActive && "font-semibold")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

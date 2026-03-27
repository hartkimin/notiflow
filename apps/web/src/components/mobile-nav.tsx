"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  MessageSquare,
  LayoutGrid,
  MoreHorizontal,
  Settings,
  Building2,
  Truck,
  Package,
  HelpCircle,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/orders", label: "주문", icon: ClipboardList },
  { href: "/messages", label: "메시지", icon: MessageSquare },
  { href: "/dashboard", label: "대시보드", icon: LayoutGrid },
];

const moreMenuItems = [
  { href: "/settings", label: "설정", icon: Settings },
  { href: "/hospitals", label: "병원", icon: Building2 },
  { href: "/suppliers", label: "공급업체", icon: Truck },
  { href: "/products", label: "제품", icon: Package },
  { href: "/users", label: "사용자", icon: Users },
  { href: "/help", label: "도움말", icon: HelpCircle },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav
      data-mobile-nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden pb-safe"
    >
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive =
            item.href === pathname || pathname.startsWith(item.href + "/");
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

        {/* 더보기 탭 */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-full h-full text-muted-foreground transition-colors",
                "active:bg-accent/50",
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px]">더보기</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-safe">
            <SheetHeader>
              <SheetTitle>메뉴</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-4 py-4">
              {moreMenuItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => {
                    setMoreOpen(false);
                    router.push(item.href);
                  }}
                  className="flex flex-col items-center gap-2 rounded-lg p-3 text-muted-foreground transition-colors hover:bg-accent active:bg-accent/50"
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-xs">{item.label}</span>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

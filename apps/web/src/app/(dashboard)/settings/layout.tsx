"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Settings, Users, Smartphone, Building, Bot } from "lucide-react";

const settingsTabs = [
  { href: "/settings", label: "일반", icon: Settings, exact: true },
  { href: "/settings/ai", label: "AI 설정", icon: Bot },
  { href: "/settings/users", label: "사용자 관리", icon: Users },
  { href: "/settings/devices", label: "기기 관리", icon: Smartphone },
  { href: "/settings/company", label: "자사 정보", icon: Building },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">설정</h1>
        <p className="text-sm text-muted-foreground mt-1">
          시스템 설정, 사용자 및 기기를 관리합니다.
        </p>
      </div>
      <div className="flex gap-1 border-b">
        {settingsTabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </>
  );
}

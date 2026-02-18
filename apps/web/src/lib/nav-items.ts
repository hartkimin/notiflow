import {
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
  Smartphone,
  HelpCircle,
  LayoutDashboard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "메인",
    items: [
      { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
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
      { href: "/devices", label: "모바일 기기", icon: Smartphone },
      { href: "/settings", label: "AI 설정", icon: Brain },
      { href: "/help", label: "도움말", icon: HelpCircle },
    ],
  },
];

/** Re-export Package2 for the sidebar/nav logo */
export { Package2 };

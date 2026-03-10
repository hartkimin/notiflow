import {
  Package2,
  Users,
  ClipboardList,
  Building2,
  Factory,
  Smartphone,
  LayoutDashboard,
  Search,
  Star,
  MessageSquare,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When true, only highlight when pathname === href (no prefix matching) */
  exact?: boolean;
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
      { href: "/notifications", label: "수신메시지", icon: MessageSquare },
      { href: "/orders", label: "주문관리", icon: ClipboardList },
    ],
  },
  {
    label: "마스터 데이터",
    items: [
      { href: "/hospitals", label: "거래처", icon: Building2 },
      { href: "/products", label: "품목 검색", icon: Search, exact: true },
      { href: "/products/my", label: "즐겨찾는 품목", icon: Star },
      { href: "/suppliers", label: "공급사", icon: Factory },
    ],
  },
  {
    label: "설정",
    items: [
      { href: "/settings", label: "시스템 설정", icon: Settings },
      { href: "/users", label: "사용자 관리", icon: Users },
      { href: "/devices", label: "모바일 기기", icon: Smartphone },
    ],
  },
];

/** Re-export Package2 for the sidebar/nav logo */
export { Package2 };

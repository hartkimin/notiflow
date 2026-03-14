import {
  Package2,
  ClipboardList,
  Building2,
  Factory,
  LayoutDashboard,
  Search,
  BookmarkCheck,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  id: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "운영 관리",
    id: "ops",
    items: [
      { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
      { href: "/notifications", label: "수신 메시지", icon: MessageSquare },
      { href: "/orders", label: "주문 현황", icon: ClipboardList },
    ],
  },
  {
    label: "품목 카탈로그",
    id: "catalog",
    items: [
      { href: "/products", label: "식약처 품목검색", icon: Search, exact: true },
      { href: "/products/my", label: "내 관리 품목", icon: BookmarkCheck },
    ],
  },
  {
    label: "비즈니스 파트너",
    id: "partners",
    items: [
      { href: "/hospitals", label: "병원(거래처)", icon: Building2 },
      { href: "/suppliers", label: "제조/공급사", icon: Factory },
    ],
  },
];

export { Package2 };

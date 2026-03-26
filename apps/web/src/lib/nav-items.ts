import {
  Package2,
  ClipboardList,
  Building2,
  Factory,
  LayoutDashboard,
  Search,
  BookmarkCheck,
  MessageSquare,
  FileText,
  BarChart3,
  MapPin,
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
      { href: "/messages", label: "수신 메시지", icon: MessageSquare },
      { href: "/orders", label: "주문 관리", icon: ClipboardList },
      { href: "/invoices", label: "세금계산서", icon: FileText },
      { href: "/sales", label: "영업실적", icon: BarChart3 },
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
      { href: "/hospitals", label: "거래처 관리", icon: Building2 },
      { href: "/suppliers", label: "공급사 관리", icon: Factory },
      { href: "/map", label: "지도", icon: MapPin },
    ],
  },
];

export { Package2 };

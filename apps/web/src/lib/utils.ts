import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = "KRW") {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

/** @deprecated Use price-calc.ts functions instead */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** 금액을 정수로 포맷 (천 단위 콤마) — price-calc.ts의 fmt4와 동일 */
export function fmt4(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

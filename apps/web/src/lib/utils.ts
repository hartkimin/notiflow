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

/** Round a number to 4 decimal places */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Format a number with up to 4 decimal places (trailing zeros trimmed) */
export function fmt4(n: number): string {
  const r = round4(n);
  // Show up to 4 decimals, trim trailing zeros
  const s = r.toFixed(4).replace(/\.?0+$/, "");
  // Add thousands separator for integer part
  const [int, dec] = s.split(".");
  const intFormatted = Number(int).toLocaleString("ko-KR");
  return dec ? `${intFormatted}.${dec}` : intFormatted;
}

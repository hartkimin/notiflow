// apps/web/src/lib/tax-invoice/calc.ts
import { lineSupply } from "@/lib/price-calc";

export interface OrderItemLike {
  line_total: number | null | undefined;
  unit_price: number | null | undefined;
  quantity: number;
}

/**
 * Canonical supply amount for one order item used by both invoice header
 * aggregation and invoice_items row construction.
 *
 * Priority: line_total (if > 0) → lineSupply(unit_price, qty) → 0
 */
export function resolveItemSupply(item: OrderItemLike): number {
  if (item.line_total != null && item.line_total > 0) return item.line_total;
  if (item.unit_price) return lineSupply(item.unit_price, item.quantity);
  return 0;
}

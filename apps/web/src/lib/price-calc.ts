/**
 * price-calc.ts — 통일 가격/부가세 계산 모듈
 *
 * ERP 원칙:
 *   1. 공급가액(VAT 제외)이 기준 — 모든 저장/계산의 기본 단위
 *   2. 세액 = 총 공급가액 × 10% (품목별 합산이 아닌 총액 기준 1회 계산)
 *   3. 항등식 보장: 합계 = 공급가액 + 세액
 *   4. 이익 = 매출 공급가액 - 매입 공급가액 (VAT 제외 기준)
 *   5. 소수점 4자리 처리, 정수는 소수점 표시 안 함
 */

const VAT_RATE = 0.1;
const PRECISION = 4;
const FACTOR = 10 ** PRECISION; // 10000

// ────────────────────────────────────────────────────────────
// 기본 유틸
// ────────────────────────────────────────────────────────────

/** 소수점 4자리 반올림 */
export function round4(n: number): number {
  return Math.round(n * FACTOR) / FACTOR;
}

/** 소수점 4자리 포맷 (정수면 소수점 없이, 천 단위 콤마) */
export function fmt4(n: number): string {
  const r = round4(n);
  const s = r.toFixed(PRECISION).replace(/\.?0+$/, "");
  const [int, dec] = s.split(".");
  const intFormatted = Number(int).toLocaleString("ko-KR");
  return dec ? `${intFormatted}.${dec}` : intFormatted;
}

// ────────────────────────────────────────────────────────────
// VAT 변환
// ────────────────────────────────────────────────────────────

/** VAT포함가 → 공급가(VAT제외) 변환. full precision 유지 (round-trip 보장) */
export function vatToExcl(vatIncl: number): number {
  return vatIncl / (1 + VAT_RATE);
}

/** 공급가(VAT제외) → VAT포함가 변환 (표시용, round4 적용) */
export function exclToVat(excl: number): number {
  return round4(excl * (1 + VAT_RATE));
}

// ────────────────────────────────────────────────────────────
// 품목별 계산 (line-level)
// ────────────────────────────────────────────────────────────

/** 품목 공급가액 = 단가 × 수량 */
export function lineSupply(unitPrice: number, qty: number): number {
  return round4(unitPrice * qty);
}

/** 품목 세액 = 공급가액 × 10% */
export function lineTax(unitPrice: number, qty: number): number {
  return round4(lineSupply(unitPrice, qty) * VAT_RATE);
}

/** 품목 합계(VAT 포함) = 공급가액 + 세액 (항등식 보장) */
export function lineTotal(unitPrice: number, qty: number): number {
  return round4(lineSupply(unitPrice, qty) + lineTax(unitPrice, qty));
}

/** 품목 이익 = 매출 공급가액 - 매입 공급가액 (VAT 제외 기준) */
export function lineProfit(sellPrice: number, purchasePrice: number, qty: number): number {
  return round4(lineSupply(sellPrice, qty) - lineSupply(purchasePrice, qty));
}

/** 품목 이익률(%) = 이익 / 매출합계(VAT포함) × 100 */
export function lineMarginRate(sellPrice: number, purchasePrice: number, qty: number): number {
  const sTotal = lineTotal(sellPrice, qty);
  if (sTotal === 0) return 0;
  const profit = lineProfit(sellPrice, purchasePrice, qty);
  // 이익률은 VAT포함 매출 대비 VAT포함 이익으로 계산 (VAT 비율 동일하므로 공급가 기준과 동일)
  return round4((profit / lineSupply(sellPrice, qty)) * 100);
}

// ────────────────────────────────────────────────────────────
// 품목별 계산 결과 세트 (line-level summary)
// ────────────────────────────────────────────────────────────

export interface LineCalc {
  ppVat: number;         // 매입(VAT)
  spVat: number;         // 판매(VAT)
  pSupply: number;       // 매입 공급가
  pTax: number;          // 매입 부가세
  sSupply: number;       // 판매 공급가
  sTax: number;          // 판매 부가세
  profit: number;        // 이익
  marginRate: number;    // 이익률(%)
}

/** 품목 1건의 모든 계산값을 한번에 산출 */
export function calcLine(pp: number, sp: number, qty: number): LineCalc {
  return {
    ppVat: exclToVat(pp),
    spVat: exclToVat(sp),
    pSupply: lineSupply(pp, qty),
    pTax: lineTax(pp, qty),
    sSupply: lineSupply(sp, qty),
    sTax: lineTax(sp, qty),
    profit: lineProfit(sp, pp, qty),
    marginRate: lineMarginRate(sp, pp, qty),
  };
}

// ────────────────────────────────────────────────────────────
// 주문 합계 (order-level)
// ────────────────────────────────────────────────────────────

export interface OrderTotals {
  purchaseTotal: number;   // 매입합계 (VAT포함)
  sellingTotal: number;    // 매출합계 (VAT포함)
  supplyTotal: number;     // 판매 공급가액 합계
  taxTotal: number;        // 판매 세액 (총 공급가 기준 1회 계산)
  totalMargin: number;     // 이익
  marginRate: number;      // 이익률(%)
}

/** 주문 전체 합계 계산 — 항등식: supplyTotal + taxTotal = sellingTotal */
export function calcOrderTotals(
  items: { purchasePrice: number; sellingPrice: number; qty: number }[],
): OrderTotals {
  let purchaseTotal = 0;
  let sellingTotal = 0;
  let supplyTotal = 0;

  for (const item of items) {
    purchaseTotal += lineTotal(item.purchasePrice, item.qty);
    const sSupply = lineSupply(item.sellingPrice, item.qty);
    supplyTotal += sSupply;
    sellingTotal += round4(sSupply + round4(sSupply * VAT_RATE));
  }

  purchaseTotal = round4(purchaseTotal);
  sellingTotal = round4(sellingTotal);
  supplyTotal = round4(supplyTotal);

  // 세액: 총 공급가액 기준 1회 계산 (한국 부가세법 원칙)
  const taxTotal = round4(supplyTotal * VAT_RATE);

  const totalMargin = round4(sellingTotal - purchaseTotal);
  const marginRate = sellingTotal > 0 ? round4((totalMargin / sellingTotal) * 100) : 0;

  return { purchaseTotal, sellingTotal, supplyTotal, taxTotal, totalMargin, marginRate };
}

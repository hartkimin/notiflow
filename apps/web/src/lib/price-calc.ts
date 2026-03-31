/**
 * price-calc.ts — 통일 가격/부가세 계산 모듈
 *
 * 한국 부가세법 원칙:
 *   1. 입력: VAT 포함 단가 → ÷1.1 역산으로 공급가 단가 산출 (소수점 유지, 중간값)
 *   2. 공급가액 = 수량 × 공급가 단가 → 반올림하여 정수
 *   3. 부가세 = 공급가액 × 10% → 절사하여 정수 (원 미만 절사 원칙)
 *   4. VAT 총액 = 공급가액 + 부가세 (항상 정수)
 *   5. 이익 = 판매 VAT 총액 - 매입 VAT 총액 (정수)
 *   6. 이익률 = (이익 / 매입 VAT 총액) × 100 → 소수점 1자리
 *   7. 모든 최종 표시 금액: 정수
 */

const VAT_RATE = 0.1;

// ────────────────────────────────────────────────────────────
// 기본 유틸
// ────────────────────────────────────────────────────────────

/** @deprecated 정수 계산으로 전환됨. 기존 호출 호환용 */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** 금액을 정수로 포맷 (천 단위 콤마, 정수 표시) */
export function fmt4(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

// ────────────────────────────────────────────────────────────
// VAT 변환
// ────────────────────────────────────────────────────────────

/** VAT포함가 → 공급가(VAT제외) 변환. 소수점 유지 (중간 계산값, 반올림 안 함) */
export function vatToExcl(vatIncl: number): number {
  return vatIncl / (1 + VAT_RATE);
}

/** 공급가(VAT제외) → VAT포함가 변환 (표시/입력필드 round-trip용, 반올림 정수) */
export function exclToVat(excl: number): number {
  return Math.round(excl * (1 + VAT_RATE));
}

// ────────────────────────────────────────────────────────────
// 품목별 계산 (line-level)
// ────────────────────────────────────────────────────────────

/** 공급가액 = 공급가 단가 × 수량 → 반올림하여 정수 */
export function lineSupply(unitPrice: number, qty: number): number {
  return Math.round(unitPrice * qty);
}

/** 부가세 = 공급가액 × 10% → 절사하여 정수 (한국 부가세법 원 미만 절사) */
export function lineTax(unitPrice: number, qty: number): number {
  return Math.floor(lineSupply(unitPrice, qty) * VAT_RATE);
}

/** VAT 포함 총액 = 공급가액 + 부가세 (항상 정수) */
export function lineTotal(unitPrice: number, qty: number): number {
  return lineSupply(unitPrice, qty) + lineTax(unitPrice, qty);
}

/** 매출이익 = 판매 VAT 총액 - 매입 VAT 총액 (정수) */
export function lineProfit(sellPrice: number, purchasePrice: number, qty: number): number {
  return lineTotal(sellPrice, qty) - lineTotal(purchasePrice, qty);
}

/** 이익률(%) = (매출이익 / 판매 VAT 총액) × 100 → 소수점 1자리 */
export function lineMarginRate(sellPrice: number, purchasePrice: number, qty: number): number {
  const sTotal = lineTotal(sellPrice, qty);
  if (sTotal === 0) return 0;
  const profit = lineProfit(sellPrice, purchasePrice, qty);
  return Math.round((profit / sTotal) * 1000) / 10;
}

// ────────────────────────────────────────────────────────────
// 품목별 계산 결과 세트 (line-level summary)
// ────────────────────────────────────────────────────────────

export interface LineCalc {
  ppVat: number;         // 매입(VAT) 단가 (반올림 정수)
  spVat: number;         // 판매(VAT) 단가 (반올림 정수)
  pSupply: number;       // 매입 공급가액 (정수)
  pTax: number;          // 매입 부가세 (정수)
  pTotal: number;        // 매입 VAT 총액 (정수)
  sSupply: number;       // 판매 공급가액 (정수)
  sTax: number;          // 판매 부가세 (정수)
  sTotal: number;        // 판매 VAT 총액 (정수)
  profit: number;        // 매출이익 (정수)
  marginRate: number;    // 이익률(%) = 이익/판매VAT총액 (소수점 1자리)
}

/** 품목 1건의 모든 계산값을 한번에 산출 */
export function calcLine(pp: number, sp: number, qty: number): LineCalc {
  return {
    ppVat: exclToVat(pp),
    spVat: exclToVat(sp),
    pSupply: lineSupply(pp, qty),
    pTax: lineTax(pp, qty),
    pTotal: lineTotal(pp, qty),
    sSupply: lineSupply(sp, qty),
    sTax: lineTax(sp, qty),
    sTotal: lineTotal(sp, qty),
    profit: lineProfit(sp, pp, qty),
    marginRate: lineMarginRate(sp, pp, qty),
  };
}

// ────────────────────────────────────────────────────────────
// 주문 합계 (order-level)
// ────────────────────────────────────────────────────────────

export interface OrderTotals {
  purchaseTotal: number;   // 매입합계 = Σ 품목 매입 VAT 총액 (정수)
  sellingTotal: number;    // 매출합계 = Σ 품목 판매 VAT 총액 (정수)
  supplyTotal: number;     // 판매 공급가액 합계 = Σ 품목 판매 공급가액 (정수)
  taxTotal: number;        // 판매 세액 합계 = Σ 품목 판매 부가세 (정수)
  totalMargin: number;     // 마진 = 매출합계 - 매입합계 (정수)
  marginRate: number;      // 마진율(%) = (마진 / 매출합계) × 100 (소수점 1자리)
}

/** 주문 전체 합계 계산 — 품목별 합산 방식 */
export function calcOrderTotals(
  items: { purchasePrice: number; sellingPrice: number; qty: number }[],
): OrderTotals {
  let purchaseTotal = 0;
  let sellingTotal = 0;
  let supplyTotal = 0;
  let taxTotal = 0;

  for (const item of items) {
    purchaseTotal += lineTotal(item.purchasePrice, item.qty);
    supplyTotal += lineSupply(item.sellingPrice, item.qty);
    taxTotal += lineTax(item.sellingPrice, item.qty);
    sellingTotal += lineTotal(item.sellingPrice, item.qty);
  }

  const totalMargin = sellingTotal - purchaseTotal;
  const marginRate = sellingTotal > 0 ? Math.round((totalMargin / sellingTotal) * 1000) / 10 : 0;

  return { purchaseTotal, sellingTotal, supplyTotal, taxTotal, totalMargin, marginRate };
}

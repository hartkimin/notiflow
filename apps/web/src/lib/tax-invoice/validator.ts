import type { TaxInvoice, TaxInvoiceItem, ValidationResult } from "./types";

export function isValidBizNo(bizNo: string): boolean {
  if (!bizNo || bizNo.length !== 10 || !/^\d{10}$/.test(bizNo)) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const digits = bizNo.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i];
  }
  sum += Math.floor((digits[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === digits[9];
}

export function validateForIssue(
  invoice: TaxInvoice,
  items: TaxInvoiceItem[]
): ValidationResult {
  const errors: string[] = [];

  if (!isValidBizNo(invoice.supplier_biz_no)) {
    errors.push("공급자 사업자등록번호가 유효하지 않습니다.");
  }
  if (!isValidBizNo(invoice.buyer_biz_no)) {
    errors.push("공급받는자 사업자등록번호가 유효하지 않습니다.");
  }

  const expectedTotal = Number(invoice.supply_amount) + Number(invoice.tax_amount);
  if (Math.abs(expectedTotal - Number(invoice.total_amount)) > 1) {
    errors.push("공급가액 + 세액 ≠ 합계금액");
  }

  if (!invoice.supplier_name) errors.push("공급자 상호가 없습니다.");
  if (!invoice.buyer_name) errors.push("공급받는자 상호가 없습니다.");
  if (!invoice.issue_date) errors.push("작성일자가 없습니다.");

  if (!items || items.length === 0) {
    errors.push("품목이 1건 이상 필요합니다.");
  }

  return { valid: errors.length === 0, errors };
}

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import { join } from "path";
import type { TaxInvoiceDetail, TaxInvoiceItem } from "./types";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 40;
const LINE_COLOR = rgb(0, 0, 0);
const HEADER_BG = rgb(0.93, 0.93, 0.93);

function formatAmount(n: number): string {
  return `\\${Math.round(n).toLocaleString("ko-KR")}`;
}

function formatBizNo(biz: string): string {
  const digits = biz.replace(/[^0-9]/g, "");
  if (digits.length !== 10) return biz;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function formatDate(date: string | null): string {
  if (!date) return "";
  return date.slice(0, 10);
}

type DrawTextFn = (text: string, x: number, y: number, size?: number) => void;
type DrawLineFn = (x1: number, y1: number, x2: number, y2: number, thickness?: number) => void;
type DrawRectFn = (x: number, y: number, w: number, h: number) => void;

export async function generateInvoicePdf(invoice: TaxInvoiceDetail): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  // Try to load Korean font, fall back to Helvetica
  let font;
  try {
    const fontPath = join(process.cwd(), "src/lib/tax-invoice/fonts/NotoSansKR-Regular.ttf");
    const fontBytes = await readFile(fontPath);
    font = await doc.embedFont(fontBytes);
  } catch {
    font = await doc.embedFont(StandardFonts.Helvetica);
  }

  const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - MARGIN;
  const contentWidth = A4_WIDTH - MARGIN * 2;

  // Helper: draw text safely (skip chars the font can't encode)
  const drawText: DrawTextFn = (text, x, yPos, size = 10) => {
    try {
      page.drawText(text || "", { x, y: yPos, size, font, color: rgb(0, 0, 0) });
    } catch {
      // If full string fails, try character by character
      try {
        let xOffset = 0;
        for (const char of (text || "")) {
          try {
            page.drawText(char, { x: x + xOffset, y: yPos, size, font, color: rgb(0, 0, 0) });
            xOffset += font.widthOfTextAtSize(char, size);
          } catch {
            // Skip unencodable character
            xOffset += size * 0.5;
          }
        }
      } catch {
        // Give up silently
      }
    }
  };

  const drawLine: DrawLineFn = (x1, y1, x2, y2, thickness = 0.5) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: LINE_COLOR });
  };

  const drawRect: DrawRectFn = (x, yPos, w, h) => {
    page.drawRectangle({ x, y: yPos, width: w, height: h, color: HEADER_BG });
  };

  const left = MARGIN;
  const right = A4_WIDTH - MARGIN;
  const midX = A4_WIDTH / 2;

  // ─── Title ───
  const title = "\uc804 \uc790 \uc138 \uae08 \uacc4 \uc0b0 \uc11c"; // 전 자 세 금 계 산 서
  const titleWidth = font.widthOfTextAtSize(title, 18);
  drawText(title, (A4_WIDTH - titleWidth) / 2, y, 18);
  y -= 18;

  // Subtitle: invoice number & date
  const subtitle = `(${invoice.invoice_number})`;
  const subtitleWidth = font.widthOfTextAtSize(subtitle, 9);
  drawText(subtitle, (A4_WIDTH - subtitleWidth) / 2, y, 9);
  y -= 8;

  const dateStr = `\ubc1c\ud589\uc77c: ${formatDate(invoice.issue_date)}`; // 발행일
  const dateWidth = font.widthOfTextAtSize(dateStr, 8);
  drawText(dateStr, (A4_WIDTH - dateWidth) / 2, y, 8);
  y -= 18;

  // ─── Double line separator ───
  drawLine(left, y, right, y, 1.5);
  y -= 2;
  drawLine(left, y, right, y, 0.5);
  y -= 18;

  // ─── Supplier / Buyer header labels ───
  const colLeftStart = left;
  const colRightStart = midX + 5;
  const colWidth = contentWidth / 2 - 5;

  // Section headers with background
  drawRect(colLeftStart, y - 3, colWidth, 16);
  drawRect(colRightStart, y - 3, colWidth, 16);

  const supplierLabel = "[ \uacf5\uae09\uc790 ]"; // [ 공급자 ]
  const buyerLabel = "[ \uacf5\uae09\ubc1b\ub294\uc790 ]"; // [ 공급받는자 ]
  drawText(supplierLabel, colLeftStart + 5, y, 11);
  drawText(buyerLabel, colRightStart + 5, y, 11);
  y -= 20;

  // ─── Info rows ───
  const infoRows: [string, string, string][] = [
    ["\uc0ac\uc5c5\uc790\ubc88\ud638", formatBizNo(invoice.supplier_biz_no), formatBizNo(invoice.buyer_biz_no)], // 사업자번호
    ["\uc0c1    \ud638", invoice.supplier_name, invoice.buyer_name], // 상    호
    ["\ub300 \ud45c \uc790", invoice.supplier_ceo_name || "", invoice.buyer_ceo_name || ""], // 대 표 자
    ["\uc8fc    \uc18c", invoice.supplier_address || "", invoice.buyer_address || ""], // 주    소
    ["\uc5c5    \ud0dc", invoice.supplier_biz_type || "", invoice.buyer_biz_type || ""], // 업    태
    ["\uc885    \ubaa9", invoice.supplier_biz_item || "", invoice.buyer_biz_item || ""], // 종    목
    ["\uc774\uba54\uc77c", invoice.supplier_email || "", invoice.buyer_email || ""], // 이메일
  ];

  for (const [label, supplierVal, buyerVal] of infoRows) {
    // Left column
    drawText(`${label}:`, colLeftStart + 5, y, 9);
    drawText(supplierVal, colLeftStart + 75, y, 9);
    // Vertical separator
    drawLine(midX, y + 12, midX, y - 4, 0.3);
    // Right column
    drawText(`${label}:`, colRightStart + 5, y, 9);
    drawText(buyerVal, colRightStart + 75, y, 9);
    y -= 16;
  }

  y -= 5;
  drawLine(left, y, right, y, 1);
  y -= 22;

  // ─── Amount summary ───
  drawRect(left, y - 5, contentWidth, 20);

  const amtLabels: [string, number, number][] = [
    ["\uacf5\uae09\uac00\uc561", invoice.supply_amount, left + 5], // 공급가액
    ["\uc138\uc561", invoice.tax_amount, left + 200], // 세액
    ["\ud569\uacc4\uae08\uc561", invoice.total_amount, left + 360], // 합계금액
  ];

  for (const [label, amount, x] of amtLabels) {
    drawText(`${label}: ${formatAmount(amount)}`, x, y, 11);
  }

  y -= 12;
  drawLine(left, y, right, y, 0.5);
  y -= 22;

  // ─── Items table header ───
  const colDefs = [
    { label: "\uc21c\ubc88", x: left, w: 30 }, // 순번
    { label: "\uc77c\uc790", x: left + 30, w: 55 }, // 일자
    { label: "\ud488\uba85", x: left + 85, w: 140 }, // 품명
    { label: "\uaddc\uaca9", x: left + 225, w: 60 }, // 규격
    { label: "\uc218\ub7c9", x: left + 285, w: 45 }, // 수량
    { label: "\ub2e8\uac00", x: left + 330, w: 65 }, // 단가
    { label: "\uacf5\uae09\uac00\uc561", x: left + 395, w: 65 }, // 공급가액
    { label: "\uc138\uc561", x: left + 460, w: 55 }, // 세액
  ];

  // Header row background
  drawRect(left, y - 5, contentWidth, 18);

  for (const col of colDefs) {
    drawText(col.label, col.x + 3, y, 8);
  }
  y -= 8;
  drawLine(left, y, right, y, 0.5);
  y -= 14;

  // ─── Item rows ───
  const drawItemRow = (item: TaxInvoiceItem) => {
    if (y < MARGIN + 60) return; // page overflow guard

    const values = [
      String(item.item_seq),
      item.item_date ? item.item_date.slice(5, 10) : "",
      (item.item_name || "").slice(0, 22),
      (item.specification || "").slice(0, 10),
      String(item.quantity),
      Math.round(item.unit_price).toLocaleString("ko-KR"),
      Math.round(item.supply_amount).toLocaleString("ko-KR"),
      Math.round(item.tax_amount).toLocaleString("ko-KR"),
    ];

    for (let i = 0; i < colDefs.length; i++) {
      drawText(values[i], colDefs[i].x + 3, y, 8);
    }

    y -= 14;
    drawLine(left, y + 2, right, y + 2, 0.2);
  };

  for (const item of invoice.items) {
    drawItemRow(item);
  }

  // Empty rows to fill table (standard form usually has ~10 rows)
  const minRows = 4;
  const emptyRowsNeeded = Math.max(0, minRows - invoice.items.length);
  for (let i = 0; i < emptyRowsNeeded; i++) {
    if (y < MARGIN + 60) break;
    y -= 14;
    drawLine(left, y + 2, right, y + 2, 0.2);
  }

  y -= 5;
  drawLine(left, y, right, y, 1);
  y -= 22;

  // ─── Totals row ───
  drawRect(left, y - 5, contentWidth, 20);
  const totalLabel = `\ud569\uacc4\uae08\uc561: ${formatAmount(invoice.total_amount)}`; // 합계금액
  drawText(totalLabel, left + 5, y, 12);

  const supplyTotal = `\uacf5\uae09\uac00\uc561: ${formatAmount(invoice.supply_amount)}`; // 공급가액
  drawText(supplyTotal, left + 250, y, 10);

  const taxTotal = `\uc138\uc561: ${formatAmount(invoice.tax_amount)}`; // 세액
  drawText(taxTotal, left + 410, y, 10);
  y -= 25;

  // ─── Remarks ───
  if (invoice.remarks) {
    drawLine(left, y + 5, right, y + 5, 0.3);
    y -= 5;
    const remarkLabel = `\ube44\uace0: ${invoice.remarks}`; // 비고
    drawText(remarkLabel, left + 5, y, 9);
    y -= 18;
  }

  // ─── Linked orders ───
  if (invoice.linked_orders.length > 0) {
    const ordersLabel = `\uc8fc\ubb38\ubc88\ud638: ${invoice.linked_orders.map((o) => o.order_number).join(", ")}`; // 주문번호
    drawText(ordersLabel, left + 5, y, 8);
    y -= 18;
  }

  // ─── Footer separator ───
  y -= 10;
  drawLine(left, y, right, y, 0.5);
  y -= 15;

  // Issue date & status
  const issuedAt = invoice.issued_at
    ? `\ubc1c\ud589\uc77c\uc2dc: ${invoice.issued_at.slice(0, 16).replace("T", " ")}` // 발행일시
    : "";
  if (issuedAt) {
    drawText(issuedAt, left + 5, y, 8);
  }

  const statusMap: Record<string, string> = {
    draft: "\uc784\uc2dc\uc800\uc7a5", // 임시저장
    issued: "\ubc1c\ud589\uc644\ub8cc", // 발행완료
    sent: "\uc804\uc1a1\uc644\ub8cc", // 전송완료
    cancelled: "\ucde8\uc18c", // 취소
    modified: "\uc218\uc815", // 수정
  };
  const statusLabel = `\uc0c1\ud0dc: ${statusMap[invoice.status] || invoice.status}`; // 상태
  drawText(statusLabel, right - 120, y, 8);

  // Set PDF metadata
  doc.setTitle(`\uc138\uae08\uacc4\uc0b0\uc11c - ${invoice.invoice_number}`); // 세금계산서
  doc.setSubject(invoice.invoice_number);
  doc.setCreator("NotiFlow");
  doc.setProducer("NotiFlow (pdf-lib)");

  return doc.save();
}

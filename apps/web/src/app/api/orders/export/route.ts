import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import { vatToExcl, calcOrderTotals, calcLine, lineTotal, fmt4 } from "@/lib/price-calc";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  confirmed: "미완료",
  delivered: "완료",
  invoiced: "정산완료",
  cancelled: "취소",
};

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "items"; // "orders" | "items"
  const status = url.searchParams.get("status");
  const hospitalId = url.searchParams.get("hospital_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const search = url.searchParams.get("search");

  // Fetch orders with items
  let query = supabase
    .from("orders")
    .select("id, order_number, order_date, status, delivery_date, delivered_at, notes, hospitals(name), order_items(product_name, quantity, unit_type, unit_price, purchase_price, sales_rep, suppliers(name))")
    .order("order_date", { ascending: false })
    .limit(1000);

  if (status && status !== "all") {
    query = query.eq("status", status);
  } else {
    // 기본: 취소된 주문은 내보내기에서 제외
    query = query.neq("status", "cancelled");
  }
  if (hospitalId) query = query.eq("hospital_id", Number(hospitalId));
  if (from) query = query.gte("order_date", from);
  if (to) query = query.lte("order_date", to);

  // Fetch invoiced order IDs
  const { data: invoiceLinks } = await supabase
    .from("tax_invoice_orders")
    .select("order_id, tax_invoices!inner(status)")
    .neq("tax_invoices.status", "cancelled");
  const invoicedIds = new Set((invoiceLinks ?? []).map((l) => (l as unknown as { order_id: number }).order_id));

  const { data: orders, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type ItemRow = {
    product_name: string; quantity: number; unit_type: string;
    unit_price: number | null; purchase_price: number | null;
    sales_rep: string | null; suppliers: { name: string } | null;
  };

  const wb = XLSX.utils.book_new();

  if (mode === "orders") {
    // ── 주문 목록만 (주문 단위 1행) ──
    const rows: Record<string, unknown>[] = [];

    for (const order of orders ?? []) {
      const hospitalName = (order.hospitals as unknown as { name: string } | null)?.name ?? "";
      const items = (order.order_items as unknown as ItemRow[]) ?? [];

      const totals = calcOrderTotals(
        items.map((i) => ({
          purchasePrice: i.purchase_price ?? 0,
          sellingPrice: i.unit_price ?? 0,
          qty: i.quantity,
        })),
      );

      const reps = [...new Set(items.map((i) => i.sales_rep).filter(Boolean))];

      rows.push({
        "주문번호": order.order_number,
        "발주일": order.order_date,
        "배송일": order.delivery_date ?? "",
        "거래처": hospitalName,
        "품목수": items.length,
        "매입합계": totals.purchaseTotal || "",
        "매출합계": totals.sellingTotal || "",
        "매출이익": totals.totalMargin || "",
        "이익률(%)": totals.sellingTotal > 0 ? totals.marginRate : "",
        "담당자": reps.join(", "),
        "상태": STATUS_LABEL[order.status] ?? order.status,
        "계산서": invoicedIds.has(order.id) ? "발행" : "미발행",
        "비고": order.notes ?? "",
      });
    }

    const filteredRows = applySearch(rows, search);

    const ws = XLSX.utils.json_to_sheet(filteredRows);
    ws["!cols"] = [
      { wch: 20 }, // 주문번호
      { wch: 12 }, // 발주일
      { wch: 12 }, // 배송일
      { wch: 18 }, // 거래처
      { wch: 8 },  // 품목수
      { wch: 14 }, // 매입합계
      { wch: 14 }, // 매출합계
      { wch: 14 }, // 매출이익
      { wch: 10 }, // 이익률
      { wch: 12 }, // 담당자
      { wch: 10 }, // 상태
      { wch: 8 },  // 계산서
      { wch: 20 }, // 비고
    ];
    XLSX.utils.book_append_sheet(wb, ws, "주문목록");

  } else {
    // ── 품목 포함 (주문+품목 상세) ──
    const rows: Record<string, unknown>[] = [];

    for (const order of orders ?? []) {
      const hospitalName = (order.hospitals as unknown as { name: string } | null)?.name ?? "";
      const items = (order.order_items as unknown as ItemRow[]) ?? [];

      const totals = calcOrderTotals(
        items.map((i) => ({
          purchasePrice: i.purchase_price ?? 0,
          sellingPrice: i.unit_price ?? 0,
          qty: i.quantity,
        })),
      );

      if (items.length === 0) {
        rows.push({
          "주문번호": order.order_number,
          "발주일": order.order_date,
          "배송일": order.delivery_date ?? "",
          "거래처": hospitalName,
          "상태": STATUS_LABEL[order.status] ?? order.status,
          "계산서": invoicedIds.has(order.id) ? "발행" : "미발행",
          "품목명": "",
          "수량": "",
          "단위": "",
          "매입(VAT)단가": "",
          "매입공급가": "",
          "매입부가세": "",
          "매입합계": "",
          "판매(VAT)단가": "",
          "판매공급가": "",
          "판매부가세": "",
          "판매합계": "",
          "매출이익": "",
          "이익률(%)": "",
          "매입처": "",
          "담당자": "",
          "비고": order.notes ?? "",
        });
      } else {
        for (const item of items) {
          const pp = item.purchase_price ?? 0;
          const sp = item.unit_price ?? 0;
          const lc = calcLine(pp, sp, item.quantity);

          rows.push({
            "주문번호": order.order_number,
            "발주일": order.order_date,
            "배송일": order.delivery_date ?? "",
            "거래처": hospitalName,
            "상태": STATUS_LABEL[order.status] ?? order.status,
            "계산서": invoicedIds.has(order.id) ? "발행" : "미발행",
            "품목명": item.product_name ?? "",
            "수량": item.quantity,
            "단위": item.unit_type ?? "",
            "매입(VAT)단가": pp > 0 ? lc.ppVat : "",
            "매입공급가": pp > 0 ? lc.pSupply : "",
            "매입부가세": pp > 0 ? lc.pTax : "",
            "매입합계": pp > 0 ? lc.pTotal : "",
            "판매(VAT)단가": sp > 0 ? lc.spVat : "",
            "판매공급가": sp > 0 ? lc.sSupply : "",
            "판매부가세": sp > 0 ? lc.sTax : "",
            "판매합계": sp > 0 ? lc.sTotal : "",
            "매출이익": (pp > 0 || sp > 0) ? lc.profit : "",
            "이익률(%)": (pp > 0 || sp > 0) ? lc.marginRate : "",
            "매입처": (item.suppliers as unknown as { name: string } | null)?.name ?? "",
            "담당자": item.sales_rep ?? "",
            "비고": order.notes ?? "",
          });
        }
      }
    }

    const filteredRows = applySearch(rows, search);

    const ws = XLSX.utils.json_to_sheet(filteredRows);
    ws["!cols"] = [
      { wch: 20 }, // 주문번호
      { wch: 12 }, // 발주일
      { wch: 12 }, // 배송일
      { wch: 18 }, // 거래처
      { wch: 10 }, // 상태
      { wch: 8 },  // 계산서
      { wch: 28 }, // 품목명
      { wch: 8 },  // 수량
      { wch: 6 },  // 단위
      { wch: 14 }, // 매입(VAT)단가
      { wch: 14 }, // 매입공급가
      { wch: 12 }, // 매입부가세
      { wch: 14 }, // 매입합계
      { wch: 14 }, // 판매(VAT)단가
      { wch: 14 }, // 판매공급가
      { wch: 12 }, // 판매부가세
      { wch: 14 }, // 판매합계
      { wch: 14 }, // 매출이익
      { wch: 10 }, // 이익률
      { wch: 15 }, // 매입처
      { wch: 10 }, // 담당자
      { wch: 20 }, // 비고
    ];
    XLSX.utils.book_append_sheet(wb, ws, "주문목록");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const suffix = mode === "orders" ? "주문목록" : "주문목록_품목포함";

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`)}`,
    },
  });
}

function applySearch(rows: Record<string, unknown>[], search: string | null) {
  if (!search) return rows;
  return rows.filter(r =>
    Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())),
  );
}

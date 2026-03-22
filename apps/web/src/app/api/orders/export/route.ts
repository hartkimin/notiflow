import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  confirmed: "접수확인",
  delivered: "배송완료",
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

  if (status && status !== "all") query = query.eq("status", status);
  if (hospitalId) query = query.eq("hospital_id", Number(hospitalId));
  if (from) query = query.gte("order_date", from);
  if (to) query = query.lte("order_date", to);

  const { data: orders, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build rows — one row per order item
  const rows: Record<string, unknown>[] = [];
  for (const order of orders ?? []) {
    const hospitalName = (order.hospitals as unknown as { name: string } | null)?.name ?? "";
    const items = (order.order_items as unknown as Array<{
      product_name: string; quantity: number; unit_type: string;
      unit_price: number | null; purchase_price: number | null;
      sales_rep: string | null; suppliers: { name: string } | null;
    }>) ?? [];

    if (items.length === 0) {
      rows.push({
        "주문번호": order.order_number,
        "주문일": order.order_date,
        "거래처": hospitalName,
        "상태": STATUS_LABEL[order.status] ?? order.status,
        "배송예정일": order.delivery_date ?? "",
        "배송완료일": order.delivered_at ? new Date(order.delivered_at).toISOString().slice(0, 10) : "",
        "품목명": "",
        "수량": "",
        "단위": "",
        "판매단가": "",
        "매입단가": "",
        "판매금액": "",
        "매입금액": "",
        "매입처": "",
        "담당자": "",
        "비고": order.notes ?? "",
      });
    } else {
      for (const item of items) {
        const sellTotal = (item.unit_price ?? 0) * (item.quantity ?? 0);
        const buyTotal = (item.purchase_price ?? 0) * (item.quantity ?? 0);
        rows.push({
          "주문번호": order.order_number,
          "주문일": order.order_date,
          "거래처": hospitalName,
          "상태": STATUS_LABEL[order.status] ?? order.status,
          "배송예정일": order.delivery_date ?? "",
          "배송완료일": order.delivered_at ? new Date(order.delivered_at).toISOString().slice(0, 10) : "",
          "품목명": item.product_name ?? "",
          "수량": item.quantity,
          "단위": item.unit_type ?? "",
          "판매단가": item.unit_price ?? "",
          "매입단가": item.purchase_price ?? "",
          "판매금액": sellTotal || "",
          "매입금액": buyTotal || "",
          "매입처": (item.suppliers as unknown as { name: string } | null)?.name ?? "",
          "담당자": item.sales_rep ?? "",
          "비고": order.notes ?? "",
        });
      }
    }
  }

  // Apply search filter (client-side for simplicity)
  const filteredRows = search
    ? rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())))
    : rows;

  // Generate Excel
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filteredRows);

  // Column widths
  ws["!cols"] = [
    { wch: 20 }, // 주문번호
    { wch: 12 }, // 주문일
    { wch: 18 }, // 거래처
    { wch: 10 }, // 상태
    { wch: 12 }, // 배송예정일
    { wch: 12 }, // 배송완료일
    { wch: 30 }, // 품목명
    { wch: 8 },  // 수량
    { wch: 8 },  // 단위
    { wch: 12 }, // 판매단가
    { wch: 12 }, // 매입단가
    { wch: 14 }, // 판매금액
    { wch: 14 }, // 매입금액
    { wch: 15 }, // 매입처
    { wch: 10 }, // 담당자
    { wch: 20 }, // 비고
  ];

  XLSX.utils.book_append_sheet(wb, ws, "주문목록");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orders_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}

import { createAdminClient } from "@/lib/supabase/admin";
import { ollamaChat } from "./ollama-client";
import { escapeLikeValue } from "@/lib/supabase/sanitize";

// ─── Intent Types ───────────────────────────────

export type NLQueryIntent =
  | "order_status"
  | "order_detail"
  | "order_stats"
  | "product_search"
  | "product_stock"
  | "hospital_info"
  | "hospital_orders"
  | "supplier_info"
  | "delivery_status"
  | "sales_report"
  | "profit_analysis"
  | "invoice_status"
  | "mfds_search"
  | "period_comparison"
  | "recent_messages"
  | "device_status"
  | "user_list"
  | "audit_log"
  | "partner_products"
  | "kpis_report"
  | "order_comments"
  | "general_question"
  | "unknown";

interface IntentResult {
  intent: NLQueryIntent;
  params: Record<string, string | number | null>;
  confidence: number;
}

// ─── Intent Classification Prompt ───────────────

const INTENT_SYSTEM_PROMPT = `의도분류기. JSON출력: {"intent":"카테고리","params":{},"confidence":0.9}
의도: order_status(주문현황) order_detail(ORD-번호상세) order_stats(주문통계) product_search(제품검색) product_stock(제품수량) hospital_info(병원정보) hospital_orders(병원주문) supplier_info(공급사) delivery_status(배송) sales_report(매출) profit_analysis(이익/마진) invoice_status(세금계산서) mfds_search(식약처검색) period_comparison(기간비교) recent_messages(최근메시지) device_status(기기상태) user_list(사용자) audit_log(변경이력) partner_products(거래처품목) kpis_report(KPIS신고) order_comments(코멘트) general_question(일반) unknown
매개변수: hospital_name supplier_name product_name order_number period(today/this_week/this_month/last_month) compare_period(last_month) status(draft/confirmed/delivered/invoiced) sales_rep limit`;

// ─── Response Generation Prompt ─────────────────

const RESPONSE_SYSTEM_PROMPT = `의료물자 주문관리 어시스턴트. 한국어로 간결 답변. 숫자는 쉼표, 날짜는 한국식. confirmed=미완료 delivered=완료. 표가 적합하면 마크다운 테이블.`;

// ─── Date Period Resolver ───────────────────────

function resolvePeriod(period?: string | null): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  switch (period) {
    case "today": return { dateFrom: today, dateTo: today };
    case "this_week": {
      const d = new Date(now); d.setDate(now.getDate() - now.getDay());
      return { dateFrom: d.toISOString().split("T")[0], dateTo: today };
    }
    case "this_month": {
      return { dateFrom: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, dateTo: today };
    }
    case "last_month": {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: lm.toISOString().split("T")[0], dateTo: lme.toISOString().split("T")[0] };
    }
    default: return { dateFrom: `${now.getFullYear()}-01-01`, dateTo: today };
  }
}

// ─── Query Executors ────────────────────────────

type QueryExecutor = (params: Record<string, string | number | null>) => Promise<unknown>;

const QUERY_MAP: Record<string, QueryExecutor> = {
  order_status: async (p) => {
    const sb = createAdminClient();
    const { dateFrom, dateTo } = resolvePeriod(p.period as string);
    let q = sb.from("orders").select("id, order_number, order_date, status, total_items, total_amount, hospitals(name)")
      .gte("order_date", dateFrom).lte("order_date", dateTo)
      .order("order_date", { ascending: false }).limit(Number(p.limit ?? 15));
    if (p.status) q = q.eq("status", p.status as string);
    return (await q).data;
  },

  order_detail: async (p) => {
    const sb = createAdminClient();
    const { data } = await sb.from("orders")
      .select("*, hospitals(name), order_items(*, products(name))")
      .eq("order_number", p.order_number as string).single();
    return data;
  },

  order_stats: async (p) => {
    const sb = createAdminClient();
    const { dateFrom, dateTo } = resolvePeriod(p.period as string);
    const { data } = await sb.from("orders").select("status, total_amount")
      .gte("order_date", dateFrom).lte("order_date", dateTo);
    const statuses: Record<string, number> = {};
    let totalAmount = 0;
    for (const o of data ?? []) {
      statuses[o.status] = (statuses[o.status] ?? 0) + 1;
      totalAmount += Number(o.total_amount ?? 0);
    }
    return { total_orders: data?.length ?? 0, total_amount: totalAmount, by_status: statuses, period: `${dateFrom} ~ ${dateTo}` };
  },

  product_search: async (p) => {
    const sb = createAdminClient();
    const name = escapeLikeValue((p.product_name ?? p.query ?? "") as string);
    // Search across all product sources: my items + MFDS (식약처)
    const [{ data: myDrugs }, { data: myDevices }, { data: mfdsDrugs }, { data: mfdsDevices }] = await Promise.all([
      sb.from("my_drugs").select("id, item_name, bar_code, entp_name, unit_price").ilike("item_name", `%${name}%`).limit(3),
      sb.from("my_devices").select("id, prdlst_nm, udidi_cd, mnft_iprt_entp_nm, unit_price").ilike("prdlst_nm", `%${name}%`).limit(3),
      sb.from("mfds_drugs").select("id, item_name, bar_code, entp_name").ilike("item_name", `%${name}%`).limit(5),
      sb.from("mfds_devices").select("id, prdlst_nm, udidi_cd, mnft_iprt_entp_nm").ilike("prdlst_nm", `%${name}%`).limit(5),
    ]);

    // Also try vector search if embedding is available
    let vectorResults: Array<{ name: string; similarity: number; type: string }> = [];
    try {
      const { generateEmbedding } = await import("./embedding-service");
      const { searchProducts } = await import("./vector-search");
      const { embedding } = await generateEmbedding(name);
      vectorResults = await searchProducts(embedding, 3, 0.5);
    } catch { /* no embedding available */ }

    return {
      my_items: {
        drugs: (myDrugs ?? []).map(d => ({ name: d.item_name, code: d.bar_code, manufacturer: d.entp_name, source: "내 의약품" })),
        devices: (myDevices ?? []).map(d => ({ name: d.prdlst_nm, code: d.udidi_cd, manufacturer: d.mnft_iprt_entp_nm, source: "내 의료기기" })),
      },
      mfds: {
        drugs: (mfdsDrugs ?? []).map(d => ({ name: d.item_name, code: d.bar_code, manufacturer: d.entp_name, source: "식약처 의약품" })),
        devices: (mfdsDevices ?? []).map(d => ({ name: d.prdlst_nm, code: d.udidi_cd, manufacturer: d.mnft_iprt_entp_nm, source: "식약처 의료기기" })),
      },
      vector_matches: vectorResults.map(v => ({ name: v.name, similarity: Math.round(v.similarity * 100) + "%", source: v.type === "drug" ? "벡터 의약품" : "벡터 의료기기" })),
      search_term: name,
    };
  },

  product_stock: async (p) => {
    const sb = createAdminClient();
    const { dateFrom, dateTo } = resolvePeriod(p.period as string);
    const name = escapeLikeValue(p.product_name as string);
    const { data } = await sb.from("order_items")
      .select("product_name, quantity, unit_type, orders!inner(order_date, status, hospitals(name))")
      .ilike("product_name", `%${name}%`)
      .gte("orders.order_date", dateFrom)
      .lte("orders.order_date", dateTo);
    const totalQty = (data ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0);
    return { product_name: p.product_name, total_quantity: totalQty, items: (data ?? []).slice(0, 20), period: `${dateFrom} ~ ${dateTo}` };
  },

  hospital_info: async (p) => {
    const sb = createAdminClient();
    const { data } = await sb.from("hospitals").select("*").ilike("name", `%${escapeLikeValue(p.hospital_name as string)}%`).limit(5);
    return data;
  },

  hospital_orders: async (p) => {
    const sb = createAdminClient();
    const { dateFrom, dateTo } = resolvePeriod(p.period as string);
    const { data: hospitals } = await sb.from("hospitals").select("id, name").ilike("name", `%${escapeLikeValue(p.hospital_name as string)}%`).limit(1);
    if (!hospitals?.length) return { error: "병원을 찾을 수 없습니다" };
    const { data: orders } = await sb.from("orders").select("id, order_number, order_date, status, total_items, total_amount")
      .eq("hospital_id", hospitals[0].id).gte("order_date", dateFrom).lte("order_date", dateTo)
      .order("order_date", { ascending: false });
    return { hospital: hospitals[0], orders };
  },

  supplier_info: async (p) => {
    const sb = createAdminClient();
    const { data } = await sb.from("suppliers").select("*").ilike("name", `%${escapeLikeValue(p.supplier_name as string)}%`).limit(5);
    return data;
  },

  delivery_status: async (p) => {
    const sb = createAdminClient();
    const { dateFrom, dateTo } = resolvePeriod(p.period as string);
    const { data } = await sb.from("orders").select("id, order_number, order_date, delivery_date, status, hospitals(name), total_items")
      .gte("delivery_date", dateFrom).lte("delivery_date", dateTo)
      .in("status", ["confirmed", "delivered"]).order("delivery_date", { ascending: true });
    return data;
  },

  sales_report: async (p) => {
    const sb = createAdminClient();
    const { dateFrom, dateTo } = resolvePeriod(p.period as string);
    const { data } = await sb.from("orders").select("status, total_amount, supply_amount, tax_amount")
      .gte("order_date", dateFrom).lte("order_date", dateTo);
    return {
      total_orders: data?.length ?? 0,
      total_amount: data?.reduce((s, o) => s + (Number(o.total_amount) || 0), 0) ?? 0,
      supply_amount: data?.reduce((s, o) => s + (Number(o.supply_amount) || 0), 0) ?? 0,
      period: `${dateFrom} ~ ${dateTo}`,
    };
  },

  profit_analysis: async (p) => {
    const sb = createAdminClient();
    const { dateFrom, dateTo } = resolvePeriod(p.period as string);
    let q = sb.from("order_items")
      .select("product_name, quantity, unit_price, purchase_price, sales_rep, orders!inner(order_date, status, hospital_id, hospitals(name))")
      .gte("orders.order_date", dateFrom).lte("orders.order_date", dateTo);
    if (p.hospital_name) {
      // Filter will be applied in-memory after fetch since nested filter is complex
    }
    const { data } = await q;
    const items = data ?? [];
    const totalRevenue = items.reduce((s, i) => s + (Number(i.unit_price ?? 0) * (i.quantity ?? 0)), 0);
    const totalPurchase = items.reduce((s, i) => s + (Number(i.purchase_price ?? 0) * (i.quantity ?? 0)), 0);
    const totalProfit = totalRevenue - totalPurchase;

    // Group by sales_rep
    const byRep: Record<string, { revenue: number; purchase: number; count: number }> = {};
    for (const i of items) {
      const rep = i.sales_rep ?? "미지정";
      if (!byRep[rep]) byRep[rep] = { revenue: 0, purchase: 0, count: 0 };
      byRep[rep].revenue += Number(i.unit_price ?? 0) * (i.quantity ?? 0);
      byRep[rep].purchase += Number(i.purchase_price ?? 0) * (i.quantity ?? 0);
      byRep[rep].count++;
    }

    // Group by hospital
    const byHospital: Record<string, { revenue: number; purchase: number; count: number }> = {};
    for (const i of items) {
      const name = (i.orders as unknown as { hospitals: { name: string } })?.hospitals?.name ?? "알 수 없음";
      if (!byHospital[name]) byHospital[name] = { revenue: 0, purchase: 0, count: 0 };
      byHospital[name].revenue += Number(i.unit_price ?? 0) * (i.quantity ?? 0);
      byHospital[name].purchase += Number(i.purchase_price ?? 0) * (i.quantity ?? 0);
      byHospital[name].count++;
    }

    return {
      period: `${dateFrom} ~ ${dateTo}`,
      total: { revenue: totalRevenue, purchase: totalPurchase, profit: totalProfit, margin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) + "%" : "0%" },
      by_sales_rep: Object.entries(byRep).map(([name, v]) => ({ name, ...v, profit: v.revenue - v.purchase, margin: v.revenue > 0 ? ((v.revenue - v.purchase) / v.revenue * 100).toFixed(1) + "%" : "0%" })).sort((a, b) => b.revenue - a.revenue),
      by_hospital: Object.entries(byHospital).map(([name, v]) => ({ name, ...v, profit: v.revenue - v.purchase, margin: v.revenue > 0 ? ((v.revenue - v.purchase) / v.revenue * 100).toFixed(1) + "%" : "0%" })).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    };
  },

  invoice_status: async (p) => {
    const sb = createAdminClient();
    const { dateFrom, dateTo } = resolvePeriod(p.period as string);
    const { data: invoices } = await sb.from("tax_invoices")
      .select("id, invoice_number, issue_date, status, total_amount, buyer_name")
      .gte("issue_date", dateFrom).lte("issue_date", dateTo)
      .order("issue_date", { ascending: false }).limit(Number(p.limit ?? 20));

    // Count uninvoiced delivered orders
    const { data: uninvoiced } = await sb.from("orders")
      .select("id, order_number, order_date, total_amount, hospitals(name)")
      .eq("status", "delivered")
      .gte("order_date", dateFrom).lte("order_date", dateTo);

    const statuses: Record<string, number> = {};
    for (const inv of invoices ?? []) statuses[inv.status] = (statuses[inv.status] ?? 0) + 1;

    return {
      period: `${dateFrom} ~ ${dateTo}`,
      invoices: invoices ?? [],
      by_status: statuses,
      total_amount: (invoices ?? []).reduce((s, i) => s + (Number(i.total_amount) || 0), 0),
      uninvoiced_orders: (uninvoiced ?? []).length,
      uninvoiced_amount: (uninvoiced ?? []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
    };
  },

  mfds_search: async (p) => {
    const sb = createAdminClient();
    const name = escapeLikeValue(p.product_name as string);
    const [{ data: drugs, count: drugCount }, { data: devices, count: deviceCount }] = await Promise.all([
      sb.from("mfds_drugs").select("id, item_name, entp_name, bar_code, item_permit_date", { count: "exact" }).ilike("item_name", `%${name}%`).limit(5),
      sb.from("mfds_devices").select("id, prdlst_nm, mnft_iprt_entp_nm, udidi_cd, prmsn_ymd", { count: "exact" }).ilike("prdlst_nm", `%${name}%`).limit(5),
    ]);
    return {
      search_term: p.product_name,
      drugs: { items: drugs ?? [], total: drugCount ?? 0 },
      devices: { items: devices ?? [], total: deviceCount ?? 0 },
    };
  },

  period_comparison: async (p) => {
    const sb = createAdminClient();
    const { dateFrom: curFrom, dateTo: curTo } = resolvePeriod(p.period as string ?? "this_month");
    const { dateFrom: prevFrom, dateTo: prevTo } = resolvePeriod(p.compare_period as string ?? "last_month");

    const [{ data: curData }, { data: prevData }] = await Promise.all([
      sb.from("orders").select("status, total_amount").gte("order_date", curFrom).lte("order_date", curTo),
      sb.from("orders").select("status, total_amount").gte("order_date", prevFrom).lte("order_date", prevTo),
    ]);

    const curTotal = (curData ?? []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
    const prevTotal = (prevData ?? []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
    const change = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal * 100).toFixed(1) : "N/A";

    return {
      current: { period: `${curFrom} ~ ${curTo}`, orders: curData?.length ?? 0, total_amount: curTotal },
      previous: { period: `${prevFrom} ~ ${prevTo}`, orders: prevData?.length ?? 0, total_amount: prevTotal },
      change_percent: change,
      trend: curTotal > prevTotal ? "증가" : curTotal < prevTotal ? "감소" : "동일",
    };
  },

  recent_messages: async (p) => {
    const sb = createAdminClient();
    const { data } = await sb.from("captured_messages").select("id, app_name, sender, content, received_at")
      .eq("is_deleted", false).order("received_at", { ascending: false }).limit(Number(p.limit ?? 10));
    return (data ?? []).map(m => ({
      ...m,
      received_at: new Date(typeof m.received_at === "string" ? Number(m.received_at) : m.received_at).toLocaleString("ko-KR"),
      content: m.content.length > 80 ? m.content.slice(0, 80) + "..." : m.content,
    }));
  },

  device_status: async () => {
    const sb = createAdminClient();
    const { data } = await sb.from("mobile_devices")
      .select("id, device_name, device_model, os_version, app_version, is_active, last_heartbeat, sync_requested_at, created_at")
      .order("last_heartbeat", { ascending: false });
    return (data ?? []).map(d => ({
      ...d,
      last_heartbeat: d.last_heartbeat ? new Date(d.last_heartbeat).toLocaleString("ko-KR") : null,
      status: d.is_active ? (d.last_heartbeat && Date.now() - new Date(d.last_heartbeat).getTime() < 600_000 ? "온라인" : "오프라인") : "비활성",
    }));
  },

  user_list: async () => {
    const sb = createAdminClient();
    const { data } = await sb.from("user_profiles").select("id, name, role, is_active, created_at, updated_at").order("name");
    return data;
  },

  audit_log: async (p) => {
    const sb = createAdminClient();
    const { data } = await sb.from("audit_logs")
      .select("id, table_name, record_id, action, changes, created_at")
      .order("created_at", { ascending: false })
      .limit(Number(p.limit ?? 20));
    return (data ?? []).map(a => ({
      ...a,
      created_at: new Date(a.created_at).toLocaleString("ko-KR"),
      changes: typeof a.changes === "object" ? JSON.stringify(a.changes).slice(0, 200) : a.changes,
    }));
  },

  partner_products: async (p) => {
    const sb = createAdminClient();
    let q = sb.from("partner_products").select("id, partner_type, partner_id, product_source, product_id, standard_code, unit_price, partner_product_aliases(alias)");
    if (p.hospital_name) {
      const { data: hospitals } = await sb.from("hospitals").select("id").ilike("name", `%${escapeLikeValue(p.hospital_name as string)}%`).limit(1);
      if (hospitals?.length) q = q.eq("partner_type", "hospital").eq("partner_id", hospitals[0].id);
    }
    const { data } = await q.limit(20);

    // Enrich with product names
    const items = data ?? [];
    const drugIds = items.filter(i => i.product_source === "drug").map(i => i.product_id);
    const deviceIds = items.filter(i => i.product_source === "device").map(i => i.product_id);
    const [{ data: drugs }, { data: devices }] = await Promise.all([
      drugIds.length ? sb.from("my_drugs").select("id, item_name").in("id", drugIds) : { data: [] },
      deviceIds.length ? sb.from("my_devices").select("id, prdlst_nm").in("id", deviceIds) : { data: [] },
    ]);
    const nameMap = new Map<number, string>();
    for (const d of drugs ?? []) nameMap.set(d.id, d.item_name);
    for (const d of devices ?? []) nameMap.set(d.id, d.prdlst_nm);

    return items.map(i => ({
      product_name: nameMap.get(i.product_id) ?? `#${i.product_id}`,
      source: i.product_source,
      unit_price: i.unit_price,
      aliases: ((i.partner_product_aliases as unknown as Array<{ alias: string }>) ?? []).map(a => a.alias),
    }));
  },

  kpis_report: async (p) => {
    const sb = createAdminClient();
    let q = sb.from("kpis_reports")
      .select("id, order_item_id, reference_number, report_status, reported_at, order_items(product_name, quantity, orders(order_number, hospitals(name)))");
    if (p.status) q = q.eq("report_status", p.status as string);
    const { data } = await q.order("id", { ascending: false }).limit(Number(p.limit ?? 20));
    return data;
  },

  order_comments: async (p) => {
    const sb = createAdminClient();
    let q = sb.from("order_comments").select("id, content, created_at, order_id, orders(order_number), user_profiles(name)");
    if (p.order_number) {
      const { data: order } = await sb.from("orders").select("id").eq("order_number", p.order_number as string).single();
      if (order) q = q.eq("order_id", order.id);
    }
    const { data } = await q.order("created_at", { ascending: false }).limit(Number(p.limit ?? 20));
    return (data ?? []).map(c => ({
      ...c,
      created_at: new Date(c.created_at).toLocaleString("ko-KR"),
    }));
  },
};

// ─── Direct Formatting (skip LLM for simple queries) ────

function fmt(n: number): string {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억원`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

const STATUS_KO: Record<string, string> = { confirmed: "미완료", delivered: "완료" };

function tryDirectFormat(intent: string, _question: string, data: unknown): string | null {
  const d = data as Record<string, unknown>;
  switch (intent) {
    case "order_stats": {
      const byStatus = d.by_status as Record<string, number>;
      const statusStr = Object.entries(byStatus).map(([k, v]) => `${STATUS_KO[k] ?? k} ${v}건`).join(", ");
      return `📊 **주문 통계** (${d.period})\n\n총 **${d.total_orders}건**, 금액 **${fmt(d.total_amount as number)}**\n상태별: ${statusStr}`;
    }
    case "product_search": {
      const items = d as { my_items?: { drugs: Array<{name:string;manufacturer:string;source:string}>; devices: Array<{name:string;manufacturer:string;source:string}> }; mfds?: { drugs: Array<{name:string;manufacturer:string;source:string}>; devices: Array<{name:string;manufacturer:string;source:string}> }; vector_matches?: Array<{name:string;similarity:string;source:string}>; search_term?: string };
      const lines: string[] = [`🔍 **"${items.search_term}" 검색 결과**\n`];
      const allResults = [
        ...(items.my_items?.drugs ?? []),
        ...(items.my_items?.devices ?? []),
        ...(items.mfds?.drugs ?? []),
        ...(items.mfds?.devices ?? []),
      ];
      if (allResults.length === 0 && (!items.vector_matches || items.vector_matches.length === 0)) {
        return `"${items.search_term}"에 대한 검색 결과가 없습니다. 다른 키워드로 검색해보세요.`;
      }
      for (const r of allResults.slice(0, 8)) {
        lines.push(`• **${r.name}** — ${r.manufacturer} _(${r.source})_`);
      }
      if (items.vector_matches?.length) {
        lines.push("\n**벡터 유사 검색:**");
        for (const v of items.vector_matches) {
          lines.push(`• ${v.name} (유사도 ${v.similarity}) _(${v.source})_`);
        }
      }
      return lines.join("\n");
    }
    case "hospital_info": {
      const hospitals = d as unknown as Array<{name:string;phone?:string;address?:string}> | null;
      if (!hospitals?.length) return "해당 병원을 찾을 수 없습니다.";
      return hospitals.map(h => `🏥 **${h.name}**\n${h.phone ? `전화: ${h.phone}` : ""}${h.address ? `\n주소: ${h.address}` : ""}`).join("\n\n");
    }
    case "recent_messages": {
      const msgs = d as unknown as Array<{sender:string;app_name:string;content:string;received_at:string}> | null;
      if (!msgs?.length) return "최근 수신 메시지가 없습니다.";
      return `📨 **최근 메시지 ${msgs.length}건**\n\n` + msgs.map((m, i) =>
        `${i + 1}. **${m.sender}** (${m.app_name}) — ${m.received_at}\n   ${m.content}`
      ).join("\n");
    }
    case "device_status": {
      const devices = d as unknown as Array<{device_name:string;device_model:string;status:string;last_heartbeat:string}> | null;
      if (!devices?.length) return "등록된 기기가 없습니다.";
      return `📱 **기기 상태**\n\n` + devices.map(dev =>
        `• **${dev.device_name ?? dev.device_model}** — ${dev.status} (${dev.last_heartbeat ?? "미연결"})`
      ).join("\n");
    }
    case "user_list": {
      const users = d as unknown as Array<{name:string;role:string;is_active:boolean}> | null;
      if (!users?.length) return "등록된 사용자가 없습니다.";
      return `👥 **사용자 목록**\n\n` + users.map(u =>
        `• **${u.name}** — ${u.role} ${u.is_active ? "✅" : "❌ 비활성"}`
      ).join("\n");
    }
    default:
      return null; // Use LLM for complex queries
  }
}

function formatFallback(data: unknown): string {
  const str = JSON.stringify(data, null, 2);
  return str.length > 1500 ? str.slice(0, 1500) + "\n..." : str;
}

// ─── Main Query Function ────────────────────────

export interface NLQueryResult {
  question: string;
  intent: NLQueryIntent;
  confidence: number;
  answer: string;
  durationMs: number;
}

export async function processNaturalLanguageQuery(question: string): Promise<NLQueryResult> {
  const startMs = Date.now();

  // Step 1: Classify intent
  let intentResult: IntentResult;
  try {
    const res = await ollamaChat(INTENT_SYSTEM_PROMPT, question, { maxTokens: 256 });
    const cleaned = res.text.replace(/```json\n?|```\n?/g, "").trim();
    intentResult = JSON.parse(cleaned);
  } catch (err) {
    console.warn("[NL Query] Intent classification failed:", (err as Error).message);
    return {
      question, intent: "unknown", confidence: 0,
      answer: "AI 서버에 연결할 수 없습니다. 대시보드에서 직접 확인해주세요.",
      durationMs: Date.now() - startMs,
    };
  }

  const { intent, params, confidence } = intentResult;

  // Low confidence
  if (confidence < 0.5) {
    return {
      question, intent, confidence,
      answer: "질문을 좀 더 구체적으로 해주시겠어요? 예: '이번 주 주문 현황', '투석액 검색', 'ORD-20260321-001 상세'",
      durationMs: Date.now() - startMs,
    };
  }

  // General/unknown → try text-to-SQL fallback
  if (intent === "general_question" || intent === "unknown") {
    try {
      const sqlResult = await executeTextToSQL(question);
      if (sqlResult) {
        return { question, intent: "unknown", confidence: 0.8, answer: sqlResult, durationMs: Date.now() - startMs };
      }
    } catch (err) {
      console.warn("[NL Query] Text-to-SQL fallback failed:", (err as Error).message);
    }
    try {
      const res = await ollamaChat(
        "의료기기 유통 전문가. 간결 한국어 답변.",
        question,
        { maxTokens: 256, json: false },
      );
      return { question, intent, confidence, answer: res.text, durationMs: Date.now() - startMs };
    } catch {
      return { question, intent, confidence, answer: "일반 질문에 답변할 수 없습니다.", durationMs: Date.now() - startMs };
    }
  }

  // Step 2: Execute query
  const executor = QUERY_MAP[intent];
  if (!executor) {
    return { question, intent, confidence, answer: `'${intent}' 유형의 조회는 아직 지원하지 않습니다.`, durationMs: Date.now() - startMs };
  }

  let queryResult: unknown;
  try {
    queryResult = await executor(params);
  } catch (err) {
    return { question, intent, confidence, answer: `데이터 조회 중 오류: ${(err as Error).message}`, durationMs: Date.now() - startMs };
  }

  // Step 3: Format response
  // For simple queries, format directly without LLM (saves ~3s)
  const directAnswer = tryDirectFormat(intent, question, queryResult);
  if (directAnswer) {
    return { question, intent, confidence, answer: directAnswer, durationMs: Date.now() - startMs };
  }

  // Complex queries: generate natural language response via LLM
  try {
    const resultStr = JSON.stringify(queryResult, null, 2);
    const truncated = resultStr.length > 2000 ? resultStr.slice(0, 2000) + "\n..." : resultStr;
    const responsePrompt = `질문: ${question}\n의도: ${intent}\n결과:\n${truncated}`;
    const res = await ollamaChat(RESPONSE_SYSTEM_PROMPT, responsePrompt, { maxTokens: 512, json: false });
    return { question, intent, confidence, answer: res.text, durationMs: Date.now() - startMs };
  } catch {
    return { question, intent, confidence, answer: formatFallback(queryResult), durationMs: Date.now() - startMs };
  }
}

// ─── Text-to-SQL Fallback ────────────────────────

const DB_SCHEMA = `
테이블 구조 (PostgreSQL):

orders (주문): id, order_number(ORD-YYYYMMDD-NNN), order_date(date), hospital_id(FK→hospitals), status(confirmed=미완료/delivered=완료), total_items, total_amount, delivery_date, notes, source_message_id, created_at
order_items (주문품목): id, order_id(FK→orders), product_id, product_name, supplier_id(FK→suppliers), quantity, unit_type, unit_price(매출단가,VAT별도), purchase_price(매입단가,VAT별도), line_total, sales_rep, created_at
hospitals (거래처/병원): id, name, short_name, phone, address, contact_person, business_number, is_active, ceo_name
suppliers (공급사): id, name, short_name, phone, address, business_number, is_active, ceo_name
my_drugs (내 의약품): id, alias(별칭), item_name(품목명), entp_name(업체명), bar_code, edi_code, unit_price, material_name
my_devices (내 의료기기): id, alias(별칭), prdlst_nm(품목명), mnft_iprt_entp_nm(업체명), udidi_cd, unit_price, foml_info(모델명)
captured_messages (수신메시지): id, app_name, sender, content, received_at(bigint epoch ms), is_read, is_deleted, room_name, device_id
mobile_devices (모바일기기): id, device_name, device_model, app_version, os_version, is_active, last_sync_at, fcm_token
user_profiles (사용자): id, name, role(admin/viewer), is_active
partner_products (거래처품목): id, partner_type(hospital/supplier), partner_id, product_source(drug/device), product_id, unit_price
mfds_drugs (식약처 의약품 DB): id, item_name, entp_name, bar_code, item_permit_date
mfds_devices (식약처 의료기기 DB): id, prdlst_nm, mnft_iprt_entp_nm, udidi_cd, prmsn_ymd

주의: VAT포함 금액 = 단가 × 1.1. supply_amount는 NULL이므로 사용 금지. order_items에서 직접 계산.
captured_messages.received_at은 epoch milliseconds(bigint).
`;

const SQL_SYSTEM_PROMPT = `PostgreSQL 전문가. 사용자 질문을 읽고 SELECT SQL만 생성.
${DB_SCHEMA}
규칙:
- SELECT만 허용. INSERT/UPDATE/DELETE/DROP/ALTER 절대 금지.
- LIMIT 50 이하만 사용
- 금액 계산 시 VAT포함: ROUND(단가 * 1.1) * quantity
- JSON 출력: {"sql":"SELECT ...", "description":"설명"}
- 복잡한 질문이라도 반드시 SQL 생성. 생성 불가 시 {"sql":null,"description":"이유"}`;

async function executeTextToSQL(question: string): Promise<string | null> {
  // Step 1: Generate SQL
  const res = await ollamaChat(SQL_SYSTEM_PROMPT, question, { maxTokens: 512 });
  const cleaned = res.text.replace(/\`\`\`json\n?|\`\`\`\n?/g, "").trim();
  let parsed: { sql: string | null; description: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (!parsed.sql) return null;

  // Safety check: only SELECT allowed
  const sqlUpper = parsed.sql.trim().toUpperCase();
  if (!sqlUpper.startsWith("SELECT") || /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/.test(sqlUpper)) {
    console.warn("[Text-to-SQL] Blocked unsafe SQL:", parsed.sql);
    return null;
  }

  // Step 2: Execute SQL
  const sb = createAdminClient();
  const { data, error } = await sb.rpc("exec_readonly_sql", { query: parsed.sql });

  if (error) {
    // Fallback: try direct query via postgres function
    console.error("[Text-to-SQL] Execution error:", error.message);
    return `SQL 실행 오류: ${error.message}\n생성된 SQL: \`${parsed.sql}\``;
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return `${parsed.description}\n\n결과가 없습니다.`;
  }

  // Step 3: Format result with LLM
  const resultStr = JSON.stringify(data, null, 2);
  const truncated = resultStr.length > 3000 ? resultStr.slice(0, 3000) + "\n..." : resultStr;

  try {
    const fmtRes = await ollamaChat(
      "데이터 분석가. 한국어로 간결하게 답변. 숫자는 쉼표, 금액은 원 단위. 마크다운 사용 가능.",
      `질문: ${question}\n설명: ${parsed.description}\nSQL 결과:\n${truncated}`,
      { maxTokens: 512, json: false },
    );
    return fmtRes.text;
  } catch {
    // Raw format fallback
    return `${parsed.description}\n\n\`\`\`\n${truncated}\n\`\`\``;
  }
}

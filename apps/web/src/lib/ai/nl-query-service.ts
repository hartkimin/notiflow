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

const RESPONSE_SYSTEM_PROMPT = `의료물자 주문관리 어시스턴트. 한국어로 간결 답변. 숫자는 쉼표, 날짜는 한국식. draft=초안 confirmed=접수확인 delivered=배송완료 invoiced=정산완료. 표가 적합하면 마크다운 테이블.`;

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
    const name = escapeLikeValue(p.product_name as string);
    const [{ data: drugs }, { data: devices }] = await Promise.all([
      sb.from("my_drugs").select("id, item_name, bar_code, entp_name, unit_price").ilike("item_name", `%${name}%`).limit(5),
      sb.from("my_devices").select("id, prdlst_nm, udidi_cd, mnft_iprt_entp_nm, unit_price").ilike("prdlst_nm", `%${name}%`).limit(5),
    ]);
    return { drugs: drugs ?? [], devices: devices ?? [] };
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

  // General question (no DB)
  if (intent === "general_question" || intent === "unknown") {
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

  // Step 3: Generate natural language response
  try {
    const responsePrompt = `사용자 질문: ${question}\n조회 의도: ${intent}\n조회 결과:\n${JSON.stringify(queryResult, null, 2)}`;
    const res = await ollamaChat(RESPONSE_SYSTEM_PROMPT, responsePrompt, { maxTokens: 512, json: false });
    const answer = res.text;
    return { question, intent, confidence, answer, durationMs: Date.now() - startMs };
  } catch {
    // Fallback: return raw data
    return { question, intent, confidence, answer: `조회 결과:\n\`\`\`json\n${JSON.stringify(queryResult, null, 2)}\n\`\`\``, durationMs: Date.now() - startMs };
  }
}

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
  | "order_search_rag"
  | "general_question"
  | "unknown";

interface IntentResult {
  intent: NLQueryIntent;
  params: Record<string, string | number | null>;
  confidence: number;
}

// ─── Intent Classification Prompt ───────────────

const INTENT_SYSTEM_PROMPT = `당신은 NotiFlow 의료 물자 주문 관리 시스템의 질의 분류기입니다.

## 역할
사용자의 자연어 질문을 분석하여 의도를 분류하고 매개변수를 추출합니다.

## 의도 목록
- order_status: 주문 현황 (예: "이번 주 주문 현황", "미확인 주문")
- order_detail: 특정 주문 상세 (예: "ORD-20260321-001 상세")
- order_stats: 주문 통계 (예: "이번 달 총 주문 건수")
- product_search: 제품 검색 (예: "투석여과기 종류", "EK-15H 정보")
- product_stock: 제품 수량/주문량 (예: "니들 얼마나 주문했어", "이번 달 투석액 총 수량")
- hospital_info: 병원 정보 (예: "한국신장센터 연락처")
- hospital_orders: 병원별 주문 (예: "한국신장센터 주문 내역")
- supplier_info: 공급사 정보 (예: "대한메디칼 연락처")
- delivery_status: 배송 상태 (예: "오늘 배송 예정")
- sales_report: 매출 리포트 (예: "이번 달 매출 현황")
- profit_analysis: 이익/마진 분석 (예: "이번 달 이익률", "거래처별 마진", "영업담당자 실적")
- invoice_status: 세금계산서 현황 (예: "미발행 세금계산서", "이번 달 세금계산서")
- mfds_search: 식약처 품목 검색 (예: "식약처 투석여과기 검색", "의료기기 허가 정보")
- period_comparison: 기간 비교 (예: "지난달 대비 이번달 매출", "전월 비교")
- recent_messages: 최근 메시지 (예: "오늘 들어온 메시지")
- device_status: 모바일 기기 상태 (예: "연결된 기기", "기기 동기화 상태")
- user_list: 사용자/직원 목록 (예: "등록된 사용자", "관리자 목록")
- audit_log: 변경 이력/감사 로그 (예: "최근 변경 내역", "누가 수정했어")
- partner_products: 거래처 품목/alias (예: "한국신장센터 등록 품목", "거래처별 품목")
- kpis_report: KPIS 신고 현황 (예: "KPIS 신고 현황", "미신고 품목")
- order_comments: 주문 코멘트 (예: "최근 코멘트", "ORD-20260321-001 코멘트")
- order_search_rag: 주문 상세 검색/내용 질문 (예: "이번 주 투석액 90개 시킨 주문 찾아줘", "최근에 에이액 주문한 병원 어디야")
- general_question: DB 조회 불필요 (예: "혈액투석이 뭐야")
- unknown: 분류 불가

## 매개변수
- hospital_name: 병원명 (부분 매칭)
- supplier_name: 공급사명
- product_name: 제품명/약어
- order_number: 주문번호 (ORD-YYYYMMDD-###)
- invoice_number: 세금계산서번호
- query: RAG 검색어 (order_search_rag용)
- period: "today", "this_week", "this_month", "last_month"
- compare_period: 비교 기간 ("last_month", "last_year")
- status: "draft", "confirmed", "delivered", "invoiced"
- sales_rep: 영업담당자명
- limit: 조회 건수 (기본 10)

## 출력 (JSON만)
{"intent":"카테고리","params":{"필요한것만"},"confidence":0.0~1.0}`;

// ─── Response Generation Prompt ─────────────────

const RESPONSE_SYSTEM_PROMPT = `당신은 NotiFlow 의료 물자 주문 관리 시스템의 어시스턴트입니다.

## 규칙
1. 조회 결과가 없으면 가능한 원인을 설명
2. 숫자는 천단위 쉼표 (예: 1,500,000원)
3. 날짜는 한국식 (예: 2026년 3월 21일)
4. 주문 상태: draft→초안, confirmed→접수확인, delivered→배송완료, invoiced→정산완료
5. 간결하게 핵심만, 표가 적합하면 마크다운 테이블 사용
6. 추가 질문이 필요하면 유도`;

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

  order_search_rag: async (p) => {
    const { generateEmbedding } = await import("./embedding-service");
    const queryStr = (p.query as string) || (p._original_question as string);
    if (!queryStr) return { error: "검색어가 없습니다." };
    
    const { embedding } = await generateEmbedding(queryStr);
    const sb = createAdminClient();
    
    // Parallel RAG search across orders, products, and partners
    const [orders, products, partners] = await Promise.all([
      sb.rpc("match_orders", { query_embedding: embedding, match_threshold: 0.3, match_count: 3 }),
      sb.rpc("match_products_rag", { query_embedding: embedding, match_threshold: 0.3, match_count: 3 }),
      sb.rpc("match_partners_rag", { query_embedding: embedding, match_threshold: 0.3, match_count: 3 }),
    ]);

    return {
      relevant_orders: orders.data || [],
      relevant_products: products.data || [],
      relevant_partners: partners.data || [],
    };
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
    const res = await ollamaChat(INTENT_SYSTEM_PROMPT, question);
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
  // Inject original question for RAG fallback
  params._original_question = question;

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
        "당신은 의료기기 유통 전문가입니다. 간결하게 한국어로 답변하세요.",
        question,
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
    const res = await ollamaChat(RESPONSE_SYSTEM_PROMPT, responsePrompt, { maxTokens: 2048 });
    // Strip JSON wrapper if Ollama returns it
    let answer = res.text;
    try { const parsed = JSON.parse(answer); answer = parsed.response ?? parsed.answer ?? answer; } catch { /* not JSON, use as-is */ }
    return { question, intent, confidence, answer, durationMs: Date.now() - startMs };
  } catch {
    // Fallback: return raw data
    return { question, intent, confidence, answer: `조회 결과:\n\`\`\`json\n${JSON.stringify(queryResult, null, 2)}\n\`\`\``, durationMs: Date.now() - startMs };
  }
}

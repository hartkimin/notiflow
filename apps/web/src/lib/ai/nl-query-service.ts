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
  | "recent_messages"
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
- recent_messages: 최근 메시지 (예: "오늘 들어온 메시지")
- general_question: DB 조회 불필요 (예: "혈액투석이 뭐야")
- unknown: 분류 불가

## 매개변수
- hospital_name: 병원명 (부분 매칭)
- supplier_name: 공급사명
- product_name: 제품명/약어
- order_number: 주문번호 (ORD-YYYYMMDD-###)
- period: "today", "this_week", "this_month", "last_month"
- status: "draft", "confirmed", "delivered", "invoiced"
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

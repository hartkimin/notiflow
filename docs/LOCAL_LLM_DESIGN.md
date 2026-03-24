# NotiFlow 로컬 LLM 통합 설계서

> 문서 버전: 1.0
> 작성일: 2026-03-21
> 대상 모델: Qwen 3.5 9B (Q4_K_M 양자화)
> 실행 환경: Mac Mini M4 16GB
> 대상 시스템: NotiFlow (의료 물자 주문 알림 관리 시스템)

---

## 1. 설계 목적

이 문서는 NotiFlow 시스템에 로컬 LLM(Qwen 3.5 9B)을 통합하기 위한 설계서이다.
AI가 이 문서를 읽고 구현 범위, 입출력 스펙, 데이터 구조를 정확히 이해할 수 있도록 작성되었다.

### 1.1 도입 배경

| 항목 | 현재 (Cloud API) | 목표 (로컬 LLM) |
|------|-----------------|----------------|
| AI 프로바이더 | Anthropic Claude API | Qwen 3.5 9B (Ollama) |
| 실행 위치 | Anthropic 서버 | Mac Mini M4 (로컬) |
| 비용 | 메시지당 ~$0.003~0.01 | 전기세만 (월 ~$5) |
| 네트워크 의존성 | 필수 | 불필요 |
| 응답 속도 | 1~3초 (네트워크 포함) | 1~3초 (추론만) |
| 데이터 프라이버시 | 외부 전송 | 로컬 처리 |

### 1.2 두 가지 핵심 기능

| ID | 기능 | 설명 |
|----|------|------|
| F1 | **메시지 파싱 → 주문서 자동 생성** | 수신 메시지에서 품목/수량/단위를 추출하고 DB의 제품·거래처·공급사와 매칭하여 주문서를 생성 |
| F2 | **자연어 DB 조회** | 사용자가 자연어로 질문하면 DB를 조회하여 자연스러운 한국어로 응답 |

---

## 2. 하드웨어 및 인프라

### 2.1 실행 환경

```
Mac Mini M4 (16GB Unified Memory)
├── Ollama (추론 서버) ── localhost:11434
│   └── qwen3.5:9b-q4_K_M (~5.5GB VRAM)
│
├── NotiFlow Web (Next.js) ── localhost:3000 또는 Vercel
│   └── ai-client.ts → Ollama API 호출
│
└── Supabase ── localhost:54321 또는 Cloud
    └── PostgreSQL (orders, products, hospitals, suppliers ...)
```

### 2.2 메모리 예산

| 구성 요소 | 예상 메모리 |
|-----------|-----------|
| macOS 시스템 | ~3GB |
| Qwen 3.5 9B (Q4_K_M) | ~5.5GB |
| KV 캐시 (4K 컨텍스트) | ~0.5GB |
| Ollama 오버헤드 | ~0.5GB |
| NotiFlow 앱 | ~1GB |
| **여유 공간** | **~5GB** |

### 2.3 Ollama 설정

```bash
# 설치
brew install ollama

# 모델 다운로드
ollama pull qwen3.5:9b

# 서버 시작 (백그라운드)
ollama serve &

# 테스트
curl http://localhost:11434/api/generate \
  -d '{"model": "qwen3.5:9b", "prompt": "hello", "stream": false}'
```

---

## 3. 기능 F1: 메시지 파싱 → 주문서 자동 생성

### 3.1 전체 흐름

```
Android 앱 (SMS/알림 수집)
        ↓
Supabase Realtime → captured_messages 테이블 INSERT
        ↓
Next.js Server Action (parseMessageCore)
        ↓
┌─────────────────────────────────────┐
│         파싱 파이프라인               │
│                                     │
│  1단계: Qwen 3.5 9B (로컬 LLM)      │
│    - 메시지 텍스트 입력              │
│    - 병원별 alias + 제품 카탈로그 참조│
│    - JSON 구조화 출력                │
│         ↓                           │
│  confidence ≥ 0.7 → 다음 단계       │
│  confidence < 0.7 → 2단계로         │
│                                     │
│  2단계: regex fallback (parser.ts)  │
│    - LINE_PATTERN, REVERSED_PATTERN │
│    - INLINE_PATTERN, STANDALONE     │
│         ↓                           │
│  matchProductsBulk()                │
│    - 7단계 제품 매칭                 │
│         ↓                           │
│  generateOrderNumber()              │
│    - ORD-YYYYMMDD-### 형식          │
└─────────────────────────────────────┘
        ↓
orders + order_items 테이블 INSERT
```

### 3.2 입력 데이터 스펙

#### 3.2.1 수신 메시지 (captured_messages 테이블)

```sql
-- 실제 입력되는 메시지 예시
-- source_app: 'kakaotalk', 'sms', '네이버' 등
-- sender: 병원명 또는 담당자명
-- content: 주문 내용 (자유형식 한국어 텍스트)
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | SERIAL | 메시지 ID |
| `source_app` | VARCHAR(50) | 수신 앱 (kakaotalk, sms 등) |
| `sender` | VARCHAR(255) | 발신자 (병원명 등) |
| `content` | TEXT | 메시지 본문 |
| `received_at` | TIMESTAMPTZ | 수신 시각 |
| `hospital_id` | INT (FK) | 매칭된 병원 ID |

#### 3.2.2 실제 메시지 예시

```
[예시 1 - 일반 주문]
"EK15 10박스 니들 50개"

[예시 2 - 약어 사용]
"b 20 G 20"

[예시 3 - 역순 표기]
"20개 A타입 니들"

[예시 4 - 복합 주문]
"A 5박스 B 20개 C 3팩"

[예시 5 - 단일 품목 (수량 생략)]
"니들"

[예시 6 - 비주문 메시지 (무시해야 함)]
"감사합니다 내일 뵙겠습니다"
```

#### 3.2.3 컨텍스트 데이터 (프롬프트에 포함)

**병원별 제품 alias 목록** — 각 병원이 사용하는 약어와 실제 제품명의 매핑:

```json
[
  { "alias": "EK15", "product_name": "혈액투석여과기 EK-15H" },
  { "alias": "니들", "product_name": "AVF NEEDLE 16G" },
  { "alias": "b", "product_name": "헤모시스비액 12.6L" },
  { "alias": "G", "product_name": "헤모시스에이지액 10L" },
  { "alias": "A타입 니들", "product_name": "AVF NEEDLE 17G" }
]
```

**제품 카탈로그** — products 테이블에서 조회:

```typescript
interface ProductCatalogEntry {
  id: number;
  name: string;           // "혈액투석여과기 EK-15H"
  official_name: string;  // "혈액투석여과기(EK-15H)"
  short_name: string;     // "EK-15H"
  standard_code: string;  // MFDS 표준코드
  source_type: string;    // "drug" | "device" | "manual"
}
```

### 3.3 LLM 출력 스펙

#### 3.3.1 요청 형식 (Ollama API)

```http
POST http://<mac-mini-ip>:11434/api/generate
Content-Type: application/json

{
  "model": "qwen3.5:9b",
  "system": "<system_prompt>",
  "prompt": "<user_prompt>",
  "format": "json",
  "stream": false,
  "options": {
    "temperature": 0.1,
    "num_predict": 1024
  }
}
```

#### 3.3.2 시스템 프롬프트 (system_prompt)

```
당신은 한국 혈액투석 의료기관의 주문 메시지를 분석하는 전문 파서입니다.

## 역할
수신된 텍스트 메시지에서 주문 품목(item), 수량(qty), 단위(unit)를 추출하고,
제공된 alias 목록과 제품 카탈로그를 참조하여 정확한 제품명(matched_product)을 매칭합니다.

## 규칙
1. alias 목록에 정확히 일치하는 항목이 있으면 해당 product_name을 matched_product로 설정
2. 수량이 명시되지 않은 경우 기본값 1
3. 단위가 명시되지 않은 경우 기본값 "piece"
4. 단위 변환: 박스/box/bx→"box", 개/ea→"piece", 봉/팩/pack→"pack", 세트/set→"set", 병→"bottle", 통/캔→"can", 매/장→"sheet", 롤→"roll"
5. 인사말, 질문, 일정 관련 메시지는 주문이 아님 → 빈 배열 반환
6. 비주문 판별 키워드: 감사, 안녕, 수고, 죄송, 네, 예, 좋, 확인, 알겠, 회의, 미팅, 연락, 전화, 문의, ?로 끝나는 문장

## 출력 형식
반드시 JSON 배열로만 응답하세요. 설명이나 마크다운 없이 순수 JSON만 출력합니다.

정상 주문:
[
  {
    "item": "원본 텍스트에서 추출한 품목명",
    "qty": 숫자,
    "unit": "box|piece|pack|set|bottle|can|sheet|roll",
    "matched_product": "매칭된 정식 제품명 또는 null"
  }
]

비주문 메시지:
[]
```

#### 3.3.3 사용자 프롬프트 (user_prompt) 템플릿

```
## 병원 정보
병원명: {hospital_name}

## 이 병원의 제품 alias 목록
{alias_list_json}

## 등록된 제품 카탈로그
{product_catalog_json}

## 분석할 메시지
{message_content}
```

#### 3.3.4 기대 출력 (ParsedItem[])

```typescript
// 입력: "EK15 10박스 니들 50개"
// alias: [{"alias":"EK15","product_name":"혈액투석여과기 EK-15H"},{"alias":"니들","product_name":"AVF NEEDLE 16G"}]

// 기대 출력:
[
  {
    "item": "EK15",
    "qty": 10,
    "unit": "box",
    "matched_product": "혈액투석여과기 EK-15H"
  },
  {
    "item": "니들",
    "qty": 50,
    "unit": "piece",
    "matched_product": "AVF NEEDLE 16G"
  }
]
```

### 3.4 파싱 후 처리 파이프라인

LLM이 JSON을 출력한 후, 기존 NotiFlow 로직이 수행하는 후속 처리:

```
LLM 출력 (ParsedItem[])
        ↓
matchProductsBulk(supabase, items, products)
  │
  ├── Level 1: matched_product로 exact match
  ├── Level 2: item 텍스트로 product.name exact match
  ├── Level 3: item 텍스트로 product.short_name exact match
  ├── Level 4: item 텍스트로 product.name ILIKE match
  ├── Level 5: item 텍스트로 product.official_name ILIKE match
  ├── Level 6: trigram similarity (pg_trgm)
  └── Level 7: unmatched → match_status = 'review'
        ↓
generateOrderNumber(supabase, orderDate)
  → "ORD-20260321-001" 형식
        ↓
orders 테이블 INSERT
  → hospital_id, order_date, status='draft', source_message_id
        ↓
order_items 테이블 INSERT (각 품목별)
  → product_id, quantity, unit_type, original_text, match_status, match_confidence
```

### 3.5 구현: ai-client.ts 확장

```typescript
// === 추가할 Ollama 프로바이더 ===

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

async function callOllama(
  model: string,
  prompt: string,
): Promise<AICallResult> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,              // "qwen3.5:9b"
      prompt,
      format: "json",
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 1024,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    text: data.response ?? "",
    inputTokens: data.prompt_eval_count ?? 0,
    outputTokens: data.eval_count ?? 0,
  };
}

async function callOllamaStructured(
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<AIStructuredResult> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      format: "json",
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 1024,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data.message?.content ?? "";
  const parsed = JSON.parse(text);

  return {
    parsed,
    inputTokens: data.prompt_eval_count ?? 0,
    outputTokens: data.eval_count ?? 0,
  };
}
```

### 3.6 설정 확장 (settings 테이블)

```sql
-- 기존 ai_provider 선택지에 'ollama' 추가
-- settings 테이블의 key-value 쌍

INSERT INTO settings (key, value) VALUES
  ('ai_provider', '"ollama"'),
  ('ai_model', '"qwen3.5:9b"'),
  ('ollama_base_url', '"http://192.168.x.x:11434"');
```

```typescript
// settings.ts의 AIProvider 타입 확장
export type AIProvider = "anthropic" | "google" | "openai" | "ollama";
```

### 3.7 환경변수

```env
# .env.local에 추가
OLLAMA_BASE_URL=http://192.168.x.x:11434   # Mac Mini의 로컬 IP
OLLAMA_MODEL=qwen3.5:9b                     # 기본 모델명
```

---

## 4. 기능 F2: 자연어 DB 조회

### 4.1 설계 방식: 의도 분류 + 쿼리 템플릿 + 자연어 응답

Text-to-SQL 방식 대신, 안전하고 예측 가능한 **의도 분류(Intent Classification) → 매개변수 추출 → 사전 정의 쿼리 실행 → 자연어 응답 생성** 파이프라인을 채택한다.

```
사용자 질문 (자연어)
        ↓
┌─────────────────────────────────┐
│  Qwen 3.5 9B — 1차 분석         │
│                                 │
│  입력: 사용자 질문               │
│  출력: {                        │
│    "intent": "의도 카테고리",     │
│    "params": { 추출된 매개변수 }, │
│    "confidence": 0.0~1.0        │
│  }                              │
└─────────────────────────────────┘
        ↓
의도별 사전 정의 Supabase 쿼리 실행
        ↓
┌─────────────────────────────────┐
│  Qwen 3.5 9B — 2차 응답 생성    │
│                                 │
│  입력: 원래 질문 + 쿼리 결과     │
│  출력: 자연스러운 한국어 응답     │
└─────────────────────────────────┘
        ↓
사용자에게 응답 전달
```

### 4.2 의도(Intent) 목록

```typescript
type NLQueryIntent =
  | "order_status"        // 주문 현황 조회
  | "order_detail"        // 특정 주문 상세
  | "order_stats"         // 주문 통계 (기간별)
  | "product_search"      // 제품 검색/정보
  | "product_stock"       // 제품 수량/재고 관련
  | "hospital_info"       // 병원/거래처 정보
  | "hospital_orders"     // 특정 병원의 주문 내역
  | "supplier_info"       // 공급사 정보
  | "delivery_status"     // 배송 상태
  | "sales_report"        // 매출/매입 리포트
  | "recent_messages"     // 최근 수신 메시지
  | "general_question"    // 일반 질문 (DB 조회 불필요)
  | "unknown";            // 분류 불가
```

### 4.3 의도 분류용 시스템 프롬프트

```
당신은 NotiFlow 의료 물자 주문 관리 시스템의 질의 분류기입니다.

## 역할
사용자의 자연어 질문을 분석하여, 어떤 종류의 데이터베이스 조회가 필요한지 분류하고,
조회에 필요한 매개변수를 추출합니다.

## 사용 가능한 의도 목록
- order_status: 주문 현황 (예: "이번 주 주문 현황", "미확인 주문")
- order_detail: 특정 주문 상세 (예: "ORD-20260321-001 상세")
- order_stats: 주문 통계 (예: "이번 달 총 주문 건수", "월별 주문 추이")
- product_search: 제품 검색 (예: "투석여과기 종류", "EK-15H 정보")
- product_stock: 제품 수량 (예: "니들 얼마나 주문했어")
- hospital_info: 병원 정보 (예: "한국신장센터 연락처")
- hospital_orders: 병원별 주문 (예: "한국신장센터 주문 내역")
- supplier_info: 공급사 정보 (예: "대한메디칼 연락처")
- delivery_status: 배송 상태 (예: "오늘 배송 예정")
- sales_report: 매출 리포트 (예: "이번 달 매출 현황")
- recent_messages: 최근 메시지 (예: "오늘 들어온 메시지")
- general_question: DB 조회 불필요 (예: "혈액투석이 뭐야")
- unknown: 분류 불가

## 매개변수 추출 규칙
- hospital_name: 병원/거래처명 (부분 매칭 가능)
- supplier_name: 공급사명
- product_name: 제품명 또는 약어
- order_number: 주문번호 (ORD-YYYYMMDD-### 형식)
- date_from: 시작일 (ISO 8601, 없으면 null)
- date_to: 종료일 (ISO 8601, 없으면 null)
- period: 기간 키워드 ("today", "this_week", "this_month", "last_month")
- status: 주문 상태 ("draft", "confirmed", "delivered", "invoiced")
- limit: 조회 건수 (기본 10)

## 출력 형식 (JSON)
{
  "intent": "의도 카테고리",
  "params": {
    "필요한 매개변수만 포함"
  },
  "confidence": 0.0~1.0
}
```

### 4.4 의도별 매핑 예시

```
질문: "이번 주 한국신장센터 주문 현황 알려줘"
→ {
    "intent": "hospital_orders",
    "params": {
      "hospital_name": "한국신장센터",
      "period": "this_week"
    },
    "confidence": 0.95
  }

질문: "ORD-20260320-003 상세 내역"
→ {
    "intent": "order_detail",
    "params": {
      "order_number": "ORD-20260320-003"
    },
    "confidence": 0.98
  }

질문: "오늘 배송 나갈 건 뭐 있어?"
→ {
    "intent": "delivery_status",
    "params": {
      "period": "today"
    },
    "confidence": 0.92
  }

질문: "이번 달 투석액 총 주문 수량"
→ {
    "intent": "product_stock",
    "params": {
      "product_name": "투석액",
      "period": "this_month"
    },
    "confidence": 0.88
  }
```

### 4.5 의도별 쿼리 템플릿

```typescript
// nl-query-service.ts (신규 모듈)

interface QueryTemplate {
  intent: NLQueryIntent;
  execute: (supabase: SupabaseClient, params: Record<string, unknown>) => Promise<unknown>;
}

const QUERY_TEMPLATES: QueryTemplate[] = [

  // ── 주문 현황 ──
  {
    intent: "order_status",
    execute: async (supabase, params) => {
      const { dateFrom, dateTo } = resolvePeriod(params.period as string);
      let query = supabase
        .from("orders")
        .select("id, order_number, order_date, status, total_items, total_amount, hospitals(name)")
        .gte("order_date", dateFrom)
        .lte("order_date", dateTo)
        .order("order_date", { ascending: false })
        .limit(Number(params.limit ?? 20));

      if (params.status) query = query.eq("status", params.status);
      return (await query).data;
    },
  },

  // ── 특정 주문 상세 ──
  {
    intent: "order_detail",
    execute: async (supabase, params) => {
      const { data: order } = await supabase
        .from("orders")
        .select(`
          *, hospitals(name, phone, address),
          order_items(
            *, products(name, official_name),
            suppliers(name)
          )
        `)
        .eq("order_number", params.order_number)
        .single();
      return order;
    },
  },

  // ── 병원별 주문 내역 ──
  {
    intent: "hospital_orders",
    execute: async (supabase, params) => {
      const { dateFrom, dateTo } = resolvePeriod(params.period as string);

      // 병원명으로 hospital_id 검색
      const { data: hospitals } = await supabase
        .from("hospitals")
        .select("id, name")
        .ilike("name", `%${params.hospital_name}%`)
        .limit(1);

      if (!hospitals?.length) return { error: "병원을 찾을 수 없습니다", hospital_name: params.hospital_name };

      const hospitalId = hospitals[0].id;
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, order_date, status, total_items, total_amount")
        .eq("hospital_id", hospitalId)
        .gte("order_date", dateFrom)
        .lte("order_date", dateTo)
        .order("order_date", { ascending: false });

      return { hospital: hospitals[0], orders };
    },
  },

  // ── 제품 검색 ──
  {
    intent: "product_search",
    execute: async (supabase, params) => {
      const { data } = await supabase
        .from("products")
        .select("id, name, official_name, category, manufacturer, unit, unit_price, standard_code")
        .or(`name.ilike.%${params.product_name}%,official_name.ilike.%${params.product_name}%,short_name.ilike.%${params.product_name}%`)
        .eq("is_active", true)
        .limit(10);
      return data;
    },
  },

  // ── 배송 상태 ──
  {
    intent: "delivery_status",
    execute: async (supabase, params) => {
      const { dateFrom, dateTo } = resolvePeriod(params.period as string);
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, order_date, delivery_date, status, hospitals(name), total_items")
        .gte("delivery_date", dateFrom)
        .lte("delivery_date", dateTo)
        .in("status", ["confirmed", "delivered"])
        .order("delivery_date", { ascending: true });
      return data;
    },
  },

  // ── 최근 수신 메시지 ──
  {
    intent: "recent_messages",
    execute: async (supabase, params) => {
      const { data } = await supabase
        .from("captured_messages")
        .select("id, source_app, sender, content, received_at, hospital_id")
        .order("received_at", { ascending: false })
        .limit(Number(params.limit ?? 10));
      return data;
    },
  },

  // ── 병원 정보 ──
  {
    intent: "hospital_info",
    execute: async (supabase, params) => {
      const { data } = await supabase
        .from("hospitals")
        .select("*")
        .ilike("name", `%${params.hospital_name}%`)
        .limit(5);
      return data;
    },
  },

  // ── 공급사 정보 ──
  {
    intent: "supplier_info",
    execute: async (supabase, params) => {
      const { data } = await supabase
        .from("suppliers")
        .select("*")
        .ilike("name", `%${params.supplier_name}%`)
        .limit(5);
      return data;
    },
  },

  // ── 매출 리포트 ──
  {
    intent: "sales_report",
    execute: async (supabase, params) => {
      const { dateFrom, dateTo } = resolvePeriod(params.period as string);
      const { data } = await supabase
        .from("orders")
        .select("status, total_amount, supply_amount, tax_amount")
        .gte("order_date", dateFrom)
        .lte("order_date", dateTo);

      const summary = {
        total_orders: data?.length ?? 0,
        total_amount: data?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
        supply_amount: data?.reduce((sum, o) => sum + (Number(o.supply_amount) || 0), 0),
        tax_amount: data?.reduce((sum, o) => sum + (Number(o.tax_amount) || 0), 0),
        by_status: Object.groupBy(data ?? [], (o) => o.status),
      };
      return summary;
    },
  },
];

// ── 기간 해석 유틸리티 ──
function resolvePeriod(period?: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  switch (period) {
    case "today":
      return { dateFrom: today, dateTo: today };
    case "this_week": {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      return { dateFrom: weekStart.toISOString().split("T")[0], dateTo: today };
    }
    case "this_month": {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      return { dateFrom: monthStart, dateTo: today };
    }
    case "last_month": {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        dateFrom: lastMonth.toISOString().split("T")[0],
        dateTo: lastMonthEnd.toISOString().split("T")[0],
      };
    }
    default:
      return { dateFrom: `${now.getFullYear()}-01-01`, dateTo: today };
  }
}
```

### 4.6 자연어 응답 생성 프롬프트

```
당신은 NotiFlow 의료 물자 주문 관리 시스템의 어시스턴트입니다.

## 역할
데이터베이스 조회 결과를 받아 사용자에게 자연스러운 한국어로 답변합니다.

## 규칙
1. 조회 결과가 없으면 "조회 결과가 없습니다"가 아니라, 가능한 원인을 설명 (예: "해당 기간에 주문 내역이 없네요. 기간을 넓혀서 다시 확인해볼까요?")
2. 숫자는 천단위 쉼표 사용 (예: 1,500,000원)
3. 날짜는 한국식 표기 (예: 2026년 3월 21일)
4. 주문 상태는 한국어 표기 (draft→초안, confirmed→확정, delivered→배송완료, invoiced→세금계산서발행)
5. 간결하게 핵심만 전달하고, 추가 질문이 필요하면 유도
6. 표 형태가 적합한 경우 마크다운 테이블 사용

## 입력
사용자 질문: {user_question}
조회 의도: {intent}
조회 결과:
{query_result_json}

## 출력
자연스러운 한국어 응답 (마크다운 허용)
```

### 4.7 응답 예시

```
질문: "이번 주 한국신장센터 주문 현황 알려줘"

응답:
이번 주(3/17~3/21) 한국신장센터의 주문 현황입니다:

| 주문번호 | 주문일 | 상태 | 품목수 | 금액 |
|---------|--------|------|--------|------|
| ORD-20260317-002 | 3월 17일 | 확정 | 5 | 2,350,000원 |
| ORD-20260319-001 | 3월 19일 | 초안 | 3 | 1,200,000원 |
| ORD-20260321-003 | 3월 21일 | 초안 | 2 | 850,000원 |

총 3건, 합계 4,400,000원입니다. 초안 상태인 2건의 확정 처리가 필요합니다.
```

### 4.8 접근 인터페이스

자연어 조회 기능은 다음 경로로 접근 가능하도록 설계:

| 인터페이스 | 경로 | 설명 |
|-----------|------|------|
| 웹 대시보드 | `/dashboard` (챗봇 위젯) | 대시보드 하단 또는 사이드바에 채팅 UI |
| API 엔드포인트 | `POST /api/nl-query` | 외부 연동용 REST API |
| Telegram 채널 | Claude Code Channels 연동 | 모바일에서 자연어 질의 |

---

## 5. 데이터베이스 스키마 요약

F1, F2 기능에서 사용하는 핵심 테이블 관계:

```
hospitals (거래처/병원)
  ├── 1:N → orders (주문)
  │         ├── 1:N → order_items (주문 항목)
  │         │         ├── N:1 → products (제품)
  │         │         └── N:1 → suppliers (공급사)
  │         └── N:1 → captured_messages (원본 메시지)
  └── 1:N → hospital_products (병원별 취급 제품)

products (제품)
  ├── 1:N → product_aliases (제품 약어)
  ├── 1:N → product_suppliers (제품-공급사 매핑)
  └── 1:N → product_box_specs (박스 규격)

suppliers (공급사)
  └── 1:N → product_suppliers

settings (시스템 설정)
  └── ai_provider, ai_model, ollama_base_url 등

captured_messages (수신 메시지)
  └── Android 앱에서 수집된 SMS/알림
```

---

## 6. 에러 처리 및 폴백

### 6.1 F1 (메시지 파싱) 폴백 체인

```
1차: Qwen 3.5 9B (Ollama 로컬)
  ↓ 실패 시 (Ollama 서버 다운, 타임아웃 10초)
2차: Claude API (기존 클라우드)
  ↓ 실패 시 (API 키 없음, 할당량 초과)
3차: regex fallback (parser.ts)
  → 항상 동작 보장
```

```typescript
// parse-service.ts 수정 로직
async function aiParse(content, settings, ...args): Promise<ParseResult> {
  // 1차: Ollama 시도
  if (settings.ai_provider === "ollama") {
    try {
      const result = await callOllamaStructured(settings.ai_model, system, user);
      if (result.parsed && Array.isArray(result.parsed)) {
        return { items: result.parsed, method: "llm", ai_provider: "ollama", ... };
      }
    } catch (e) {
      console.warn("[aiParse] Ollama failed, falling back:", e.message);
      // 2차: Claude API 폴백 시도
      if (settings.fallback_api_key) {
        try {
          return await callClaudeStructured(...);
        } catch {}
      }
    }
  }

  // 3차: regex
  return { items: regexParse(content), method: "regex", ... };
}
```

### 6.2 F2 (자연어 조회) 에러 처리

```
의도 분류 실패 (confidence < 0.5)
  → "질문을 좀 더 구체적으로 해주시겠어요? 예: '이번 주 ○○병원 주문 현황'"

쿼리 실행 실패
  → "데이터 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."

Ollama 서버 다운
  → "AI 서버에 연결할 수 없습니다. 대시보드에서 직접 확인해주세요."
  → 대시보드 해당 페이지 링크 제공
```

---

## 7. 성능 기대치

| 지표 | F1 (메시지 파싱) | F2 (자연어 조회) |
|------|:---:|:---:|
| 입력 토큰 (평균) | ~500 (프롬프트+컨텍스트) | ~300 (질문+시스템) + ~500 (응답 생성) |
| 출력 토큰 (평균) | ~100 | ~200 |
| 추론 시간 (예상) | 1~3초 | 2~5초 (2회 호출) |
| 동시 처리 | 순차 (1건씩) | 순차 (1건씩) |
| 일일 처리량 (예상) | ~500건 충분 | ~200건 충분 |

---

## 8. 보안 고려사항

| 항목 | 대책 |
|------|------|
| 데이터 프라이버시 | 모든 데이터가 로컬에서 처리됨. 외부 전송 없음 |
| SQL 인젝션 (F2) | Text-to-SQL 미사용. 사전 정의 쿼리 + 파라미터 바인딩만 사용 |
| Ollama 접근 제어 | localhost 바인딩 또는 내부 네트워크로 제한 |
| 프롬프트 인젝션 | 사용자 입력과 시스템 프롬프트를 명확히 분리 |
| API 키 관리 | 폴백용 클라우드 API 키는 settings 테이블에 암호화 저장 |

---

## 9. 테스트 전략

### 9.1 F1 정확도 벤치마크

```bash
# 기존 파싱 결과(Claude API)와 Qwen 로컬 결과를 비교하는 테스트
# parse_history 테이블의 기존 데이터를 활용

1. parse_history에서 최근 100건의 input_text + parsed_items 추출
2. 동일 input_text를 Qwen 3.5 9B에 전달
3. 기존 parsed_items와 Qwen 출력을 필드별 비교
4. 정확도 지표 산출:
   - item 추출 정확도 (exact match)
   - qty 정확도
   - unit 정확도
   - matched_product 정확도
5. 목표: 전체 정확도 ≥ 90%, matched_product 정확도 ≥ 85%
```

### 9.2 F2 의도 분류 테스트

```typescript
const TEST_CASES = [
  { question: "이번 주 주문 현황", expected_intent: "order_status" },
  { question: "한국신장센터 연락처", expected_intent: "hospital_info" },
  { question: "ORD-20260321-001 상세", expected_intent: "order_detail" },
  { question: "오늘 배송 예정인 거", expected_intent: "delivery_status" },
  { question: "투석액 정보 알려줘", expected_intent: "product_search" },
  { question: "감사합니다", expected_intent: "general_question" },
  // ... 최소 30건 이상
];

// 목표: 의도 분류 정확도 ≥ 90%
```

---

## 10. 구현 로드맵

| 단계 | 기간 | 내용 |
|------|------|------|
| **Phase 1** | 1~2일 | Mac Mini에 Ollama + Qwen 3.5 설치, API 연결 테스트 |
| **Phase 2** | 3~5일 | ai-client.ts에 Ollama 프로바이더 추가, F1 파싱 파이프라인 연동 |
| **Phase 3** | 1주 | 100건 벤치마크, 프롬프트 튜닝, 폴백 로직 구현 |
| **Phase 4** | 1~2주 | F2 자연어 조회 모듈 (nl-query-service.ts) 개발 |
| **Phase 5** | 1주 | 대시보드 채팅 UI, Telegram 채널 연동 |
| **Phase 6** | 지속 | 정확도 모니터링, 프롬프트 개선, 의도 추가 |

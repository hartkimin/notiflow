# 벡터 임베딩 AI 파이프라인 설계

**날짜:** 2026-03-22
**상태:** 승인됨
**대상 버전:** v0.3.0

---

## 개요

NotiFlow의 SMS 파싱 정확도와 제품 매칭률을 높이기 위해 두 가지 AI 기능을 동시에 구축한다.

1. **pgvector 벡터 임베딩 검색** — 의미 유사도 기반 제품 매칭 (동의어·약어·오타 처리)
2. **Few-shot 파이프라인** — 누적된 파싱 성공 케이스를 LLM 프롬프트에 자동 주입

기존 파이프라인 구조(Ollama → Claude → Regex 폴백)를 유지하면서 각 단계에 임베딩 레이어를 추가하는 **레이어드 접근**을 채택한다.

---

## 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 임베딩 모델 | Gemini Embedding 2 → Ollama 폴백 | 최고 품질 + 장애 내성. 기존 파이프라인 폴백 패턴과 일치 |
| 통일 차원 | 768 | Gemini 2 MRL truncation = Ollama nomic-embed-text. 단일 컬럼 저장 가능 |
| 임베딩 대상 | 4개 테이블 전체 | mfds_items, products, hospitals, captured_messages |
| 아키텍처 | 레이어드 파이프라인 | 기존 코드 최소 변경, 단계적 배포 가능, 롤백 쉬움 |

---

## 전체 데이터 흐름

### 파싱 파이프라인 (Few-shot 강화)

```
SMS 수신
  → embedding-service: SMS 임베딩 생성 (Gemini2 → Ollama 폴백)
  → vector-search: captured_messages에서 유사 케이스 top-3 검색
  → LLM 파싱: few-shot 예시 주입 후 호출 (Ollama → Claude → Regex)
  → 파싱 결과 (items + confidence)
  → captured_messages 저장 + 임베딩 생성 (신뢰도 ≥ 0.7인 경우)
```

### 제품 매칭 파이프라인 (벡터 강화)

```
파싱 결과 품목명
  → L1: matched_product 정확 매칭 (confidence 0.95)
  → L2: 품목명 → product.name 정확 매칭 (0.90)
  → L3: 품목명 → product.code 정확 매칭 (0.85)
  → L4: 품목명 부분 포함 매칭 (0.70)
  → L5: matched_product 부분 포함 매칭 (0.65)
  → L6: 벡터 유사도 검색 (products + mfds_items) ← trigram 대체
  → L7: 미매칭
```

---

## DB 변경

### 마이그레이션: `00064_pgvector_embeddings.sql`

```sql
-- pgvector 확장
CREATE EXTENSION IF NOT EXISTS vector;

-- 4개 테이블에 공통 컬럼 추가
ALTER TABLE mfds_items
  ADD COLUMN embedding vector(768),
  ADD COLUMN embedding_model text,
  ADD COLUMN embedded_at timestamptz;

ALTER TABLE my_drugs
  ADD COLUMN embedding vector(768),
  ADD COLUMN embedding_model text,
  ADD COLUMN embedded_at timestamptz;

ALTER TABLE my_devices
  ADD COLUMN embedding vector(768),
  ADD COLUMN embedding_model text,
  ADD COLUMN embedded_at timestamptz;

ALTER TABLE hospitals
  ADD COLUMN embedding vector(768),
  ADD COLUMN embedding_model text,
  ADD COLUMN embedded_at timestamptz;

ALTER TABLE captured_messages
  ADD COLUMN embedding vector(768),
  ADD COLUMN embedding_model text,
  ADD COLUMN embedded_at timestamptz;

-- IVFFlat 인덱스 (코사인 유사도)
CREATE INDEX ON mfds_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON my_drugs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
CREATE INDEX ON my_devices USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
CREATE INDEX ON hospitals USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
CREATE INDEX ON captured_messages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
```

### 차원 통일 전략

- **Gemini Embedding 2** (`gemini-embedding-2-preview`): MRL로 768차원 truncation 설정
- **Ollama** (`nomic-embed-text`): 기본 768차원
- 두 모델 모두 동일한 `vector(768)` 컬럼에 저장. `embedding_model` 컬럼으로 출처 기록.

---

## 새 파일 구조

```
apps/web/src/lib/ai/
├── embedding-service.ts     # 신규: Gemini2 → Ollama 폴백 임베딩 생성
├── vector-search.ts         # 신규: pgvector 유사도 검색 (테이블별)
├── match-products.ts        # 수정: L6 trigram → vector-search 교체
└── parse-message.ts         # 수정: few-shot 예시 주입 로직 추가

apps/web/src/app/api/
└── embed-batch/
    └── route.ts             # 신규: mfds_items 배치 임베딩 트리거 API

packages/supabase/migrations/
└── 00064_pgvector_embeddings.sql  # 신규
```

---

## 각 파일 상세 설계

### `embedding-service.ts`

```typescript
interface EmbeddingResult {
  embedding: number[];   // 768차원
  model: string;         // "gemini-embedding-2-preview" | "nomic-embed-text"
}

async function generateEmbedding(text: string): Promise<EmbeddingResult>
async function generateEmbeddingsBulk(texts: string[]): Promise<EmbeddingResult[]>
```

- Gemini API 키 없거나 오류 시 Ollama `/api/embeddings`로 자동 폴백
- Gemini 2 호출 시 `outputDimensionality: 768` 파라미터로 MRL truncation 적용
- rate limit 대비 재시도 로직 (3회, exponential backoff)

### `vector-search.ts`

```typescript
interface VectorMatch {
  id: number;
  name: string;
  similarity: number;   // 0.0 ~ 1.0
  source: "product" | "mfds";
}

// 제품 매칭용
async function searchProducts(
  embedding: number[],
  limit?: number,        // default: 5
  threshold?: number     // default: 0.6
): Promise<VectorMatch[]>

// Few-shot 예시 검색용
async function searchSimilarMessages(
  embedding: number[],
  hospitalId?: number,
  limit?: number         // default: 3
): Promise<CapturedMessage[]>

// 병원 매칭용
async function searchHospitals(
  embedding: number[],
  limit?: number
): Promise<HospitalMatch[]>
```

- Supabase RPC 함수로 구현 (`match_products`, `match_messages`, `match_hospitals`)
- 코사인 유사도 기준 정렬

### `match-products.ts` 수정

- L6 (trigram) 제거
- L6 자리에 `vector-search.searchProducts()` 삽입
- `similarity >= 0.6` → match_confidence로 변환
- 임베딩 생성은 호출 전 `embedding-service`에서 처리

### `parse-message.ts` 수정

```
기존: buildUserPrompt(hospitalName, aliases, catalog, content)
변경: 파싱 전 단계 추가

1. SMS 임베딩 생성 (embedding-service)
2. 유사 메시지 검색 (vector-search.searchSimilarMessages, top-3)
3. buildUserPromptWithFewShot(hospitalName, aliases, catalog, content, examples)
```

few-shot 예시 형식:
```
## 유사 주문 예시
[예시 1] "HD 비타민C 5개 부탁" → items: [{item: "비타민C 주사", qty: 5, unit: "piece"}]
[예시 2] ...
```

### `embed-batch/route.ts`

- `GET /api/embed-batch?table=mfds_items&offset=0&limit=100` 형태
- 인증 필요 (CRON_SECRET 또는 admin session)
- 100건씩 배치 처리, 진행률 반환
- Vercel timeout 대비 청크 단위 처리

---

## 임베딩 생성 시점

| 테이블 | 생성 시점 | 방식 |
|--------|----------|------|
| `captured_messages` | 파싱 성공 직후 (신뢰도 ≥ 0.7) | 실시간, 비동기 |
| `my_drugs` / `my_devices` | INSERT/UPDATE 시 | 실시간 (건수 적음) |
| `hospitals` | INSERT/UPDATE 시 | 실시간 (건수 적음) |
| `mfds_items` | 초기 배치 1회 + MFDS 동기화 후 증분 | `/api/embed-batch` API |

---

## Supabase RPC 함수 (예시)

```sql
-- 제품 벡터 검색
CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id int, name text, type text, similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    item_name AS name,
    'drug' AS type,
    1 - (embedding <=> query_embedding) AS similarity
  FROM my_drugs
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  UNION ALL
  SELECT
    id,
    prdlst_nm AS name,
    'device' AS type,
    1 - (embedding <=> query_embedding) AS similarity
  FROM my_devices
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
```

---

## 환경 변수 추가

```env
# apps/web/.env.local
GOOGLE_GENERATIVE_AI_API_KEY=    # Gemini API 키 (없으면 Ollama 폴백)
EMBEDDING_DIMENSION=768
EMBEDDING_THRESHOLD=0.6
```

---

## 예상 효과

| 지표 | 현재 | 개선 후 |
|------|------|---------|
| 제품 매칭 실패율 | L7 미매칭 발생 | 벡터 L6로 동의어·약어 처리 |
| 파싱 정확도 | 프롬프트에 alias 50건 고정 | 의미 유사 실제 케이스 top-3 동적 주입 |
| 신규 병원 인식 | 전화번호 없으면 불가 | 병원명 유사도로 후보 매칭 |
| 시스템 내성 | Gemini 단일 의존 없음 | Gemini 장애 시 Ollama 자동 폴백 |

---

## 구현 우선순위

1. **마이그레이션** — pgvector 설치 + 4테이블 컬럼 추가
2. **embedding-service.ts** — Gemini2 + Ollama 폴백
3. **vector-search.ts** + Supabase RPC 함수
4. **match-products.ts** L6 교체 — 즉각적인 매칭 개선
5. **parse-message.ts** few-shot 주입 — 파싱 정확도 개선
6. **embed-batch API** + mfds_items 초기 배치 실행

---

## 제약 사항

- Gemini Embedding 2는 현재 **preview** 상태. GA 전환 시 모델 ID만 변경하면 됨.
- mfds_items 수만 건 초기 배치는 Vercel timeout(10초) 때문에 `/api/embed-batch`로 청크 처리 필요.
- IVFFlat 인덱스는 임베딩이 일정 수 이상 쌓여야 효과적. 초기엔 인덱스 없이 순차 스캔으로도 충분.
- `supabase db reset` 금지 (수동 임포트 데이터 보호).

# NotiFlow 로컬 LLM (Ollama) 연동 구현 가이드

## 개요

NotiFlow의 기존 멀티 프로바이더 AI 클라이언트(Anthropic/Google/OpenAI)에 **"local" 프로바이더**를 추가하여, Ollama를 통해 Qwen 3.5 등 로컬 LLM을 사용할 수 있도록 합니다.

**대상 환경**: Mac Mini M4 16GB + Ollama + Qwen3 8B
**핵심 전략**: Ollama의 OpenAI 호환 API(`/v1/chat/completions`)를 활용하여 최소한의 코드 변경으로 연동

---

## 수정 대상 파일 목록 (총 7개)

| # | 파일 | 변경 내용 |
|---|------|----------|
| 1 | `apps/web/src/lib/queries/settings.ts` | `AIProvider` 타입에 `"local"` 추가 |
| 2 | `apps/web/src/lib/ai-client.ts` | `callLocal`, `callLocalStructured` 함수 추가 + 라우터 확장 |
| 3 | `apps/web/src/lib/parse-service.ts` | `getAISettingsFromClient`에서 local 프로바이더 인식 |
| 4 | `apps/web/src/components/ai-settings.tsx` | UI에 Local (Ollama) 프로바이더 및 모델 옵션 추가 |
| 5 | `apps/web/src/app/(dashboard)/settings/actions.ts` | `ai_api_key_local` 설정 키 허용 |
| 6 | `packages/supabase/functions/_shared/ai-client.ts` | Edge Function용 local 프로바이더 추가 |
| 7 | `apps/web/.env.local` | `LOCAL_LLM_URL` 환경변수 추가 |

---

## 파일별 상세 구현

### 1. `apps/web/src/lib/queries/settings.ts`

**변경**: `AIProvider` 타입에 `"local"` 추가, `getSettings`에서 local 인식

```typescript
// 3행: 타입 변경
export type AIProvider = "anthropic" | "google" | "openai" | "local";
```

```typescript
// 56행: provider 유효성 검사에 "local" 추가
ai_provider: (["anthropic", "google", "openai", "local"].includes(provider)
  ? provider as AIProvider
  : "anthropic"),
```

```typescript
// 63~67행: ai_api_keys에 local 추가
ai_api_keys: {
  anthropic: maskApiKey(map.get("ai_api_key_anthropic")),
  google: maskApiKey(map.get("ai_api_key_google")),
  openai: maskApiKey(map.get("ai_api_key_openai")),
  local: maskApiKey(map.get("ai_api_key_local")),  // 추가
},
```

```typescript
// 35~44행: select 쿼리에 "ai_api_key_local" 추가
.in("key", [
  "ai_enabled",
  "ai_provider",
  "ai_model",
  "sync_interval_minutes",
  "ai_api_key_anthropic",
  "ai_api_key_google",
  "ai_api_key_openai",
  "ai_api_key_local",       // 추가
  "drug_api_service_key",
])
```

---

### 2. `apps/web/src/lib/ai-client.ts` (핵심 변경)

**추가할 함수 2개** + **라우터 2개 수정** + **설정 해석 수정**

#### 2-1. `callLocal` 함수 추가 (callOpenAI 아래에)

```typescript
// ---------------------------------------------------------------------------
// Local LLM (Ollama/vLLM — OpenAI-compatible API)
// ---------------------------------------------------------------------------

const LOCAL_LLM_BASE_URL = process.env.LOCAL_LLM_URL || "http://localhost:11434";
const LOCAL_LLM_DEFAULT_MODEL = process.env.LOCAL_LLM_MODEL || "qwen3:8b";

async function callLocal(apiKey: string, model: string, prompt: string): Promise<AICallResult> {
  const baseUrl = apiKey || LOCAL_LLM_BASE_URL; // apiKey 필드를 base URL로 재활용
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || LOCAL_LLM_DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0.1,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Local LLM API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}
```

> **설계 포인트**: `apiKey` 필드를 Ollama 서버의 base URL로 재활용합니다. 로컬 LLM은 API 키가 불필요하므로, 설정 UI에서 "서버 주소"를 입력받아 이 필드에 저장합니다. 비어 있으면 환경변수 `LOCAL_LLM_URL` → 기본값 `http://localhost:11434`로 폴백합니다.

#### 2-2. `callLocalStructured` 함수 추가

```typescript
async function callLocalStructured(
  apiKey: string, model: string, system: string, user: string,
): Promise<AIStructuredResult> {
  const baseUrl = apiKey || LOCAL_LLM_BASE_URL;

  // JSON 스키마를 시스템 프롬프트에 포함하여 구조화된 출력 유도
  const schemaInstruction = `

IMPORTANT: You MUST respond with ONLY a valid JSON object matching this exact schema (no markdown, no explanation):
${JSON.stringify(PARSE_ORDER_SCHEMA, null, 2)}

Example response format:
{"is_order": true, "items": [{"item": "EK15", "qty": 10, "unit": "box", "matched_product": null, "confidence": 0.5}], "rejection_reason": null}`;

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || LOCAL_LLM_DEFAULT_MODEL,
      messages: [
        { role: "system", content: system + schemaInstruction },
        { role: "user", content: user },
      ],
      max_tokens: 1024,
      temperature: 0.1,
      // Ollama의 JSON 모드 (response_format 지원 시)
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Local LLM API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";

  // JSON 파싱 (코드 블록 감싸인 경우 처리)
  let parsed: unknown = null;
  try {
    let jsonStr = text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    console.warn("[callLocalStructured] JSON parse failed, raw text:", text.slice(0, 200));
    parsed = null;
  }

  return {
    parsed,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}
```

> **설계 포인트**: 로컬 LLM은 OpenAI의 `json_schema` strict mode를 지원하지 않으므로, 시스템 프롬프트에 스키마를 명시하고 `response_format: { type: "json_object" }`로 JSON 출력을 강제합니다. 코드 블록으로 감싸진 응답도 처리합니다.

#### 2-3. `callAI` 라우터 수정 (108~114행)

```typescript
export function callAI(provider: string, apiKey: string, model: string, prompt: string): Promise<AICallResult> {
  switch (provider) {
    case "google": return callGemini(apiKey, model, prompt);
    case "openai": return callOpenAI(apiKey, model, prompt);
    case "local":  return callLocal(apiKey, model, prompt);   // 추가
    default: return callClaude(apiKey, model, prompt);
  }
}
```

#### 2-4. `callAIStructured` 라우터 수정 (297~305행)

```typescript
export function callAIStructured(
  provider: string, apiKey: string, model: string, system: string, user: string,
): Promise<AIStructuredResult> {
  switch (provider) {
    case "google": return callGeminiStructured(apiKey, model, system, user);
    case "openai": return callOpenAIStructured(apiKey, model, system, user);
    case "local":  return callLocalStructured(apiKey, model, system, user);  // 추가
    default: return callClaudeStructured(apiKey, model, system, user);
  }
}
```

#### 2-5. `SETTINGS_KEYS` 배열에 추가 (311~321행)

```typescript
const SETTINGS_KEYS = [
  "ai_enabled",
  "ai_provider",
  "ai_model",
  "ai_parse_prompt",
  "ai_auto_process",
  "ai_confidence_threshold",
  "ai_api_key_anthropic",
  "ai_api_key_google",
  "ai_api_key_openai",
  "ai_api_key_local",           // 추가
];
```

#### 2-6. `getDefaultModel` 함수 수정 (323~329행)

```typescript
function getDefaultModel(provider: string): string {
  switch (provider) {
    case "google": return "gemini-2.5-flash";
    case "openai": return "gpt-4o-mini";
    case "local":  return "qwen3:8b";              // 추가
    default: return "claude-haiku-4-5-20251001";
  }
}
```

#### 2-7. `getAISettings` 함수 수정 (341~379행)

```typescript
// 352행: provider 유효성 검사에 "local" 추가
const provider = (["anthropic", "google", "openai", "local"].includes(map.get("ai_provider") as string)
  ? (map.get("ai_provider") as string)
  : "anthropic");

// 356~365행: API 키 해석 — local인 경우 URL을 키로 사용
let apiKey = map.get(`ai_api_key_${provider}`) as string | null;
if (!apiKey || typeof apiKey !== "string") {
  const envKeyMap: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
    openai: "OPENAI_API_KEY",
    local: "LOCAL_LLM_URL",          // 추가: URL을 apiKey 필드로 전달
  };
  apiKey = process.env[envKeyMap[provider] ?? ""] ?? null;
}

// ★ local 프로바이더는 API 키 없이도 동작해야 함 (기본 localhost 사용)
// 기존 로직: apiKey가 없으면 AI disabled 처리 → local은 예외 필요
```

**중요**: `parse-service.ts`의 `aiParse` 함수에서 `!settings.ai_api_key` 체크 시 local 프로바이더는 API 키 없이도 통과해야 합니다.

---

### 3. `apps/web/src/lib/parse-service.ts`

**변경**: aiParse에서 local 프로바이더의 키 없음 허용 + settings 해석

#### 3-1. `aiParse` 함수 수정 (108~120행)

```typescript
// 기존:
// if (!settings.ai_api_key || !settings.ai_enabled) {

// 변경: local 프로바이더는 API 키 없어도 통과
if (!settings.ai_enabled || (!settings.ai_api_key && settings.ai_provider !== "local")) {
  console.log(`[aiParse] No API key or AI disabled → regex fallback | hasKey=${!!settings.ai_api_key} enabled=${settings.ai_enabled} provider=${settings.ai_provider}`);
  warnings.push("AI disabled or no API key — used regex fallback");
  const items = regexParse(content);
  console.log(`[aiParse] regex result: ${items.length} items`);
  return {
    items,
    method: "regex",
    latency_ms: Math.round(performance.now() - startTime),
    warnings,
  };
}
```

#### 3-2. `getAISettingsFromClient` 함수 수정 (488~544행)

```typescript
// SETTINGS_KEYS에 추가
const SETTINGS_KEYS = [
  "ai_enabled",
  "ai_provider",
  "ai_model",
  "ai_parse_prompt",
  "ai_auto_process",
  "ai_confidence_threshold",
  "ai_api_key_anthropic",
  "ai_api_key_google",
  "ai_api_key_openai",
  "ai_api_key_local",           // 추가
];

// getDefaultModel에 추가
function getDefaultModel(provider: string): string {
  switch (provider) {
    case "google": return "gemini-2.5-flash";
    case "openai": return "gpt-4.1-mini";
    case "local":  return "qwen3:8b";              // 추가
    default: return "claude-haiku-4-5-20251001";
  }
}

// provider 유효성 검사에 "local" 추가
const provider = (["anthropic", "google", "openai", "local"].includes(map.get("ai_provider") as string)
  ? (map.get("ai_provider") as string)
  : "anthropic");

// envKeyMap에 local 추가
const envKeyMap: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
  local: "LOCAL_LLM_URL",           // 추가
};
```

---

### 4. `apps/web/src/components/ai-settings.tsx` (UI 변경)

#### 4-1. PROVIDERS 배열에 추가 (26~30행)

```typescript
const PROVIDERS = [
  { value: "anthropic" as const, label: "Anthropic (Claude)", placeholder: "sk-ant-api03-..." },
  { value: "google" as const, label: "Google (Gemini)", placeholder: "AIza..." },
  { value: "openai" as const, label: "OpenAI (GPT)", placeholder: "sk-..." },
  { value: "local" as const, label: "Local (Ollama)", placeholder: "http://localhost:11434" },  // 추가
];
```

#### 4-2. MODELS에 local 추가 (32~49행)

```typescript
const MODELS: Record<AIProvider, Array<{ value: string; label: string; description: string }>> = {
  anthropic: [
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "빠르고 경제적" },
    { value: "claude-sonnet-4-6-20260220", label: "Claude Sonnet 4.6", description: "균형잡힌 성능" },
    { value: "claude-opus-4-6-20260219", label: "Claude Opus 4.6", description: "최고 품질" },
  ],
  google: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "빠르고 경제적 (추천)" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", description: "초저지연, 대량 처리" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "고품질 추론" },
  ],
  openai: [
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", description: "빠르고 경제적 (최신)" },
    { value: "gpt-4.1", label: "GPT-4.1", description: "고품질 (최신)" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini", description: "빠르고 경제적" },
    { value: "gpt-4o", label: "GPT-4o", description: "고품질" },
  ],
  local: [                                                                           // 추가
    { value: "qwen3:8b", label: "Qwen3 8B", description: "균형잡힌 성능 (추천)" },
    { value: "qwen3:4b", label: "Qwen3 4B", description: "빠르고 가벼움" },
    { value: "qwen3:1.7b", label: "Qwen3 1.7B", description: "초경량" },
    { value: "qwen3:14b", label: "Qwen3 14B", description: "고품질 (16GB 메모리 필요)" },
    { value: "gemma3:4b", label: "Gemma3 4B", description: "Google 오픈 모델" },
    { value: "llama3.1:8b", label: "Llama 3.1 8B", description: "Meta 오픈 모델" },
  ],
};
```

#### 4-3. API 키 안내 문구 수정 (303~307행)

```typescript
<p className="text-xs text-muted-foreground">
  {provider === "anthropic" && "Anthropic Console → API Keys에서 발급받을 수 있습니다."}
  {provider === "google" && "Google AI Studio → API Keys에서 발급받을 수 있습니다."}
  {provider === "openai" && "OpenAI Platform → API Keys에서 발급받을 수 있습니다."}
  {provider === "local" && "Ollama 서버 주소를 입력합니다. 기본값: http://localhost:11434 (비워두면 기본값 사용)"}
</p>
```

#### 4-4. API 키 카드 제목 변경 (244~249행)

Local 선택 시 "API 키" → "서버 주소"로 표시되도록:

```typescript
<CardTitle className="text-base flex items-center gap-2">
  <Key className="h-4 w-4" />
  {provider === "local" ? "서버 주소" : "API 키"}
</CardTitle>
<CardDescription>
  {provider === "local"
    ? "Ollama 서버의 주소를 입력합니다. 비워두면 기본값(localhost:11434)을 사용합니다."
    : "선택한 AI 제공자의 API 키를 입력합니다. 키는 서버에 안전하게 저장됩니다."}
</CardDescription>
```

---

### 5. `apps/web/src/app/(dashboard)/settings/actions.ts`

**변경**: `ALLOWED_SETTING_KEYS`에 `"ai_api_key_local"` 추가

```typescript
const ALLOWED_SETTING_KEYS = new Set([
  "ai_enabled",
  "ai_provider",
  "ai_model",
  "sync_interval_minutes",
  "ai_api_key_anthropic",
  "ai_api_key_google",
  "ai_api_key_openai",
  "ai_api_key_local",          // 추가
  "drug_api_service_key",
  "order_display_columns",
]);
```

---

### 6. `packages/supabase/functions/_shared/ai-client.ts`

**추가**: Edge Function에서도 local 프로바이더 지원

#### 6-1. `callLocal` 함수 추가

```typescript
// ---------------------------------------------------------------------------
// Local LLM (Ollama/vLLM — OpenAI-compatible API)
// ---------------------------------------------------------------------------

async function callLocal(
  baseUrl: string,
  model: string,
  prompt: string,
): Promise<AICallResult> {
  const url = baseUrl || Deno.env.get("LOCAL_LLM_URL") || "http://localhost:11434";
  const res = await fetch(`${url}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || "qwen3:8b",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Local LLM API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}
```

#### 6-2. `callAI` 라우터 수정

```typescript
export async function callAI(
  provider: string, apiKey: string, model: string, prompt: string,
): Promise<AICallResult> {
  switch (provider) {
    case "google":  return callGemini(apiKey, model, prompt);
    case "openai":  return callOpenAI(apiKey, model, prompt);
    case "local":   return callLocal(apiKey, model, prompt);   // 추가
    default:        return callClaude(apiKey, model, prompt);
  }
}
```

#### 6-3. `resolveAIProvider` 수정

```typescript
export function resolveAIProvider(
  settingsMap: Map<string, unknown>,
): AIProviderSettings | null {
  const provider = (["anthropic", "google", "openai", "local"].includes(  // "local" 추가
      settingsMap.get("ai_provider") as string,
    )
    ? (settingsMap.get("ai_provider") as string)
    : "anthropic");

  let apiKey = settingsMap.get(`ai_api_key_${provider}`) as string | null;
  if (!apiKey || typeof apiKey !== "string") {
    apiKey = Deno.env.get(ENV_KEY_MAP[provider] ?? "") ?? null;
  }

  // local 프로바이더는 API 키 없어도 허용 (기본 localhost 사용)
  if (!apiKey && provider !== "local") return null;

  const model = (typeof settingsMap.get("ai_model") === "string"
    ? (settingsMap.get("ai_model") as string).replace(/^"|"$/g, "")
    : getDefaultModel(provider));

  return { provider, apiKey: apiKey ?? "", model };
}
```

#### 6-4. `ENV_KEY_MAP` 및 `getDefaultModel` 수정

```typescript
const ENV_KEY_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
  local: "LOCAL_LLM_URL",           // 추가
};

function getDefaultModel(provider: string): string {
  switch (provider) {
    case "google":  return "gemini-2.0-flash";
    case "openai":  return "gpt-4o-mini";
    case "local":   return "qwen3:8b";              // 추가
    default:        return "claude-haiku-4-5-20251001";
  }
}
```

---

### 7. 환경변수 설정

**`apps/web/.env.local`**에 추가:

```env
# Local LLM (Ollama)
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=qwen3:8b
```

**`apps/web/.env.example`**에도 추가:

```env
# Local LLM (Ollama) — Optional
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=qwen3:8b
```

---

## Ollama 설치 및 모델 준비

```bash
# 1. Ollama 설치 (macOS)
brew install ollama
# 또는
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Ollama 서비스 시작
ollama serve

# 3. Qwen3 8B 모델 다운로드 (약 5GB)
ollama pull qwen3:8b

# 4. 동작 확인
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3:8b",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 50
  }'
```

---

## 테스트 순서

### 1단계: Ollama API 직접 테스트

```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3:8b",
    "messages": [
      {"role": "system", "content": "You are a Korean medical supply order parser. Respond in JSON only."},
      {"role": "user", "content": "EK15 10박스 니들 50개"}
    ],
    "response_format": {"type": "json_object"},
    "temperature": 0.1
  }'
```

### 2단계: 설정 페이지에서 프로바이더 변경

1. `/settings` → AI 제공자 → "Local (Ollama)" 선택
2. 서버 주소 비워두기 (기본값 사용) 또는 커스텀 주소 입력
3. 모델 선택: "Qwen3 8B"

### 3단계: 메시지 파싱 테스트

1. `/api/test-parse` 엔드포인트로 테스트
2. 또는 대시보드에서 직접 메시지 파싱 실행
3. parse_history 테이블에서 `llm_model: "local/qwen3:8b"` 확인

---

## 주의사항

1. **네트워크**: Ollama는 기본적으로 `localhost`에서만 접근 가능합니다. Docker 환경에서는 `host.docker.internal:11434`로 접근해야 합니다.

2. **Thinking 모드**: Qwen3는 기본적으로 thinking 모드가 활성화되어 있어, `<think>...</think>` 태그가 응답에 포함될 수 있습니다. `callLocalStructured`에서 JSON 파싱 전에 이를 제거하는 로직이 필요할 수 있습니다:

```typescript
// thinking 태그 제거
let jsonStr = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
```

3. **성능**: 8B 모델 기준 첫 응답까지 2~5초, 이후 토큰 생성은 ~20 tok/s 예상 (M4 16GB). 타임아웃 설정을 넉넉하게 잡을 것을 권장합니다 (30초 이상).

4. **JSON 정확도**: 로컬 LLM은 클라우드 모델보다 JSON 스키마 준수율이 낮을 수 있습니다. 기존 regex fallback이 안전망 역할을 합니다.

5. **메모리**: Ollama가 모델을 로드하면 약 5~6GB 메모리를 점유합니다. Mac Mini 16GB에서 다른 앱과 함께 사용 시 유의하세요.

---

## 구현 완료 후 체크리스트

- [ ] `AIProvider` 타입에 `"local"` 추가됨
- [ ] `callLocal` / `callLocalStructured` 함수 동작 확인
- [ ] 설정 UI에서 Local (Ollama) 선택 가능
- [ ] API 키 필드가 "서버 주소"로 표시됨
- [ ] 서버 주소 비어있을 때 기본값(localhost:11434) 사용됨
- [ ] 메시지 파싱 정상 동작 (JSON 응답 파싱)
- [ ] Thinking 태그 제거 처리됨
- [ ] parse_history에 `local/qwen3:8b`로 기록됨
- [ ] regex fallback 정상 동작 (AI 실패 시)
- [ ] Edge Function에서도 local 프로바이더 인식됨
- [ ] TypeScript strict mode 에러 없음
- [ ] ESLint 통과

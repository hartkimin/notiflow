# Parsing Architecture Redesign

**Date**: 2026-02-19
**Status**: Approved
**Approach**: B - Architecture Redesign (Web SSOT + Edge thin proxy)

## Problem Statement

The current message parsing system has duplicated logic across two runtimes (Node.js for Web, Deno for Edge Functions), hardcoded AI prompts without structured output, inconsistent error handling, and limited few-shot examples. This makes maintenance difficult and limits parsing accuracy.

## Goals

1. **Single Source of Truth** — All parsing logic in `apps/web/src/lib/parser.ts`
2. **Structured Output** — Provider-specific JSON schema enforcement (tool_use, json_schema, responseSchema)
3. **Improved Prompts** — System/user message separation, expanded few-shot examples (6-8)
4. **Better Product Matching** — AI matched_product priority, Levenshtein fuzzy match fallback
5. **Unified Error Handling** — Consistent ParseResult with warnings, fallback tracking

## Architecture

### Before

```
[Mobile] → raw_messages INSERT
  ├── DB Webhook → parse-message Edge Function (full parser, Deno)
  └── Web Dashboard → parseMessageDirect() Server Action (full parser, Node.js)
       ↑ Code duplication!

[Test UI] → test-parse Edge Function (full parser, Deno)
```

### After

```
[Mobile] → raw_messages INSERT
  ├── DB Webhook → parse-message Edge Function (thin proxy)
  │                  → POST /api/parse (Web API Route)
  └── Web Dashboard → parseMessageDirect() Server Action
                       → parseMessage() (shared core)

[Test UI] → test-parse Edge Function (thin proxy)
              → POST /api/parse?test=true (Web API Route)
```

## Detailed Design

### 1. Structured Output (per provider)

**Claude (Anthropic):** `tool_use` with `parse_order` tool schema
**OpenAI:** `response_format: { type: "json_schema", json_schema }`
**Gemini:** `generationConfig.responseSchema`

Schema:
```typescript
{
  is_order: boolean;
  items: Array<{
    item: string;
    qty: number;       // minimum: 1
    unit: string;      // enum: box, piece, pack, set, bottle, can, sheet, roll
    matched_product: string | null;
    confidence: number; // 0-1
  }>;
  rejection_reason?: string;
}
```

### 2. Prompt Structure

**System message:** Role definition, 10 core rules, unit conversion table, output schema
**User message:** Hospital aliases (dynamic), product catalog (dynamic), few-shot examples (6-8), actual message

### 3. Few-shot Examples (expanded from 2 → 6-8)

| Pattern | Example |
|---|---|
| Basic order | `"EK15 10박스 니들 50개"` |
| Reversed (qty first) | `"20개 A타입 니들"` |
| Multi-item single line | `"b 20 G 20 니들 5"` |
| Non-order message | `"감사합니다 내일 뵙겠습니다"` |
| Alias usage | `"투석액 린스 10박스"` |
| Mixed units | `"A 5박스 B 20개 C 3팩"` |
| Qty-less item | `"니들"` → qty=1 |
| Complex real message | Multi-line with comments |

### 4. Product Matching Pipeline

```
AI result (item, qty, unit, matched_product)
  ├── matched_product exists → DB lookup by official_name
  │     → found: confidence = 0.95 (AI matched)
  │     → not found: fall through to 5-level matching
  └── matched_product null → 5-level matching
        1. Hospital alias exact
        2. Global alias exact
        3. official_name exact
        4. short_name exact
        5. Substring/contains
        6. Levenshtein fuzzy (distance ≤ 2) [NEW]
```

### 5. Unified ParseResult

```typescript
interface ParseResult {
  items: ParsedItem[];
  method: 'llm' | 'regex';
  ai_provider?: string;
  ai_model?: string;
  latency_ms: number;
  token_usage?: { input_tokens: number; output_tokens: number };
  warnings: string[];    // fallback reasons, partial failures
  error?: string;        // fatal parse failure
}
```

### 6. Error Handling Rules

1. AI failure → regex fallback + `warnings` records reason
2. `parse_history` stores fallback_reason in `raw_output`
3. Dashboard shows warnings visually (icon/badge) — deferred to separate task
4. regex failure → `parse_status = 'failed'`, `error` field populated

## File Changes

### Modified
| File | Changes |
|---|---|
| `apps/web/src/lib/parser.ts` | SSOT parser — improved prompt, structured output, fuzzy match, unified ParseResult |
| `apps/web/src/lib/ai-client.ts` | Per-provider structured output (tool_use/json_schema), system message support |
| `apps/web/src/lib/actions.ts` | parseMessageDirect() uses new ParseResult, warnings handling |
| `packages/supabase/functions/parse-message/index.ts` | Thin proxy — calls Web API Route |
| `packages/supabase/functions/test-parse/index.ts` | Thin proxy — calls Web API Route |

### New
| File | Purpose |
|---|---|
| `apps/web/src/app/api/parse/route.ts` | API Route for Edge Function proxy calls |

### Deleted
| File | Reason |
|---|---|
| `packages/supabase/functions/_shared/parser.ts` | Logic moved to Web |
| `packages/supabase/functions/_shared/ai-client.ts` | Logic moved to Web |

### Environment Variables (new)
```
WEB_API_URL=<vercel-domain>          # Edge Function env
PARSE_API_SECRET=<shared-secret>     # Both Edge Function + Web env
```

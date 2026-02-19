# Parse Visibility Design

## Problem

Messages are parsed by AI (Gemini) and matched to products behind the scenes, but the dashboard shows only a status badge and raw JSON. Users cannot see:
- Which method parsed the message (AI vs regex)
- How each item was interpreted (original text → matched product)
- Match confidence levels
- The end-to-end flow from message receipt to order creation

## Solution

Add an inline expandable row to the message list that shows the full parsing pipeline visually.

## UI Design

### Expandable Row (Accordion)

Clicking a message row expands it downward with two sections:

**Section 1: Parse Stepper (horizontal 4-step flow)**

```
① 메시지 수신  →  ② AI 파싱  →  ③ 제품 매칭  →  ④ 주문 생성
09:15:02          Gemini 2.0    3개 항목         #ORD-20260219-001
카카오톡           1.2초         매칭 3/리뷰 0     확인됨
```

Step states:
- Completed: green check icon
- Failed: red X icon
- Pending: gray circle
- Not applicable: dashed line (e.g., no order created yet)

**Section 2: Parsed Items Table**

| 원문 | 매칭 제품 | 수량 | 단위 | 신뢰도 |
|------|----------|------|------|--------|
| 에포시스 10000 | 에포시스주 10000IU | 3 | box | green "매칭" |

Confidence badges:
- matched (≥0.9): green "매칭"
- review (0.5–0.9): yellow "검토"
- unmatched (<0.5): red "미매칭"

**Action: "AI 재파싱" button** at bottom-right, calls existing `test-parse` Edge Function.

## Data Source

All data already exists in `raw_messages.parse_result` (JSON):
- `items[].item` → original text
- `items[].product_name` → matched product
- `items[].qty` → quantity
- `items[].unit` → unit
- `items[].confidence` → confidence score
- `items[].match_status` → matched/review/unmatched

Additional fields from the row:
- `parse_method` → "llm" or "regex"
- `order_id` → linked order
- `source_app`, `received_at` → step 1 metadata

No DB schema changes required.

## Component Structure

```
message-list.tsx (existing)
├── MessageTable / MessageGrid (existing rows)
│   └── <MessageParseExpander>      ← new wrapper
│       ├── <ParseStepper>          ← 4-step horizontal flow
│       ├── <ParseResultTable>      ← items table with badges
│       └── <ReparseButton>         ← calls test-parse Edge Function
```

All new components go inside `message-list.tsx` (existing file, already contains all message UI logic).

## Reparse Flow

1. User clicks "AI 재파싱" button
2. Button shows loading spinner
3. Calls `test-parse` Edge Function with `{ content, hospital_id }`
4. On success: updates the expanded area with new parse results inline
5. Does NOT save to DB (test-parse is read-only)

## Scope

- Read-only visualization of existing parse data
- Reparse button for re-running AI parse (no DB write)
- No new pages, no new API endpoints, no DB changes
- Works with both table and grid view modes

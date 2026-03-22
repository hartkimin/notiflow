export interface AliasEntry {
  alias: string;
  product_name: string;
}

export interface ProductCatalogEntry {
  id: number;
  name: string;
  standard_code: string | null;
}

export const MESSAGE_PARSE_SYSTEM_PROMPT = `당신은 한국 혈액투석 의료기관의 주문 메시지를 분석하는 전문 파서입니다.

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
반드시 JSON으로만 응답하세요. 설명이나 마크다운 없이 순수 JSON만 출력합니다.
{ "items": [...], "confidence": 0.0~1.0 }

items 배열의 각 요소:
{
  "item": "원본 텍스트에서 추출한 품목명",
  "qty": 숫자,
  "unit": "box|piece|pack|set|bottle|can|sheet|roll",
  "matched_product": "매칭된 정식 제품명 또는 null"
}

비주문 메시지:
{ "items": [], "confidence": 0.95 }`;

export function buildUserPrompt(
  hospitalName: string | null,
  aliases: AliasEntry[],
  catalog: ProductCatalogEntry[],
  messageContent: string,
): string {
  const aliasSection = aliases.length > 0
    ? JSON.stringify(aliases.slice(0, 50), null, 2)
    : "등록된 alias 없음";

  const catalogSection = catalog.length > 0
    ? JSON.stringify(catalog.slice(0, 30).map(p => ({ name: p.name, code: p.standard_code })), null, 2)
    : "등록된 제품 없음";

  return `## 병원 정보
병원명: ${hospitalName ?? "알 수 없음"}

## 이 병원의 제품 alias 목록
${aliasSection}

## 등록된 제품 카탈로그
${catalogSection}

## 분석할 메시지
${messageContent}`;
}

export interface AliasEntry {
  alias: string;
  product_name: string;
}

export interface ProductCatalogEntry {
  id: number;
  name: string;
  standard_code: string | null;
}

export const MESSAGE_PARSE_SYSTEM_PROMPT = `혈액투석 의료물자 주문 메시지에서 품목/수량/단위를 추출하는 파서.

핵심 규칙:
1. 각 줄을 독립적으로 분석. "품목 수량단위" 또는 "수량단위 품목" 패턴 인식
2. "에이액 90" → item:"에이액", qty:90, unit:"piece"
3. "EK15 10박스" → item:"EK15", qty:10, unit:"box"
4. "에포틴 10000 5박스" → item:"에포틴 10000", qty:5, unit:"box" (10000은 품목 규격)
5. 연속 줄에 숫자+단위만 있으면 → 바로 윗 줄의 품목명 이어받기:
   "에포카인 2000 10박스\n4000 10박스\n6000 10박스" → "에포카인 2000" 10box + "에포카인 4000" 10box + "에포카인 6000" 10box
6. "5층 N/S 1L 6박스" → item:"N/S 1L", qty:6, unit:"box" (층 정보 제외)
7. 수량 없으면→1, 단위 없으면→piece
8. 단위: 박스/box→box, 개/ea→piece, 봉/팩→pack, 세트→set, 병→bottle, 통→can, 롤→roll
9. 인사말/발주요/감사합니다/수고하세요/부탁드립니다 → 품목에서 제외
10. 전체가 인사/질문/일정이면 → 빈배열

품목 규격 vs 수량 판별:
- 숫자 뒤에 단위(박스,개,통 등)가 있으면 → 수량
- "에포틴 10000 5박스" → 10000은 규격, 5는 수량 → item:"에포틴 10000", qty:5
- "HD sol 265통" → 265는 수량 → item:"HD sol", qty:265
- "에이액 90" → 90은 수량(단위 생략) → item:"에이액", qty:90, unit:"piece"
- "에이액 90 비액 90" → 공백으로 품목 구분: "에이액" qty:90 + "비액" qty:90
- 한 줄에 여러 품목이 있으면 각각 분리

JSON만: {"items":[{"item":"품목명","qty":수량,"unit":"단위","matched_product":null}],"confidence":0.9}
비주문: {"items":[],"confidence":0.95}`;

export function buildUserPrompt(
  hospitalName: string | null,
  aliases: AliasEntry[],
  _catalog: ProductCatalogEntry[],
  messageContent: string,
): string {
  const parts: string[] = [];
  if (hospitalName) parts.push(`병원: ${hospitalName}`);
  if (aliases.length > 0) {
    parts.push(`alias: ${JSON.stringify(aliases.slice(0, 20))}`);
  }
  parts.push(`메시지:\n${messageContent}`);
  return parts.join("\n\n");
}

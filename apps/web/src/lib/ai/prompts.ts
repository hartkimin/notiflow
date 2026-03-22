export interface AliasEntry {
  alias: string;
  product_name: string;
}

export interface ProductCatalogEntry {
  id: number;
  name: string;
  standard_code: string | null;
}

export const MESSAGE_PARSE_SYSTEM_PROMPT = `의료물자 주문 메시지 파서. 품목명/수량/단위 추출.

규칙:
- 수량 미명시→1, 단위 미명시→piece
- 단위: 박스/box→box, 개/ea→piece, 봉/팩→pack, 세트→set, 병→bottle, 통→can, 롤→roll
- 비주문(인사/질문/일정)→빈배열
- "감사","안녕","수고","확인","?"→비주문

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

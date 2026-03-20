const CHOSUNG = [
  "ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ",
  "ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ",
];

export function getChosung(char: string): string {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return char;
  return CHOSUNG[Math.floor(code / 588)];
}

export function isChosung(char: string): boolean {
  return CHOSUNG.includes(char);
}

export function matchesChosungSearch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  if (lower.includes(qLower)) return true;
  if (![...qLower].every(isChosung)) return false;
  const textChosung = [...text].map(getChosung).join("");
  return textChosung.includes(qLower);
}

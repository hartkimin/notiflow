export const SOURCE_LABEL: Record<string, string> = {
  kakaotalk: "카카오톡", sms: "SMS", telegram: "텔레그램",
};

export function formatDate(epochMs: number): string {
  if (!epochMs) return "-";
  const d = new Date(epochMs);
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function formatDateTime(epochMs: number): string {
  if (!epochMs) return "-";
  const d = new Date(epochMs);
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

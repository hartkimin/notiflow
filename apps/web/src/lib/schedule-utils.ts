/**
 * Get Monday of the week containing the given date.
 */
export function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Convert a Date to epoch milliseconds at start of day (local timezone).
 */
export function startOfDayMs(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Get 7 dates starting from Monday.
 */
export function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/**
 * Convert ARGB integer (as stored by Android) to CSS hex color.
 * Android Color.toArgb() produces signed 32-bit int.
 */
export function argbToHex(argb: number): string {
  const hex = ((argb & 0x00FFFFFF) >>> 0).toString(16).padStart(6, "0");
  return `#${hex}`;
}

/**
 * Format epoch ms to short date string.
 */
export function formatEpochDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format epoch ms to time string.
 */
export function formatEpochTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Parse ?week=yyyy-MM-dd param to a Monday Date. Falls back to current week.
 */
export function parseWeekParam(param?: string): Date {
  if (param) {
    const d = new Date(param + "T00:00:00");
    if (!isNaN(d.getTime())) return getWeekMonday(d);
  }
  return getWeekMonday(new Date());
}

/**
 * Format week label: "2026년 2월 3주차"
 */
export function formatWeekLabel(monday: Date): string {
  const year = monday.getFullYear();
  const month = monday.getMonth() + 1;
  const weekOfMonth = Math.ceil(monday.getDate() / 7);
  return `${year}년 ${month}월 ${weekOfMonth}주차`;
}

/**
 * Generate a UUID v4 (for creating new records matching mobile pattern).
 */
export function generateId(): string {
  return crypto.randomUUID();
}

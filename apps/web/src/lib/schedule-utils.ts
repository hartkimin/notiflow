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
 * Format a Date as local "YYYY-MM-DD" string (timezone-safe, unlike toISOString).
 */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get the first day of the month containing the given date (local timezone).
 */
export function getMonthStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the first day of the next month (local timezone).
 */
export function getMonthEnd(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get all dates in a month grid (up to 6 rows x 7 columns, Mon-Sun).
 * Includes padding days from previous/next months.
 */
export function getMonthGridDates(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0..Sun=6
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - startDow);
  gridStart.setHours(0, 0, 0, 0);

  const dates: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Format month label: "2026년 2월"
 */
export function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

/**
 * Format day label: "2026. 2. 24 (화)"
 */
export function formatDayLabel(date: Date): string {
  const dow = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()} (${dow})`;
}

/**
 * Parse ?view= and date params from URL search params.
 */
export type CalendarView = "day" | "week" | "month";

export interface CalendarParams {
  view: CalendarView;
  startMs: number;
  endMs: number;
  referenceDate: Date;
}

export function parseCalendarParams(searchParams: {
  view?: string;
  week?: string;
  date?: string;
  month?: string;
}): CalendarParams {
  const view = (searchParams.view === "day" || searchParams.view === "month")
    ? searchParams.view
    : "week" as CalendarView;

  if (view === "day") {
    const d = searchParams.date ? new Date(searchParams.date + "T00:00:00") : new Date();
    const ref = isNaN(d.getTime()) ? new Date() : d;
    ref.setHours(0, 0, 0, 0);
    const startMs = ref.getTime();
    const endMs = startMs + 24 * 60 * 60 * 1000;
    return { view, startMs, endMs, referenceDate: ref };
  }

  if (view === "month") {
    let ref: Date;
    if (searchParams.month) {
      const [y, m] = searchParams.month.split("-").map(Number);
      ref = new Date(y, m - 1, 1);
      if (isNaN(ref.getTime())) ref = new Date();
    } else {
      ref = new Date();
    }
    const start = getMonthStart(ref);
    const end = getMonthEnd(ref);
    return { view, startMs: start.getTime(), endMs: end.getTime(), referenceDate: start };
  }

  // week (default)
  const monday = parseWeekParam(searchParams.week);
  const startMs = startOfDayMs(monday);
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
  return { view, startMs, endMs, referenceDate: monday };
}

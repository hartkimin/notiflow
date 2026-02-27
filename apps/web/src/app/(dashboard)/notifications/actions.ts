"use server";

export async function getCalendarMessagesAction(startMs: number, endMs: number) {
  const { getMessagesForCalendar } = await import("@/lib/queries/messages");
  return getMessagesForCalendar({ startMs, endMs });
}

export async function getCalendarForecastsAction(from: string, to: string) {
  const { getForecastsForCalendar } = await import("@/lib/queries/forecasts");
  return getForecastsForCalendar({ from, to });
}

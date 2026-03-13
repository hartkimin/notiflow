"use server";

export async function getCalendarMessagesAction(startMs: number, endMs: number) {
  const { getMessagesForCalendar } = await import("@/lib/queries/messages");
  const from = new Date(startMs).toISOString().slice(0, 10);
  const to = new Date(endMs).toISOString().slice(0, 10);
  return getMessagesForCalendar({ from, to });
}

export async function getCalendarForecastsAction(from: string, to: string) {
  const { getForecastsForCalendar } = await import("@/lib/queries/forecasts");
  return getForecastsForCalendar({ from, to });
}

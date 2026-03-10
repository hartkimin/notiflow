import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderForecast, OrderForecastDetail, ForecastItem } from "@/lib/types";

/**
 * Get all forecasts in a date range (for calendar view).
 * Includes hospital_name via join.
 */
export async function getForecastsForCalendar(params: {
  from: string;
  to: string;
}): Promise<OrderForecast[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("order_forecasts")
    .select("*, hospitals(name)")
    .gte("forecast_date", params.from)
    .lt("forecast_date", params.to)
    .order("forecast_date", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { hospitals: h, ...rest } = row as Record<string, unknown> & { hospitals: { name: string } | null };
    return { ...rest, hospital_name: h?.name ?? undefined } as OrderForecast;
  });
}

/**
 * Get a single forecast with its items.
 */
export async function getForecast(id: number): Promise<OrderForecastDetail | null> {
  const supabase = createAdminClient();
  const { data: forecast, error } = await supabase
    .from("order_forecasts")
    .select("*, hospitals(name)")
    .eq("id", id)
    .single();
  if (error) return null;

  const { data: items } = await supabase
    .from("forecast_items")
    .select("*, mfds_items(item_name)")
    .eq("forecast_id", id)
    .order("id");

  const mappedItems: ForecastItem[] = (items ?? []).map((row: Record<string, unknown>) => {
    const mfdsItem = row.mfds_items as { item_name: string } | null;
    return {
      ...row,
      item_name: mfdsItem?.item_name ?? (row.item_name as string | null),
      mfds_items: undefined,
    } as unknown as ForecastItem;
  });

  const result = {
    ...forecast,
    hospital_name: (forecast.hospitals as { name: string } | null)?.name ?? undefined,
    hospitals: undefined,
    items: mappedItems,
  };
  return result as OrderForecastDetail;
}

/**
 * Find matching forecasts for a given message.
 * Criteria: same hospital_id, forecast_date within ±1 day of message received_at, status=pending.
 */
export async function findMatchingForecasts(params: {
  hospitalId: number | null;
  receivedAt: string;
}): Promise<OrderForecast[]> {
  if (!params.hospitalId) return [];

  const supabase = createAdminClient();
  const msgDate = new Date(params.receivedAt);
  const dayBefore = new Date(msgDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayAfter = new Date(msgDate);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const from = dayBefore.toISOString().split("T")[0];
  const to = dayAfter.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("order_forecasts")
    .select("*, hospitals(name)")
    .eq("hospital_id", params.hospitalId)
    .eq("status", "pending")
    .gte("forecast_date", from)
    .lte("forecast_date", to)
    .order("forecast_date");

  if (error) throw error;
  return (data ?? []).map((row) => {
    const { hospitals: h, ...rest } = row as Record<string, unknown> & { hospitals: { name: string } | null };
    return { ...rest, hospital_name: h?.name ?? undefined } as OrderForecast;
  });
}

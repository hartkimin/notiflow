"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createForecast(data: {
  hospital_id: number;
  forecast_date: string;
  notes?: string;
  items?: Array<{
    product_id?: number | null;
    product_name?: string;
    quantity?: number;
    unit_type?: string;
  }>;
}) {
  const supabase = await createClient();

  const { data: forecast, error } = await supabase
    .from("order_forecasts")
    .insert({
      hospital_id: data.hospital_id,
      forecast_date: data.forecast_date,
      notes: data.notes || null,
      source: "manual",
    })
    .select("id")
    .single();
  if (error) throw error;

  if (data.items && data.items.length > 0) {
    const itemRows = data.items.map((item) => ({
      forecast_id: forecast.id,
      product_id: item.product_id ?? null,
      product_name: item.product_name ?? null,
      quantity: item.quantity ?? null,
      unit_type: item.unit_type ?? "piece",
    }));
    const { error: itemErr } = await supabase
      .from("forecast_items")
      .insert(itemRows);
    if (itemErr) throw itemErr;
  }

  revalidatePath("/messages");
  return { success: true, id: forecast.id };
}

export async function createForecastBatch(data: {
  hospital_id: number;
  dates: string[];
  notes?: string;
  items?: Array<{
    product_id?: number | null;
    product_name?: string;
    quantity?: number;
    unit_type?: string;
  }>;
}) {
  const supabase = await createClient();
  const results: { date: string; id: number }[] = [];

  for (const date of data.dates) {
    const { data: forecast, error } = await supabase
      .from("order_forecasts")
      .insert({
        hospital_id: data.hospital_id,
        forecast_date: date,
        notes: data.notes || null,
        source: "manual",
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") continue;
      throw error;
    }

    if (data.items && data.items.length > 0) {
      const itemRows = data.items.map((item) => ({
        forecast_id: forecast.id,
        product_id: item.product_id ?? null,
        product_name: item.product_name ?? null,
        quantity: item.quantity ?? null,
        unit_type: item.unit_type ?? "piece",
      }));
      await supabase.from("forecast_items").insert(itemRows);
    }

    results.push({ date, id: forecast.id });
  }

  revalidatePath("/messages");
  return { success: true, created: results.length, results };
}

export async function updateForecast(id: number, data: {
  notes?: string;
  status?: string;
  forecast_date?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("order_forecasts")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/messages");
  return { success: true };
}

export async function deleteForecast(id: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("order_forecasts")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/messages");
  return { success: true };
}

export async function matchForecast(forecastId: number, messageId: number) {
  const supabase = await createClient();

  const { error: fErr } = await supabase
    .from("order_forecasts")
    .update({
      status: "matched",
      message_id: messageId,
      matched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", forecastId);
  if (fErr) throw fErr;

  const { error: mErr } = await supabase
    .from("raw_messages")
    .update({ forecast_id: forecastId })
    .eq("id", messageId);
  if (mErr) throw mErr;

  revalidatePath("/messages");
  return { success: true };
}

export async function unmatchForecast(forecastId: number) {
  const supabase = await createClient();

  const { data: forecast } = await supabase
    .from("order_forecasts")
    .select("message_id")
    .eq("id", forecastId)
    .single();

  if (forecast?.message_id) {
    await supabase
      .from("raw_messages")
      .update({ forecast_id: null })
      .eq("id", forecast.message_id);
  }

  const { error } = await supabase
    .from("order_forecasts")
    .update({
      status: "pending",
      message_id: null,
      matched_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", forecastId);
  if (error) throw error;

  revalidatePath("/messages");
  return { success: true };
}

export async function getMatchingForecasts(hospitalId: number | null, receivedAt: string) {
  if (!hospitalId) return [];
  const { findMatchingForecasts } = await import("@/lib/queries/forecasts");
  return findMatchingForecasts({ hospitalId, receivedAt });
}

import { createClient } from "@/lib/supabase/server";
import type { Delivery } from "@/lib/types";

export async function getTodayDeliveries(): Promise<{ count: number; deliveries: Delivery[] }> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, count, error } = await supabase
    .from("orders")
    .select("*, hospitals(name)", { count: "exact" })
    .eq("delivery_date", today)
    .in("status", ["confirmed", "processing"])
    .order("created_at");

  if (error) throw error;

  const deliveries: Delivery[] = (data ?? []).map((row) => ({
    ...row,
    hospital_name: (row.hospitals as { name: string } | null)?.name,
    hospitals: undefined,
  }));

  return { count: count ?? 0, deliveries };
}

export async function markDelivered(orderId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw error;
  return { success: true };
}

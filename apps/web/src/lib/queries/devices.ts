import { createClient } from "@/lib/supabase/server";
import type { MobileDevice } from "@/lib/types";

export async function getDevices(): Promise<{ devices: MobileDevice[]; total: number }> {
  const supabase = await createClient();

  const { data, count, error } = await supabase
    .from("mobile_devices")
    .select("*", { count: "exact" })
    .order("last_sync_at", { ascending: false });

  if (error) throw error;

  // Fetch user names for all unique user_ids
  const userIds = [...new Set((data ?? []).map((r: Record<string, unknown>) => r.user_id as string))];
  const nameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      nameMap.set(p.id, p.name);
    }
  }

  const devices: MobileDevice[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    user_name: nameMap.get(row.user_id as string),
    device_name: row.device_name as string,
    device_model: row.device_model as string | null,
    app_version: row.app_version as string,
    os_version: row.os_version as string,
    platform: row.platform as string,
    is_active: row.is_active as boolean,
    last_sync_at: row.last_sync_at as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));

  return { devices, total: count ?? 0 };
}

import { createClient } from "@/lib/supabase/server";
import type { MobileDevice } from "@/lib/types";

export async function getDevices(): Promise<{ devices: MobileDevice[]; total: number }> {
  const supabase = await createClient();

  const { data, count, error } = await supabase
    .from("mobile_devices")
    .select("*, user_profiles(name)", { count: "exact" })
    .order("last_sync_at", { ascending: false });

  if (error) throw error;

  const devices: MobileDevice[] = (data ?? []).map((row: Record<string, unknown>) => {
    const profile = row.user_profiles as { name: string } | null;
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      user_name: profile?.name ?? undefined,
      device_name: row.device_name as string,
      device_model: row.device_model as string | null,
      app_version: row.app_version as string,
      os_version: row.os_version as string,
      platform: row.platform as string,
      is_active: row.is_active as boolean,
      last_sync_at: row.last_sync_at as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  });

  return { devices, total: count ?? 0 };
}

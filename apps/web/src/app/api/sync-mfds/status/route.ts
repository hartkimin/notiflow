import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/mfds-sync";

export async function GET() {
  const admin = createAdminSupabase();

  // Find active or partial sync
  const { data: active } = await admin
    .from("mfds_sync_logs")
    .select("id, source_type, sync_mode, total_fetched, total_upserted, next_page, api_total_count, status")
    .in("status", ["running", "partial"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get counts per source type
  const [drug, device] = await Promise.all([
    admin.from("mfds_items").select("id", { count: "exact", head: true }).eq("source_type", "drug"),
    admin.from("mfds_items").select("id", { count: "exact", head: true }).eq("source_type", "device_std"),
  ]);

  // Get meta
  const { data: meta } = await admin.from("mfds_sync_meta").select("*");

  return NextResponse.json({
    active: active ?? null,
    counts: {
      drug: drug.count ?? 0,
      device_std: device.count ?? 0,
    },
    meta: meta ?? [],
  });
}

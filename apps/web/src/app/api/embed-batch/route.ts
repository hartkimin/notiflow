import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/ai/embedding-service";

export const maxDuration = 120;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const table = url.searchParams.get("table") ?? "my_drugs";
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

  const admin = createAdminClient();
  const validTables = ["my_drugs", "my_devices", "hospitals"];
  if (!validTables.includes(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const nameCol = table === "my_drugs" ? "item_name" : table === "my_devices" ? "prdlst_nm" : "name";

  const { data: rows, error } = await admin
    .from(table)
    .select(`id, ${nameCol}`)
    .is("embedding", null)
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ processed: 0, message: "No rows to embed" });

  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    const text = (row as Record<string, unknown>)[nameCol] as string;
    if (!text) { failed++; continue; }
    try {
      const { embedding, model } = await generateEmbedding(text);
      await admin.from(table).update({
        embedding: JSON.stringify(embedding),
        embedding_model: model,
        embedded_at: new Date().toISOString(),
      }).eq("id", row.id);
      processed++;
    } catch { failed++; }
  }

  return NextResponse.json({ table, processed, failed, offset, limit });
}

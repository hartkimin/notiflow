import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAISettings } from "@/lib/ai-client";
import { aiParse, getHospitalAliases, resolveHospitalFromSender } from "@/lib/parse-service";
import { matchProductsBulk, type ProductCatalogEntry } from "@/lib/parser";

export async function POST(request: Request) {
  const body = await request.json();
  const { content, hospitalId, sender } = body as {
    content: string;
    hospitalId?: number;
    sender?: string;
  };

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const settings = await getAISettings();

  // For test parse, always use structured path (ignore custom prompt)
  const testSettings = { ...settings, ai_parse_prompt: null };

  let resolvedHospitalId = hospitalId ?? null;
  let hospitalName: string | null = null;
  let aliases: { alias: string; product_name: string }[] = [];

  if (!resolvedHospitalId && sender) {
    const resolved = await resolveHospitalFromSender(supabase, sender);
    if (resolved) {
      resolvedHospitalId = resolved.id;
    }
  }

  if (resolvedHospitalId) {
    const { data: hospital } = await supabase
      .from("hospitals")
      .select("name")
      .eq("id", resolvedHospitalId)
      .single();
    hospitalName = hospital?.name ?? null;
    aliases = await getHospitalAliases(supabase, resolvedHospitalId);
  }

  const { data: productRows } = await supabase
    .from("products")
    .select("official_name, short_name")
    .eq("is_active", true);

  const products: ProductCatalogEntry[] = (productRows ?? []).map(
    (p: { official_name: string; short_name: string | null }) => ({
      official_name: p.official_name,
      short_name: p.short_name,
    }),
  );

  const parseResult = await aiParse(content, testSettings, hospitalName, aliases, products);

  const matchedItems = parseResult.items.length > 0
    ? await matchProductsBulk(supabase, parseResult.items, resolvedHospitalId)
    : [];

  let matched = 0, review = 0, unmatched = 0;
  for (const m of matchedItems) {
    if (m.match.match_status === "matched") matched++;
    else if (m.match.match_status === "review") review++;
    else unmatched++;
  }

  return NextResponse.json({
    method: parseResult.method,
    ai_provider: parseResult.ai_provider ?? null,
    ai_model: parseResult.ai_model ?? null,
    latency_ms: parseResult.latency_ms,
    token_usage: parseResult.token_usage ?? null,
    warnings: parseResult.warnings,
    match_summary: { matched, review, unmatched },
    items: matchedItems.map((m) => ({
      original_text: m.parsed.item,
      product_official_name: m.match.product_name,
      quantity: m.parsed.qty,
      unit: m.parsed.unit,
      product_id: m.match.product_id,
      match_confidence: m.match.confidence,
      match_status: m.match.match_status,
      match_method: m.match.method,
    })),
  });
}

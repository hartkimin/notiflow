/**
 * POST /api/parse
 *
 * API route for parsing order messages. Called by Supabase Edge Functions
 * (parse-message, test-parse) after they've been converted to thin proxies.
 *
 * Authentication: x-parse-secret header must match PARSE_API_SECRET env var.
 *
 * Body:
 *   - message_id: number        — raw_messages.id
 *   - content: string           — message text to parse
 *   - hospital_id: number|null  — optional hospital for alias matching
 *   - force_order: boolean      — force order creation even with low confidence
 *   - test_only: boolean        — if true, parse + match but do NOT write to DB
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAISettingsFromClient,
  getHospitalAliases,
  aiParse,
  parseMessageCore,
} from "@/lib/parse-service";
import {
  matchProductsBulk,
  type ProductCatalogEntry,
} from "@/lib/parser";

export async function POST(req: Request) {
  // --- Auth: secret header ---
  const secret = req.headers.get("x-parse-secret");
  const expected = process.env.PARSE_API_SECRET;

  if (!expected) {
    console.error("[/api/parse] PARSE_API_SECRET env var not set");
    return NextResponse.json(
      { error: "Server misconfiguration: PARSE_API_SECRET not set" },
      { status: 500 },
    );
  }

  if (secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Parse body ---
  let body: {
    message_id?: number;
    content?: string;
    hospital_id?: number | null;
    force_order?: boolean;
    test_only?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message_id, content, hospital_id, force_order, test_only } = body;

  if (!content) {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 },
    );
  }

  if (!test_only && message_id == null) {
    return NextResponse.json(
      { error: "message_id is required for non-test requests" },
      { status: 400 },
    );
  }

  // --- Create admin Supabase client (no user session) ---
  const supabase = createAdminClient();

  try {
    // Load AI settings via admin client
    const settings = await getAISettingsFromClient(supabase);

    // ---- Test-only mode: parse + match, no DB writes ----
    if (test_only) {
      // Resolve hospital name + aliases
      let hospitalName: string | null = null;
      let aliases: { alias: string; product_name: string }[] = [];

      if (hospital_id) {
        const { data: hospital } = await supabase
          .from("hospitals")
          .select("name")
          .eq("id", hospital_id)
          .single();
        hospitalName = hospital?.name ?? null;
        aliases = await getHospitalAliases(supabase, hospital_id);
      }

      // Load product catalog
      const { data: productRows } = await supabase
        .from("products_catalog")
        .select("official_name, short_name")
        .eq("is_active", true);

      const products: ProductCatalogEntry[] = (productRows ?? []).map(
        (p: { official_name: string; short_name: string | null }) => ({
          official_name: p.official_name,
          short_name: p.short_name,
        }),
      );

      // AI parse
      const parseResult = await aiParse(content, settings, hospitalName, aliases, products);

      // Match products (but don't persist anything)
      const matchedItems = parseResult.items.length > 0
        ? await matchProductsBulk(supabase, parseResult.items, hospital_id)
        : [];

      return NextResponse.json({
        test_only: true,
        message_id: message_id ?? null,
        method: parseResult.method,
        ai_provider: parseResult.ai_provider ?? null,
        ai_model: parseResult.ai_model ?? null,
        latency_ms: parseResult.latency_ms,
        token_usage: parseResult.token_usage ?? null,
        warnings: parseResult.warnings,
        items: parseResult.items,
        matched_items: matchedItems.map((m) => ({
          item: m.parsed.item,
          qty: m.parsed.qty,
          unit: m.parsed.unit,
          product_id: m.match.product_id,
          product_name: m.match.product_name,
          confidence: m.match.confidence,
          match_status: m.match.match_status,
          method: m.match.method,
        })),
      });
    }

    // ---- Full pipeline mode (message_id guaranteed non-null by validation above) ----
    const result = await parseMessageCore(
      supabase,
      settings,
      message_id!,
      content,
      hospital_id ?? null,
      force_order ?? false,
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/parse] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

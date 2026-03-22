import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { escapeLikeValue } from "@/lib/supabase/sanitize";
import { parseMessage } from "@/lib/ai/parse-message";
import { matchProductsBulk } from "@/lib/ai/match-products";
import { createOrderFromParsedItems } from "@/lib/ai/create-order-from-parse";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.messageId) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  const { messageId, autoCreateOrder } = body;

  const { data: message, error: msgErr } = await supabase
    .from("captured_messages")
    .select("id, content, sender, app_name, room_name")
    .eq("id", messageId)
    .single();
  if (msgErr || !message) {
    return NextResponse.json({ error: "메시지를 찾을 수 없습니다." }, { status: 404 });
  }

  // Infer hospital from sender, room_name, and content
  let hospitalId: number | null = null;
  let hospitalName: string | null = null;

  // Collect search candidates from metadata
  const searchTexts = [
    message.room_name,         // "연세수요양병원 젠스코리아 발주" → "연세수요양병원"
    message.sender,            // "(바른요양)박주현" → "바른요양"
    message.content?.split("\n")[0], // first line may contain hospital name
  ].filter(Boolean) as string[];

  // Load all hospitals for matching
  const { data: allHospitals } = await supabase.from("hospitals").select("id, name, short_name");
  if (allHospitals?.length) {
    for (const text of searchTexts) {
      if (hospitalId) break;
      const lower = text.toLowerCase();
      // Try exact/partial match against hospital name and short_name
      for (const h of allHospitals) {
        const hName = h.name.toLowerCase();
        const hShort = (h.short_name ?? "").toLowerCase();
        if (lower.includes(hName) || hName.includes(lower) ||
            (hShort && (lower.includes(hShort) || hShort.includes(lower)))) {
          hospitalId = h.id;
          hospitalName = h.name;
          break;
        }
      }
    }
    // Fallback: try extracting text inside parentheses from sender — "(바른요양)박주현" → "바른요양"
    if (!hospitalId && message.sender) {
      const parenMatch = message.sender.match(/[（(]([^)）]+)[)）]/);
      if (parenMatch) {
        const extracted = parenMatch[1].toLowerCase();
        for (const h of allHospitals) {
          if (h.name.toLowerCase().includes(extracted) || extracted.includes(h.name.toLowerCase())) {
            hospitalId = h.id;
            hospitalName = h.name;
            break;
          }
        }
      }
    }
  }

  try {
    // Pass metadata for richer parsing context
    const parseContext = {
      sender: message.sender,
      roomName: message.room_name,
      appName: message.app_name,
    };
    const parseResult = await parseMessage(message.content, hospitalId, hospitalName, parseContext);
    const matchedItems = await matchProductsBulk(parseResult.items, hospitalId);

    // Store embedding for future few-shot retrieval (fire and forget)
    if (parseResult.confidence >= 0.7) {
      import("@/lib/ai/embedding-service").then(({ generateEmbedding }) =>
        generateEmbedding(message.content).then(({ embedding, model }) =>
          import("@/lib/ai/vector-search").then(({ storeMessageEmbedding }) =>
            storeMessageEmbedding(messageId, embedding, model)
          )
        )
      ).catch(() => {});
    }

    let order = null;
    if (autoCreateOrder && matchedItems.length > 0 && hospitalId) {
      order = await createOrderFromParsedItems(hospitalId, messageId, matchedItems);
    }

    return NextResponse.json({
      messageId, hospitalId, hospitalName,
      parse: {
        items: matchedItems,
        confidence: parseResult.confidence,
        method: parseResult.method,
        model: parseResult.model,
        durationMs: parseResult.durationMs,
      },
      order,
    });
  } catch (err) {
    console.error("[parse-message] Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

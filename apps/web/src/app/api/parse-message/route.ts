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
    .select("id, content, sender, app_name")
    .eq("id", messageId)
    .single();
  if (msgErr || !message) {
    return NextResponse.json({ error: "메시지를 찾을 수 없습니다." }, { status: 404 });
  }

  let hospitalId: number | null = null;
  let hospitalName: string | null = null;
  if (message.sender) {
    const { data: hospitals } = await supabase
      .from("hospitals")
      .select("id, name")
      .ilike("name", `%${escapeLikeValue(message.sender)}%`)
      .limit(1);
    if (hospitals?.length) {
      hospitalId = hospitals[0].id;
      hospitalName = hospitals[0].name;
    }
  }

  try {
    const parseResult = await parseMessage(message.content, hospitalId, hospitalName);
    const matchedItems = await matchProductsBulk(parseResult.items);

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

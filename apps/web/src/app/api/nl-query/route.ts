import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processNaturalLanguageQuery } from "@/lib/ai/nl-query-service";

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

  const question = body?.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  try {
    const result = await processNaturalLanguageQuery(question);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[nl-query] Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

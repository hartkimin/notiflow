import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ollamaHealthCheck, ollamaPreload, getOllamaBaseUrl, getOllamaModel } from "@/lib/ai/ollama-client";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await ollamaHealthCheck();

  // Preload model into memory if not loaded
  if (health.ok) ollamaPreload();

  return NextResponse.json({
    ...health,
    baseUrl: getOllamaBaseUrl(),
    configuredModel: getOllamaModel(),
    modelLoaded: health.models.some(m => m.startsWith(getOllamaModel().split(":")[0])),
  });
}

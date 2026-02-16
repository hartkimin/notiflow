import { createClient } from "@/lib/supabase/server";

export interface AISettings {
  ai_enabled: boolean;
  ai_model: string;
  ai_parse_prompt: string | null;
  ai_auto_process: boolean;
  ai_confidence_threshold: number;
}

export async function getSettings(): Promise<AISettings> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [
      "ai_enabled",
      "ai_model",
      "ai_parse_prompt",
      "ai_auto_process",
      "ai_confidence_threshold",
    ]);

  if (error) throw error;

  const map = new Map(
    (data ?? []).map((s: { key: string; value: unknown }) => [s.key, s.value]),
  );

  return {
    ai_enabled: map.get("ai_enabled") === true || map.get("ai_enabled") === "true",
    ai_model: (typeof map.get("ai_model") === "string"
      ? (map.get("ai_model") as string).replace(/^"|"$/g, "")
      : "claude-haiku-4-5-20251001"),
    ai_parse_prompt: (map.get("ai_parse_prompt") as string) ?? null,
    ai_auto_process: map.get("ai_auto_process") === true || map.get("ai_auto_process") === "true",
    ai_confidence_threshold: Number(map.get("ai_confidence_threshold") ?? 0.7),
  };
}

export async function updateSetting(key: string, value: unknown) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
  return { success: true };
}

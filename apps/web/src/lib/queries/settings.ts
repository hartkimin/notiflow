import { createClient } from "@/lib/supabase/server";

export type AIProvider = "anthropic" | "google" | "openai";

export interface AIApiKeyInfo {
  set: boolean;
  masked: string;
}

export interface AISettings {
  ai_enabled: boolean;
  ai_provider: AIProvider;
  ai_model: string;
  ai_parse_prompt: string | null;
  ai_auto_process: boolean;
  ai_confidence_threshold: number;
  sync_interval_minutes: number;
  ai_api_keys: Record<AIProvider, AIApiKeyInfo>;
}

function maskApiKey(key: unknown): AIApiKeyInfo {
  if (!key || typeof key !== "string" || key.length === 0) {
    return { set: false, masked: "" };
  }
  if (key.length <= 8) {
    return { set: true, masked: "****" + key.slice(-4) };
  }
  return { set: true, masked: key.slice(0, 7) + "..." + key.slice(-4) };
}

export async function getSettings(): Promise<AISettings> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [
      "ai_enabled",
      "ai_provider",
      "ai_model",
      "ai_parse_prompt",
      "ai_auto_process",
      "ai_confidence_threshold",
      "sync_interval_minutes",
      "ai_api_key_anthropic",
      "ai_api_key_google",
      "ai_api_key_openai",
    ]);

  if (error) throw error;

  const map = new Map(
    (data ?? []).map((s: { key: string; value: unknown }) => [s.key, s.value]),
  );

  const provider = (map.get("ai_provider") as string) ?? "anthropic";

  return {
    ai_enabled: map.get("ai_enabled") === true || map.get("ai_enabled") === "true",
    ai_provider: (["anthropic", "google", "openai"].includes(provider)
      ? provider as AIProvider
      : "anthropic"),
    ai_model: (typeof map.get("ai_model") === "string"
      ? (map.get("ai_model") as string).replace(/^"|"$/g, "")
      : "claude-haiku-4-5-20251001"),
    ai_parse_prompt: (map.get("ai_parse_prompt") as string) ?? null,
    ai_auto_process: map.get("ai_auto_process") === true || map.get("ai_auto_process") === "true",
    ai_confidence_threshold: Number(map.get("ai_confidence_threshold") ?? 0.7),
    sync_interval_minutes: Number(map.get("sync_interval_minutes") ?? 5),
    ai_api_keys: {
      anthropic: maskApiKey(map.get("ai_api_key_anthropic")),
      google: maskApiKey(map.get("ai_api_key_google")),
      openai: maskApiKey(map.get("ai_api_key_openai")),
    },
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

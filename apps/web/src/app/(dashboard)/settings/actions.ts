"use server";

import { requireAdmin } from "@/lib/auth";
import { updateSetting } from "@/lib/queries/settings";
import { revalidatePath } from "next/cache";

const ALLOWED_SETTING_KEYS = new Set([
  "ai_enabled",
  "ai_provider",
  "ai_model",
  "sync_interval_minutes",
  "ai_api_key_anthropic",
  "ai_api_key_google",
  "ai_api_key_openai",
  "drug_api_service_key",
  "order_display_columns",
  "order_column_widths",
]);

export async function updateSettingAction(key: string, value: unknown) {
  await requireAdmin();
  if (!ALLOWED_SETTING_KEYS.has(key)) {
    throw new Error(`허용되지 않은 설정 키입니다: ${key}`);
  }
  await updateSetting(key, value);
  revalidatePath("/settings");
  return { success: true };
}

export async function updateOrderDisplayColumnsAction(value: { drug: string[]; device: string[] }) {
  await requireAdmin();
  await updateSetting("order_display_columns", value);
  revalidatePath("/settings");
  revalidatePath("/orders");
}

// No requireAdmin() — column widths are a shared layout preference, not a security setting
export async function saveColumnWidthsAction(widths: Record<string, number>) {
  await updateSetting("order_column_widths", widths);
  revalidatePath("/orders");
}

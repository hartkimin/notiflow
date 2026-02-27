"use server";

import { updateSetting } from "@/lib/queries/settings";
import { revalidatePath } from "next/cache";

export async function updateSettingAction(key: string, value: unknown) {
  await updateSetting(key, value);
  revalidatePath("/settings");
  return { success: true };
}

export async function updateOrderDisplayColumnsAction(value: { drug: string[]; device: string[] }) {
  await updateSetting("order_display_columns", value);
  revalidatePath("/settings");
  revalidatePath("/orders");
}

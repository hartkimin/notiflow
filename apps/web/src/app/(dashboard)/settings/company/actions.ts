"use server";

import { requireAuth } from "@/lib/auth";
import { upsertCompanySettings } from "@/lib/queries/company-settings";
import { revalidatePath } from "next/cache";
import type { CompanySettings } from "@/lib/tax-invoice/types";

export async function upsertCompanySettingsAction(data: Partial<CompanySettings>) {
  await requireAuth();
  await upsertCompanySettings(data);
  revalidatePath("/settings/company");
  return { success: true };
}

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CompanySettings } from "@/lib/tax-invoice/types";

export async function getCompanySettings(): Promise<CompanySettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data as CompanySettings | null;
}

export async function upsertCompanySettings(
  settings: Partial<CompanySettings>
): Promise<CompanySettings> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("company_settings")
    .select("id")
    .limit(1)
    .single();

  if (existing) {
    const { data, error } = await admin
      .from("company_settings")
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as CompanySettings;
  }

  const { data, error } = await admin
    .from("company_settings")
    .insert({
      biz_no: settings.biz_no ?? "",
      company_name: settings.company_name ?? "",
      ...settings,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CompanySettings;
}

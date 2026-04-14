import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/geocode";
import { getOrgId } from "@/lib/org-context";
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
  const organization_id = await getOrgId();

  const { data: existing } = await admin
    .from("company_settings")
    .select("id")
    .eq("organization_id", organization_id)
    .limit(1)
    .single();

  // Auto-geocode when address changes
  if (settings.address && typeof settings.address === "string") {
    const coords = await geocodeAddress(settings.address).catch(() => null);
    if (coords) {
      (settings as Record<string, unknown>).lat = coords.lat;
      (settings as Record<string, unknown>).lng = coords.lng;
    }
  }

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
      organization_id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CompanySettings;
}

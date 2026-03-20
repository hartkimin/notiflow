import { createClient } from "@/lib/supabase/server";

export interface MapMarker {
  id: string;
  type: "hospital" | "supplier" | "company";
  name: string;
  address: string;
  lat?: number;
  lng?: number;
}

export async function getMapMarkers(): Promise<MapMarker[]> {
  const supabase = await createClient();
  const markers: MapMarker[] = [];

  // Hospitals with address
  const { data: hospitals } = await supabase
    .from("hospitals")
    .select("id, name, address")
    .not("address", "is", null)
    .eq("is_active", true);

  for (const h of hospitals ?? []) {
    if (h.address && h.address.trim().length > 3) {
      markers.push({
        id: `hospital-${h.id}`,
        type: "hospital",
        name: h.name,
        address: h.address,
      });
    }
  }

  // Suppliers with address
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, address")
    .not("address", "is", null)
    .eq("is_active", true);

  for (const s of suppliers ?? []) {
    if (s.address && s.address.trim().length > 3) {
      markers.push({
        id: `supplier-${s.id}`,
        type: "supplier",
        name: s.name,
        address: s.address,
      });
    }
  }

  // Company (self)
  const { data: company } = await supabase
    .from("company_settings")
    .select("company_name, address")
    .limit(1)
    .single();

  if (company?.address && company.address.trim().length > 3) {
    markers.push({
      id: "company",
      type: "company",
      name: company.company_name || "자사",
      address: company.address,
    });
  }

  return markers;
}

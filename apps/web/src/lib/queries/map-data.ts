import { createClient } from "@/lib/supabase/server";
import type { MapPin } from "@/components/partner-map";

export async function getMapPins(): Promise<MapPin[]> {
  const supabase = await createClient();
  const pins: MapPin[] = [];

  // Hospitals with coordinates
  const { data: hospitals } = await supabase
    .from("hospitals")
    .select("id, name, address, lat, lng")
    .not("lat", "is", null)
    .not("lng", "is", null)
    .eq("is_active", true);

  for (const h of hospitals ?? []) {
    pins.push({
      id: `hospital-${h.id}`,
      type: "hospital",
      name: h.name,
      address: h.address || "",
      lat: h.lat,
      lng: h.lng,
    });
  }

  // Suppliers with coordinates
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, address, lat, lng")
    .not("lat", "is", null)
    .not("lng", "is", null)
    .eq("is_active", true);

  for (const s of suppliers ?? []) {
    pins.push({
      id: `supplier-${s.id}`,
      type: "supplier",
      name: s.name,
      address: s.address || "",
      lat: s.lat,
      lng: s.lng,
    });
  }

  // Company
  const { data: company } = await supabase
    .from("company_settings")
    .select("company_name, address, lat, lng")
    .not("lat", "is", null)
    .limit(1)
    .single();

  if (company) {
    pins.push({
      id: "company",
      type: "company",
      name: company.company_name || "자사",
      address: company.address || "",
      lat: company.lat,
      lng: company.lng,
    });
  }

  return pins;
}

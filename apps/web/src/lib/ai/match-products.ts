import { createAdminClient } from "@/lib/supabase/admin";
import type { ParsedItem } from "./parse-message";

export interface MatchedItem extends ParsedItem {
  product_id: number | null;
  product_name_matched: string | null;
  match_level: number;
  match_confidence: number;
}

export async function matchProductsBulk(items: ParsedItem[]): Promise<MatchedItem[]> {
  if (items.length === 0) return [];
  const supabase = createAdminClient();

  const [{ data: drugs }, { data: devices }] = await Promise.all([
    supabase.from("my_drugs").select("id, item_name, bar_code, entp_name"),
    supabase.from("my_devices").select("id, prdlst_nm, udidi_cd, mnft_iprt_entp_nm"),
  ]);

  const allProducts = [
    ...(drugs ?? []).map(d => ({ id: d.id, name: d.item_name, code: d.bar_code, type: "drug" as const })),
    ...(devices ?? []).map(d => ({ id: d.id, name: d.prdlst_nm, code: d.udidi_cd, type: "device" as const })),
  ];

  return items.map(item => {
    if (item.matched_product) {
      const found = allProducts.find(p => p.name === item.matched_product);
      if (found) return { ...item, product_id: found.id, product_name_matched: found.name, match_level: 1, match_confidence: 0.95 };
    }
    const exactName = allProducts.find(p => p.name === item.item);
    if (exactName) return { ...item, product_id: exactName.id, product_name_matched: exactName.name, match_level: 2, match_confidence: 0.9 };
    const exactCode = allProducts.find(p => p.code === item.item);
    if (exactCode) return { ...item, product_id: exactCode.id, product_name_matched: exactCode.name, match_level: 3, match_confidence: 0.85 };
    const lowerItem = item.item.toLowerCase();
    const partialName = allProducts.find(p => p.name.toLowerCase().includes(lowerItem) || lowerItem.includes(p.name.toLowerCase()));
    if (partialName) return { ...item, product_id: partialName.id, product_name_matched: partialName.name, match_level: 4, match_confidence: 0.7 };
    if (item.matched_product) {
      const lowerMatched = item.matched_product.toLowerCase();
      const partialMatched = allProducts.find(p => p.name.toLowerCase().includes(lowerMatched) || lowerMatched.includes(p.name.toLowerCase()));
      if (partialMatched) return { ...item, product_id: partialMatched.id, product_name_matched: partialMatched.name, match_level: 5, match_confidence: 0.65 };
    }
    return { ...item, product_id: null, product_name_matched: null, match_level: 7, match_confidence: 0.3 };
  });
}

import { createAdminClient } from "@/lib/supabase/admin";
import { escapeLikeValue } from "@/lib/supabase/sanitize";
import type { ParsedItem } from "./parse-message";

export interface MatchedItem extends ParsedItem {
  product_id: number | null;
  product_name_matched: string | null;
  match_level: number;
  match_confidence: number;
}

interface ProductEntry {
  id: number;
  name: string;
  code: string | null;
  type: "drug" | "device";
}

/** Trigram similarity score (simple JS implementation) */
function trigramSimilarity(a: string, b: string): number {
  const trigramsOf = (s: string): Set<string> => {
    const padded = `  ${s.toLowerCase()}  `;
    const set = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
    return set;
  };
  const ta = trigramsOf(a);
  const tb = trigramsOf(b);
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export async function matchProductsBulk(items: ParsedItem[]): Promise<MatchedItem[]> {
  if (items.length === 0) return [];
  const supabase = createAdminClient();

  const [{ data: drugs }, { data: devices }] = await Promise.all([
    supabase.from("my_drugs").select("id, item_name, bar_code, entp_name"),
    supabase.from("my_devices").select("id, prdlst_nm, udidi_cd, mnft_iprt_entp_nm"),
  ]);

  const allProducts: ProductEntry[] = [
    ...(drugs ?? []).map(d => ({ id: d.id, name: d.item_name, code: d.bar_code, type: "drug" as const })),
    ...(devices ?? []).map(d => ({ id: d.id, name: d.prdlst_nm, code: d.udidi_cd, type: "device" as const })),
  ];

  return items.map(item => {
    // Level 1: matched_product exact match
    if (item.matched_product) {
      const found = allProducts.find(p => p.name === item.matched_product);
      if (found) return { ...item, product_id: found.id, product_name_matched: found.name, match_level: 1, match_confidence: 0.95 };
    }

    // Level 2: item text → product.name exact match
    const exactName = allProducts.find(p => p.name === item.item);
    if (exactName) return { ...item, product_id: exactName.id, product_name_matched: exactName.name, match_level: 2, match_confidence: 0.9 };

    // Level 3: item text → product code exact match
    const exactCode = allProducts.find(p => p.code === item.item);
    if (exactCode) return { ...item, product_id: exactCode.id, product_name_matched: exactCode.name, match_level: 3, match_confidence: 0.85 };

    // Level 4: item text → product.name partial match (contains)
    const lowerItem = item.item.toLowerCase();
    const partialName = allProducts.find(p =>
      p.name.toLowerCase().includes(lowerItem) || lowerItem.includes(p.name.toLowerCase())
    );
    if (partialName) return { ...item, product_id: partialName.id, product_name_matched: partialName.name, match_level: 4, match_confidence: 0.7 };

    // Level 5: matched_product → product.name partial match
    if (item.matched_product) {
      const lowerMatched = item.matched_product.toLowerCase();
      const partialMatched = allProducts.find(p =>
        p.name.toLowerCase().includes(lowerMatched) || lowerMatched.includes(p.name.toLowerCase())
      );
      if (partialMatched) return { ...item, product_id: partialMatched.id, product_name_matched: partialMatched.name, match_level: 5, match_confidence: 0.65 };
    }

    // Level 6: trigram similarity (fuzzy match)
    const searchTerms = [item.item, item.matched_product].filter(Boolean) as string[];
    let bestMatch: ProductEntry | null = null;
    let bestScore = 0;
    for (const term of searchTerms) {
      for (const p of allProducts) {
        const score = trigramSimilarity(term, p.name);
        if (score > bestScore) { bestScore = score; bestMatch = p; }
      }
    }
    if (bestMatch && bestScore >= 0.3) {
      return { ...item, product_id: bestMatch.id, product_name_matched: bestMatch.name, match_level: 6, match_confidence: Math.min(bestScore, 0.6) };
    }

    // Level 7: unmatched
    return { ...item, product_id: null, product_name_matched: null, match_level: 7, match_confidence: 0.3 };
  });
}

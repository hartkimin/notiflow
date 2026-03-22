import { createAdminClient } from "@/lib/supabase/admin";
import { escapeLikeValue } from "@/lib/supabase/sanitize";
import type { ParsedItem } from "./parse-message";

export interface MatchedItem extends ParsedItem {
  product_id: number | null;
  product_source: "drug" | "device" | "my_drug" | "my_device" | null;
  product_name_matched: string | null;
  standard_code: string | null;
  manufacturer: string | null;
  match_level: number;
  match_confidence: number;
}

/**
 * Match parsed items against DB products.
 * Search order: partner aliases → my_drugs/devices → mfds_drugs/devices (식약처 전체)
 */
export async function matchProductsBulk(
  items: ParsedItem[],
  hospitalId: number | null = null,
): Promise<MatchedItem[]> {
  if (items.length === 0) return [];
  const supabase = createAdminClient();

  const results: MatchedItem[] = [];

  for (const item of items) {
    const searchTerms = [item.item, item.matched_product].filter(Boolean) as string[];
    let matched: MatchedItem | null = null;

    // Level 1: Partner product aliases (hospital-specific)
    if (hospitalId && !matched) {
      for (const term of searchTerms) {
        const { data } = await supabase
          .from("partner_product_aliases")
          .select("alias, partner_products!inner(id, product_source, product_id)")
          .eq("alias_normalized", term.toLowerCase().replace(/[\s\p{P}]/gu, ""))
          .limit(1);
        if (data?.length) {
          const pp = (data[0] as unknown as { partner_products: { product_source: string; product_id: number } }).partner_products;
          // Fetch product name
          let name = term;
          if (pp.product_source === "drug") {
            const { data: d } = await supabase.from("my_drugs").select("item_name, bar_code").eq("id", pp.product_id).single();
            if (d) name = d.item_name;
          } else if (pp.product_source === "device") {
            const { data: d } = await supabase.from("my_devices").select("prdlst_nm, udidi_cd").eq("id", pp.product_id).single();
            if (d) name = d.prdlst_nm;
          }
          matched = { ...item, product_id: pp.product_id, product_source: pp.product_source as "drug" | "device", product_name_matched: name, standard_code: null, manufacturer: null, match_level: 1, match_confidence: 0.95 };
          break;
        }
      }
    }

    // Level 2: my_drugs exact/partial match
    if (!matched) {
      for (const term of searchTerms) {
        const escaped = escapeLikeValue(term);
        const { data } = await supabase.from("my_drugs")
          .select("id, item_name, bar_code, entp_name")
          .ilike("item_name", `%${escaped}%`)
          .limit(1);
        if (data?.length) {
          matched = { ...item, product_id: data[0].id, product_source: "my_drug", product_name_matched: data[0].item_name, standard_code: data[0].bar_code, manufacturer: data[0].entp_name, match_level: 2, match_confidence: 0.85 };
          break;
        }
      }
    }

    // Level 3: my_devices exact/partial match
    if (!matched) {
      for (const term of searchTerms) {
        const escaped = escapeLikeValue(term);
        const { data } = await supabase.from("my_devices")
          .select("id, prdlst_nm, udidi_cd, mnft_iprt_entp_nm")
          .ilike("prdlst_nm", `%${escaped}%`)
          .limit(1);
        if (data?.length) {
          matched = { ...item, product_id: data[0].id, product_source: "my_device", product_name_matched: data[0].prdlst_nm, standard_code: data[0].udidi_cd, manufacturer: data[0].mnft_iprt_entp_nm, match_level: 3, match_confidence: 0.8 };
          break;
        }
      }
    }

    // Level 4: mfds_drugs (식약처 의약품 전체 44K건) — 유사 검색
    if (!matched) {
      for (const term of searchTerms) {
        const escaped = escapeLikeValue(term);
        const { data } = await supabase.from("mfds_drugs")
          .select("id, item_name, bar_code, entp_name")
          .ilike("item_name", `%${escaped}%`)
          .order("item_name")
          .limit(3);
        if (data?.length) {
          // Pick best match (shortest name = most specific)
          const best = data.sort((a, b) => a.item_name.length - b.item_name.length)[0];
          matched = { ...item, product_id: best.id, product_source: "drug", product_name_matched: best.item_name, standard_code: best.bar_code, manufacturer: best.entp_name, match_level: 4, match_confidence: 0.7 };
          break;
        }
      }
    }

    // Level 5: mfds_devices (식약처 의료기기 전체 2.5M건) — 유사 검색
    if (!matched) {
      for (const term of searchTerms) {
        const escaped = escapeLikeValue(term);
        const { data } = await supabase.from("mfds_devices")
          .select("id, prdlst_nm, udidi_cd, mnft_iprt_entp_nm")
          .ilike("prdlst_nm", `%${escaped}%`)
          .order("prdlst_nm")
          .limit(3);
        if (data?.length) {
          const best = data.sort((a, b) => a.prdlst_nm.length - b.prdlst_nm.length)[0];
          matched = { ...item, product_id: best.id, product_source: "device", product_name_matched: best.prdlst_nm, standard_code: best.udidi_cd, manufacturer: best.mnft_iprt_entp_nm, match_level: 5, match_confidence: 0.6 };
          break;
        }
      }
    }

    // Level 6: Vector similarity search (requires embedding)
    if (!matched) {
      try {
        const { generateEmbedding } = await import("./embedding-service");
        const { searchProducts } = await import("./vector-search");
        const searchText = searchTerms.join(" ");
        const { embedding } = await generateEmbedding(searchText);
        const vectorMatches = await searchProducts(embedding, 1, 0.5);
        if (vectorMatches.length > 0) {
          const best = vectorMatches[0];
          matched = { ...item, product_id: best.id, product_source: best.type as "drug" | "device", product_name_matched: best.name, standard_code: null, manufacturer: null, match_level: 6, match_confidence: Math.min(best.similarity, 0.75) };
        }
      } catch { /* embedding not available, skip to unmatched */ }
    }

    // Level 7: Unmatched
    if (!matched) {
      matched = { ...item, product_id: null, product_source: null, product_name_matched: null, standard_code: null, manufacturer: null, match_level: 7, match_confidence: 0.3 };
    }

    results.push(matched);
  }

  return results;
}

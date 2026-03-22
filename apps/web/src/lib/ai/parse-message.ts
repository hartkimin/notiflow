import { createAdminClient } from "@/lib/supabase/admin";
import { ollamaChat } from "./ollama-client";
import { MESSAGE_PARSE_SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import type { AliasEntry, ProductCatalogEntry } from "./prompts";

export interface ParsedItem {
  item: string;
  qty: number;
  unit: string;
  matched_product: string | null;
}

export interface ParseResult {
  items: ParsedItem[];
  confidence: number;
  method: "ollama" | "cloud" | "regex";
  model: string;
  durationMs: number;
}

async function loadAliases(hospitalId: number | null): Promise<AliasEntry[]> {
  if (!hospitalId) return [];
  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("partner_products")
    .select("id, product_source, product_id")
    .eq("partner_type", "hospital")
    .eq("partner_id", hospitalId);
  if (!products?.length) return [];

  const ppIds = products.map(p => p.id);
  const [{ data: aliases }, { data: drugs }, { data: devices }] = await Promise.all([
    supabase.from("partner_product_aliases").select("alias, partner_product_id").in("partner_product_id", ppIds),
    supabase.from("my_drugs").select("id, item_name").in("id", products.filter(p => p.product_source === "drug").map(p => p.product_id)),
    supabase.from("my_devices").select("id, prdlst_nm").in("id", products.filter(p => p.product_source === "device").map(p => p.product_id)),
  ]);

  const nameMap = new Map<number, string>();
  for (const p of products) {
    const drug = drugs?.find(d => d.id === p.product_id);
    const device = devices?.find(d => d.id === p.product_id);
    nameMap.set(p.id, drug?.item_name ?? device?.prdlst_nm ?? "");
  }

  return (aliases ?? [])
    .filter(a => nameMap.get(a.partner_product_id))
    .map(a => ({ alias: a.alias, product_name: nameMap.get(a.partner_product_id)! }));
}

async function loadCatalog(): Promise<ProductCatalogEntry[]> {
  const supabase = createAdminClient();
  const [{ data: drugs }, { data: devices }] = await Promise.all([
    supabase.from("my_drugs").select("id, item_name, bar_code").limit(30),
    supabase.from("my_devices").select("id, prdlst_nm, udidi_cd").limit(30),
  ]);
  const results: ProductCatalogEntry[] = [];
  for (const d of drugs ?? []) results.push({ id: d.id, name: d.item_name, standard_code: d.bar_code });
  for (const d of devices ?? []) results.push({ id: d.id, name: d.prdlst_nm, standard_code: d.udidi_cd });
  return results;
}

function parseItemsFromJson(text: string): { items: ParsedItem[]; confidence: number } {
  // Extract JSON from potentially markdown-wrapped response
  let cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
  // If response contains explanation text, extract just the JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*"items"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];
  const parsed = JSON.parse(cleaned);
  const rawItems = parsed.items ?? parsed ?? [];
  const items: ParsedItem[] = (Array.isArray(rawItems) ? rawItems : []).map((item: Record<string, unknown>) => ({
    item: String(item.item ?? ""),
    qty: Number(item.qty ?? 1),
    unit: String(item.unit ?? "piece"),
    matched_product: item.matched_product ? String(item.matched_product) : null,
  }));
  return { items, confidence: Number(parsed.confidence ?? 0.8) };
}

export async function parseMessage(
  messageContent: string,
  hospitalId: number | null,
  hospitalName: string | null,
): Promise<ParseResult> {
  const [aliases, catalog] = await Promise.all([loadAliases(hospitalId), loadCatalog()]);
  const userPrompt = buildUserPrompt(hospitalName, aliases, catalog, messageContent);
  const startMs = Date.now();

  // 1st: Ollama
  try {
    const result = await ollamaChat(MESSAGE_PARSE_SYSTEM_PROMPT, userPrompt);
    const { items, confidence } = parseItemsFromJson(result.text);
    return { items, confidence, method: "ollama", model: "qwen3.5:9b", durationMs: Date.now() - startMs };
  } catch (ollamaErr) {
    console.warn("[parseMessage] Ollama failed:", (ollamaErr as Error).message);
  }

  // 2nd: Claude API fallback
  try {
    const supabase = createAdminClient();
    const { data: keySetting } = await supabase.from("settings").select("value").eq("key", "ai_api_key_anthropic").single();
    const apiKey = keySetting?.value as string;
    if (apiKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", max_tokens: 1024,
          system: MESSAGE_PARSE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "{}";
        const { items, confidence } = parseItemsFromJson(text);
        return { items, confidence, method: "cloud", model: "claude-haiku", durationMs: Date.now() - startMs };
      }
    }
  } catch { /* fall through */ }

  // 3rd: regex fallback
  console.warn("[parseMessage] All AI failed, using regex");
  return { items: regexParse(messageContent), confidence: 0.5, method: "regex", model: "regex", durationMs: Date.now() - startMs };
}

function regexParse(content: string): ParsedItem[] {
  const lines = content.split(/\n/).map(l => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];
  const pattern = /^(.+?)\s+(\d+)\s*(박스|box|bx|개|ea|봉|팩|pack|세트|set|병|bottle|통|캔|can|매|장|sheet|롤|roll)?$/i;
  const unitMap: Record<string, string> = {
    "박스": "box", "box": "box", "bx": "box", "개": "piece", "ea": "piece",
    "봉": "pack", "팩": "pack", "pack": "pack", "세트": "set", "set": "set",
    "병": "bottle", "bottle": "bottle", "통": "can", "캔": "can", "can": "can",
    "매": "sheet", "장": "sheet", "sheet": "sheet", "롤": "roll", "roll": "roll",
  };
  for (const line of lines) {
    const m = line.match(pattern);
    if (m) items.push({ item: m[1].trim(), qty: parseInt(m[2], 10), unit: unitMap[m[3]?.toLowerCase() ?? ""] ?? "piece", matched_product: null });
  }
  return items;
}

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100; // Korean gov API max 500, use 100 for memory safety
const MAX_PAGES = 20; // 2,000 items per invocation

interface ApiConfig {
  url: string;
  sourceKeyField: string;
  itemNameField: string;
  manufacturerField: string;
  standardCodeField: string;
  permitDateField: string;
}

const API_CONFIGS: Record<string, ApiConfig> = {
  drug: {
    url: "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06",
    sourceKeyField: "ITEM_SEQ",
    itemNameField: "ITEM_NAME",
    manufacturerField: "ENTP_NAME",
    standardCodeField: "BAR_CODE",
    permitDateField: "ITEM_PERMIT_DATE",
  },
  device_std: {
    url: "https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03/getMdeqStdCdPrdtInfoInq03",
    sourceKeyField: "UDIDI_CD",
    itemNameField: "PRDLST_NM",
    manufacturerField: "MNFT_IPRT_ENTP_NM",
    standardCodeField: "UDIDI_CD",
    permitDateField: "PRMSN_YMD",
  },
};

function parseMfdsApiItems(
  body: Record<string, unknown>,
): Record<string, unknown>[] {
  if (!body) return [];
  const items = body.items;
  if (!items) return [];
  if (Array.isArray(items))
    return items as Record<string, unknown>[];
  const obj = items as Record<string, unknown>;
  const item = obj.item;
  if (!item) return [];
  if (Array.isArray(item))
    return item as Record<string, unknown>[];
  return [item as Record<string, unknown>];
}

async function fetchPage(
  config: ApiConfig,
  apiKey: string,
  page: number,
): Promise<{ items: Record<string, unknown>[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: String(page),
    numOfRows: String(PAGE_SIZE),
    type: "json",
  });

  const res = await fetch(`${config.url}?${params}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const body = json?.body;

  return {
    items: parseMfdsApiItems(body),
    totalCount: (body?.totalCount as number) ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Verify caller identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Missing Authorization header", 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return errorResponse("Invalid or expired token", 401);
    }

    // 2. Parse request
    const body = await req.json();
    const sourceType: string = body.sourceType; // 'drug' | 'device_std'
    const startPage: number = body.page ?? 1;
    const apiKey: string = body.apiKey;

    if (!sourceType || !apiKey) {
      return errorResponse("sourceType and apiKey are required");
    }

    const config = API_CONFIGS[sourceType];
    if (!config) {
      return errorResponse(`Unknown sourceType: ${sourceType}`);
    }

    // 3. Fetch pages and UPSERT
    let totalFetched = 0;
    let totalUpserted = 0;
    let currentPage = startPage;
    let hasMore = false;

    for (let i = 0; i < MAX_PAGES; i++) {
      const { items, totalCount } = await fetchPage(
        config,
        apiKey,
        currentPage,
      );

      if (items.length === 0) break;
      totalFetched += items.length;

      // Batch UPSERT (build array, single call)
      const rows = items
        .map((item) => {
          const sourceKey = String(
            item[config.sourceKeyField] ?? "",
          );
          if (!sourceKey) return null;
          return {
            source_type: sourceType,
            source_key: sourceKey,
            item_name: String(item[config.itemNameField] ?? ""),
            manufacturer: String(
              item[config.manufacturerField] ?? "",
            ),
            standard_code: String(
              item[config.standardCodeField] ?? "",
            ),
            permit_date: String(
              item[config.permitDateField] ?? "",
            ),
            raw_data: item,
            synced_at: new Date().toISOString(),
          };
        })
        .filter(Boolean);

      if (rows.length > 0) {
        const { error, count } = await supabase
          .from("mfds_items")
          .upsert(rows, {
            onConflict: "source_type,source_key",
            count: "exact",
          });

        if (error) {
          console.error("UPSERT error:", error.message);
        } else {
          totalUpserted += count ?? rows.length;
        }
      }

      // Check if more pages remain
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      currentPage++;
      if (currentPage > totalPages) break;
      hasMore = currentPage <= totalPages;
    }

    return jsonResponse({
      success: true,
      totalFetched,
      totalUpserted,
      nextPage: hasMore ? currentPage : null,
      hasMore,
    });
  } catch (err) {
    console.error("sync-mfds error:", err);
    return errorResponse(
      `Internal error: ${(err as Error).message}`,
      500,
    );
  }
});

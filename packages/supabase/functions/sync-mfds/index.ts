import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

// --- Field extraction helper (handles variable API key casing) ---

function gf(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    if (r[k] != null && String(r[k]).trim() !== "" && String(r[k]).trim() !== "별첨") {
      return String(r[k]);
    }
  }
  return null;
}

// --- Parse variable MFDS API response structures ---

function parseApiItems(body: Record<string, unknown>): unknown[] {
  if (!body) return [];
  const items = body.items as unknown;
  if (Array.isArray(items)) {
    return items.map((wrapper: Record<string, unknown>) => wrapper.item ?? wrapper);
  }
  if (items && typeof items === "object") {
    const obj = items as Record<string, unknown>;
    if (obj.item) {
      return Array.isArray(obj.item) ? obj.item : [obj.item];
    }
  }
  return [];
}

// --- API Configurations ---

type SourceType = "drug" | "device" | "device_std";

interface ApiConfig {
  baseUrl: string;
  mapItem: (r: Record<string, unknown>) => Record<string, unknown>;
}

function nullDeviceFields() {
  return { mnsc_nm: null, mnsc_natn_cd: null, prmsn_dclr_divs_nm: null };
}

function nullDeviceStdFields() {
  return {
    foml_info: null, hmbd_trspt_mdeq_yn: null, dspsbl_mdeq_yn: null,
    trck_mng_trgt_yn: null, total_dev: null, cmbnmd_yn: null,
    use_before_strlzt_need_yn: null, sterilization_method: null,
    strg_cnd_info: null, circ_cnd_info: null, rcprslry_trgt_yn: null,
  };
}

function nullDrugFields() {
  return { edi_code: null, atc_code: null, main_item_ingr: null, bizrno: null, rare_drug_yn: null };
}

const API_CONFIGS: Record<SourceType, ApiConfig> = {
  drug: {
    baseUrl: "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06",
    mapItem: (r) => ({
      source_type: "drug",
      source_key: gf(r, "ITEM_SEQ", "item_seq") ?? "",
      item_name: gf(r, "ITEM_NAME", "item_name") ?? "",
      manufacturer: gf(r, "ENTP_NAME", "entp_name"),
      permit_no: gf(r, "ENTP_NO", "entp_no"),
      permit_date: gf(r, "ITEM_PERMIT_DATE", "item_permit_date"),
      standard_code: gf(r, "BAR_CODE", "bar_code"),
      classification_no: null, classification_grade: null,
      product_name: null, use_purpose: null,
      edi_code: gf(r, "EDI_CODE", "edi_code"),
      atc_code: gf(r, "ATC_CODE", "atc_code"),
      main_item_ingr: gf(r, "MAIN_ITEM_INGR", "main_item_ingr"),
      bizrno: gf(r, "BIZRNO", "bizrno"),
      rare_drug_yn: gf(r, "RARE_DRUG_YN", "rare_drug_yn"),
      ...nullDeviceFields(), ...nullDeviceStdFields(),
    }),
  },
  device: {
    baseUrl: "https://apis.data.go.kr/1471000/MdeqPrdlstInfoService02/getMdeqPrdlstInfoInq02",
    mapItem: (r) => ({
      source_type: "device",
      source_key: gf(r, "MDEQ_PRDLST_SN", "mdeq_prdlst_sn") ?? "",
      item_name: gf(r, "PRDLST_NM", "prdlst_nm") ?? "",
      manufacturer: gf(r, "MNFT_CLNT_NM", "mnft_clnt_nm"),
      permit_no: gf(r, "MEDDEV_ITEM_NO", "meddev_item_no"),
      permit_date: gf(r, "PRMSN_YMD", "prmsn_ymd"),
      standard_code: null,
      classification_no: gf(r, "MDEQ_CLSF_NO", "mdeq_clsf_no"),
      classification_grade: gf(r, "CLSF_NO_GRAD_CD", "clsf_no_grad_cd"),
      product_name: gf(r, "PRDT_NM_INFO", "prdt_nm_info"),
      use_purpose: gf(r, "USE_PURPS_CONT", "use_purps_cont"),
      ...nullDrugFields(),
      mnsc_nm: gf(r, "MNSC_NM", "mnsc_nm"),
      mnsc_natn_cd: gf(r, "MNSC_NATN_CD", "mnsc_natn_cd"),
      prmsn_dclr_divs_nm: gf(r, "PRMSN_DCLR_DIVS_NM", "prmsn_dclr_divs_nm"),
      ...nullDeviceStdFields(),
    }),
  },
  device_std: {
    baseUrl: "https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03/getMdeqStdCdPrdtInfoInq03",
    mapItem: (r) => ({
      source_type: "device_std",
      source_key: gf(r, "UDIDI_CD", "udidi_cd") ?? "",
      item_name: gf(r, "PRDLST_NM", "prdlst_nm") ?? "",
      manufacturer: gf(r, "MNFT_IPRT_ENTP_NM", "mnft_iprt_entp_nm"),
      permit_no: gf(r, "PERMIT_NO", "permit_no"),
      permit_date: gf(r, "PRMSN_YMD", "prmsn_ymd"),
      standard_code: gf(r, "UDIDI_CD", "udidi_cd"),
      classification_no: gf(r, "MDEQ_CLSF_NO", "mdeq_clsf_no"),
      classification_grade: gf(r, "CLSF_NO_GRAD_CD", "clsf_no_grad_cd"),
      product_name: gf(r, "PRDT_NM_INFO", "prdt_nm_info"),
      use_purpose: gf(r, "USE_PURPS_CONT", "use_purps_cont"),
      ...nullDrugFields(), ...nullDeviceFields(),
      foml_info: gf(r, "FOML_INFO", "foml_info"),
      hmbd_trspt_mdeq_yn: gf(r, "HMBD_TRSPT_MDEQ_YN", "hmbd_trspt_mdeq_yn"),
      dspsbl_mdeq_yn: gf(r, "DSPSBL_MDEQ_YN", "dspsbl_mdeq_yn"),
      trck_mng_trgt_yn: gf(r, "TRCK_MNG_TRGT_YN", "trck_mng_trgt_yn"),
      total_dev: gf(r, "TOTAL_DEV", "total_dev"),
      cmbnmd_yn: gf(r, "CMBNMD_YN", "cmbnmd_yn"),
      use_before_strlzt_need_yn: gf(r, "USE_BEFORE_STRLZT_NEED_YN", "use_before_strlzt_need_yn"),
      sterilization_method: gf(r, "STERILIZATION_METHOD_NM", "sterilization_method_nm"),
      strg_cnd_info: gf(r, "STRG_CND_INFO", "strg_cnd_info"),
      circ_cnd_info: gf(r, "CIRC_CND_INFO", "circ_cnd_info"),
      rcprslry_trgt_yn: gf(r, "RCPRSLRY_TRGT_YN", "rcprslry_trgt_yn"),
    }),
  },
};

// --- Main handler ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const trigger: string = body.trigger ?? "manual";
    const sourceFilter: string = body.source ?? "all";
    const userId: string | null = body.user_id ?? null;

    // Check for already-running sync
    const { data: running } = await supabase
      .from("mfds_sync_logs")
      .select("id")
      .eq("status", "running")
      .limit(1);

    if (running && running.length > 0) {
      return errorResponse("이미 동기화가 진행 중입니다.", 409);
    }

    // Get API key from settings
    const { data: settingRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "drug_api_service_key")
      .single();

    const serviceKey =
      typeof settingRow?.value === "string" && settingRow.value.length > 0
        ? settingRow.value
        : null;

    if (!serviceKey) {
      return errorResponse("API 키가 설정되지 않았습니다.", 422);
    }

    // Create sync log entry
    const { data: logRow, error: logError } = await supabase
      .from("mfds_sync_logs")
      .insert({
        trigger_type: trigger,
        triggered_by: userId,
        source_filter: sourceFilter,
        status: "running",
      })
      .select("id, started_at")
      .single();

    if (logError || !logRow) {
      return errorResponse("동기화 로그 생성 실패", 500);
    }

    const logId = logRow.id;
    const syncStartedAt = logRow.started_at;
    const startTime = Date.now();

    const stats: Record<string, number> = {
      drug_total: 0, drug_added: 0, drug_updated: 0,
      device_total: 0, device_added: 0, device_updated: 0,
      device_std_total: 0, device_std_added: 0, device_std_updated: 0,
      products_updated: 0,
    };

    const sources: SourceType[] =
      sourceFilter === "all"
        ? ["drug", "device", "device_std"]
        : [sourceFilter as SourceType];

    const errors: string[] = [];

    for (const source of sources) {
      try {
        const config = API_CONFIGS[source];
        let page = 1;
        const numOfRows = 100;
        let totalCount = 0;
        let added = 0;
        let updated = 0;

        while (true) {
          const params = new URLSearchParams({
            serviceKey,
            pageNo: String(page),
            numOfRows: String(numOfRows),
            type: "json",
          });

          const res = await fetch(`${config.baseUrl}?${params.toString()}`);
          if (!res.ok) {
            errors.push(`${source} API HTTP ${res.status} at page ${page}`);
            break;
          }

          const data = await res.json();
          const apiBody = data.body;
          if (!apiBody) break;

          if (page === 1) {
            totalCount = apiBody.totalCount ?? 0;
            console.log(`[sync-mfds] ${source}: totalCount=${totalCount}`);
          }

          const rawItems = parseApiItems(apiBody);
          if (rawItems.length === 0) break;

          const mapped = rawItems
            .map((raw) => config.mapItem(raw as Record<string, unknown>))
            .filter((item) => (item.source_key as string) !== "");

          if (mapped.length > 0) {
            const { data: upserted, error: upsertError } = await supabase
              .from("mfds_items")
              .upsert(mapped, {
                onConflict: "source_type,source_key",
                ignoreDuplicates: false,
              })
              .select("id, created_at, updated_at");

            if (upsertError) {
              errors.push(`${source} upsert error page ${page}: ${upsertError.message}`);
              break;
            }

            for (const row of upserted ?? []) {
              // If created_at equals updated_at, it was just inserted (new)
              if (row.created_at === row.updated_at) {
                added++;
              } else {
                updated++;
              }
            }
          }

          if (page * numOfRows >= totalCount) break;
          page++;
        }

        // Prefix mapping: "device_std" -> "device_std_", "drug" -> "drug_", "device" -> "device_"
        const prefix = source === "device_std" ? "device_std" : source;
        stats[`${prefix}_total`] = totalCount;
        stats[`${prefix}_added`] = added;
        stats[`${prefix}_updated`] = updated;

        console.log(`[sync-mfds] ${source}: done (added=${added}, updated=${updated})`);
      } catch (err) {
        errors.push(`${source}: ${(err as Error).message}`);
        console.error(`[sync-mfds] ${source} error:`, err);
      }
    }

    // Auto-update linked products
    try {
      const { data: rpcResult } = await supabase.rpc("update_products_from_mfds", {
        sync_started: syncStartedAt,
      });
      stats.products_updated = typeof rpcResult === "number" ? rpcResult : 0;
    } catch (err) {
      errors.push(`products update: ${(err as Error).message}`);
    }

    // Finalize sync log
    const finalStatus = errors.length > 0 ? "failed" : "success";
    await supabase
      .from("mfds_sync_logs")
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error_message: errors.length > 0 ? errors.join("; ") : null,
        ...stats,
      })
      .eq("id", logId);

    return jsonResponse({
      success: errors.length === 0,
      log_id: logId,
      stats,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("sync-mfds unexpected error:", err);
    return errorResponse(`Internal server error: ${(err as Error).message}`, 500);
  }
});

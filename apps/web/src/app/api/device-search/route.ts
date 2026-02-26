import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DeviceSearchResult } from "@/lib/types";

const BASE_URL = "https://apis.data.go.kr/1471000/MdeqPrdlstInfoService02";

function getField(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    if (r[k] != null && String(r[k]).trim() !== "" && String(r[k]).trim() !== "별첨") {
      return String(r[k]);
    }
  }
  return null;
}

async function getApiKey(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "drug_api_service_key")
    .single();
  const val = data?.value;
  return typeof val === "string" && val.length > 0 ? val : null;
}

export async function GET(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim();
  const page = Number(searchParams.get("page") ?? "1");
  const size = Number(searchParams.get("size") ?? "10");

  if (!query) {
    return NextResponse.json({ error: "query parameter is required" }, { status: 400 });
  }

  const serviceKey = await getApiKey();
  if (!serviceKey) {
    return NextResponse.json(
      { error: "의약품 API 키가 설정되지 않았습니다. 설정 페이지에서 공공데이터포털 인증키를 등록해주세요." },
      { status: 422 },
    );
  }

  try {
    const params = new URLSearchParams({
      serviceKey,
      pageNo: String(page),
      numOfRows: String(size),
      type: "json",
      PRDLST_NM: query,
    });

    const apiUrl = `${BASE_URL}/getMdeqPrdlstInfoInq02?${params.toString()}`;
    const res = await fetch(apiUrl, { next: { revalidate: 0 } });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `식약처 API 오류 (${res.status}): ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = await res.json();

    const body = data.body;
    if (!body) {
      return NextResponse.json({ items: [], totalCount: 0, pageNo: page, numOfRows: size });
    }

    const totalCount = body.totalCount ?? 0;

    // Response: body.items is array of { item: {...} }
    let rawItems: unknown[];
    if (Array.isArray(body.items)) {
      rawItems = body.items.map((wrapper: Record<string, unknown>) => wrapper.item ?? wrapper);
    } else if (body.items?.item) {
      rawItems = Array.isArray(body.items.item) ? body.items.item : [body.items.item];
    } else {
      rawItems = [];
    }

    const items: DeviceSearchResult[] = rawItems.map((raw: unknown) => {
      const r = raw as Record<string, unknown>;
      return {
        prdlst_sn: getField(r, "MDEQ_PRDLST_SN", "mdeq_prdlst_sn") ?? "",
        prdlst_nm: getField(r, "PRDLST_NM", "prdlst_nm") ?? "",
        meddev_item_no: getField(r, "MEDDEV_ITEM_NO", "meddev_item_no") ?? "",
        mnft_clnt_nm: getField(r, "MNFT_CLNT_NM", "mnft_clnt_nm") ?? "",
        mnsc_nm: getField(r, "MNSC_NM", "mnsc_nm"),
        mnsc_natn_cd: getField(r, "MNSC_NATN_CD", "mnsc_natn_cd"),
        use_purps_cont: getField(r, "USE_PURPS_CONT", "use_purps_cont"),
        prmsn_ymd: getField(r, "PRMSN_YMD", "prmsn_ymd"),
        prmsn_dclr_divs_nm: getField(r, "PRMSN_DCLR_DIVS_NM", "prmsn_dclr_divs_nm"),
        mdeq_clsf_no: getField(r, "MDEQ_CLSF_NO", "mdeq_clsf_no"),
        clsf_no_grad_cd: getField(r, "CLSF_NO_GRAD_CD", "clsf_no_grad_cd"),
        prdt_nm_info: getField(r, "PRDT_NM_INFO", "prdt_nm_info"),
      };
    });

    return NextResponse.json({ items, totalCount, pageNo: page, numOfRows: size });
  } catch (err) {
    return NextResponse.json(
      { error: `의료기기 검색 실패: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}

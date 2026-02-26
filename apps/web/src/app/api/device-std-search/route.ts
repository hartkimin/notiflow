import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DeviceStdSearchResult } from "@/lib/types";

const BASE_URL =
  "https://apis.data.go.kr/1471000/MdeqStdCdPrdtInfoService03";

function getField(
  r: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const k of keys) {
    if (
      r[k] != null &&
      String(r[k]).trim() !== "" &&
      String(r[k]).trim() !== "별첨"
    ) {
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim();
  const udidi = searchParams.get("udidi")?.trim();
  const model = searchParams.get("model")?.trim();
  const entp = searchParams.get("entp")?.trim();
  const page = Number(searchParams.get("page") ?? "1");
  const size = Number(searchParams.get("size") ?? "10");

  if (!query && !udidi && !model && !entp) {
    return NextResponse.json(
      { error: "최소 하나의 검색 조건을 입력해주세요." },
      { status: 400 },
    );
  }

  const serviceKey = await getApiKey();
  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          "의약품 API 키가 설정되지 않았습니다. 설정 페이지에서 공공데이터포털 인증키를 등록해주세요.",
      },
      { status: 422 },
    );
  }

  try {
    const params = new URLSearchParams({
      serviceKey,
      pageNo: String(page),
      numOfRows: String(size),
      type: "json",
    });

    if (query) params.set("PRDLST_NM", query);
    if (udidi) params.set("UDIDI_CD", udidi);
    if (model) params.set("FOML_INFO", model);
    if (entp) params.set("MNFT_IPRT_ENTP_NM", entp);

    const apiUrl = `${BASE_URL}/getMdeqStdCdPrdtInfoInq03?${params.toString()}`;
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
      return NextResponse.json({
        items: [],
        totalCount: 0,
        pageNo: page,
        numOfRows: size,
      });
    }

    const totalCount = body.totalCount ?? 0;

    let rawItems: unknown[];
    if (Array.isArray(body.items)) {
      rawItems = body.items;
    } else if (body.items?.item) {
      rawItems = Array.isArray(body.items.item)
        ? body.items.item
        : [body.items.item];
    } else {
      rawItems = [];
    }

    const items: DeviceStdSearchResult[] = rawItems.map((raw: unknown) => {
      const r = raw as Record<string, unknown>;
      return {
        udidi_cd: getField(r, "UDIDI_CD", "udidi_cd") ?? "",
        prdlst_nm: getField(r, "PRDLST_NM", "prdlst_nm") ?? "",
        mdeq_clsf_no: getField(r, "MDEQ_CLSF_NO", "mdeq_clsf_no"),
        clsf_no_grad_cd: getField(r, "CLSF_NO_GRAD_CD", "clsf_no_grad_cd"),
        permit_no: getField(r, "PERMIT_NO", "permit_no"),
        prmsn_ymd: getField(r, "PRMSN_YMD", "prmsn_ymd"),
        foml_info: getField(r, "FOML_INFO", "foml_info"),
        prdt_nm_info: getField(r, "PRDT_NM_INFO", "prdt_nm_info"),
        hmbd_trspt_mdeq_yn: getField(
          r,
          "HMBD_TRSPT_MDEQ_YN",
          "hmbd_trspt_mdeq_yn",
        ),
        dspsbl_mdeq_yn: getField(r, "DSPSBL_MDEQ_YN", "dspsbl_mdeq_yn"),
        trck_mng_trgt_yn: getField(
          r,
          "TRCK_MNG_TRGT_YN",
          "trck_mng_trgt_yn",
        ),
        total_dev: getField(r, "TOTAL_DEV", "total_dev"),
        cmbnmd_yn: getField(r, "CMBNMD_YN", "cmbnmd_yn"),
        use_before_strlzt_need_yn: getField(
          r,
          "USE_BEFORE_STRLZT_NEED_YN",
          "use_before_strlzt_need_yn",
        ),
        sterilization_method_nm: getField(
          r,
          "STERILIZATION_METHOD_NM",
          "sterilization_method_nm",
        ),
        use_purps_cont: getField(r, "USE_PURPS_CONT", "use_purps_cont"),
        strg_cnd_info: getField(r, "STRG_CND_INFO", "strg_cnd_info"),
        circ_cnd_info: getField(r, "CIRC_CND_INFO", "circ_cnd_info"),
        mnft_iprt_entp_nm: getField(
          r,
          "MNFT_IPRT_ENTP_NM",
          "mnft_iprt_entp_nm",
        ),
        rcprslry_trgt_yn: getField(
          r,
          "RCPRSLRY_TRGT_YN",
          "rcprslry_trgt_yn",
        ),
      };
    });

    return NextResponse.json({ items, totalCount, pageNo: page, numOfRows: size });
  } catch (err) {
    return NextResponse.json(
      {
        error: `의료기기 표준코드 검색 실패: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    );
  }
}

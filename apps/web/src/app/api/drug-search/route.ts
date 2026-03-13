import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DrugSearchResult } from "@/lib/types";

const BASE_URL = "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07";

function getField(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    if (r[k] != null && String(r[k]).trim() !== "") return String(r[k]);
  }
  return null;
}

async function getDrugApiKey(): Promise<string | null> {
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

  // Auth check
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

  const serviceKey = await getDrugApiKey();
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
      item_name: query,
    });

    const apiUrl = `${BASE_URL}/getDrugPrdtPrmsnDtlInq06?${params.toString()}`;
    const res = await fetch(apiUrl, { next: { revalidate: 0 } });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `식약처 API 오류 (${res.status}): ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = await res.json();

    // Handle variable response structures from the public data API
    const body = data.body;
    if (!body) {
      return NextResponse.json({ items: [], totalCount: 0, pageNo: page, numOfRows: size });
    }

    const totalCount = body.totalCount ?? 0;

    // items can be array, object with item property, or null
    let rawItems: unknown[];
    if (Array.isArray(body.items)) {
      rawItems = body.items;
    } else if (body.items?.item) {
      rawItems = Array.isArray(body.items.item) ? body.items.item : [body.items.item];
    } else {
      rawItems = [];
    }

    const items: DrugSearchResult[] = rawItems.map((raw: unknown) => {
      const r = raw as Record<string, unknown>;
      return {
        item_seq: getField(r, "ITEM_SEQ", "item_seq") ?? "",
        item_name: getField(r, "ITEM_NAME", "item_name") ?? "",
        entp_name: getField(r, "ENTP_NAME", "entp_name") ?? "",
        entp_no: getField(r, "ENTP_NO", "entp_no") ?? "",
        item_permit_date: getField(r, "ITEM_PERMIT_DATE", "item_permit_date") ?? "",
        edi_code: getField(r, "EDI_CODE", "edi_code"),
        atc_code: getField(r, "ATC_CODE", "atc_code"),
        main_item_ingr: getField(r, "MAIN_ITEM_INGR", "main_item_ingr"),
        bar_code: getField(r, "BAR_CODE", "bar_code"),
        bizrno: getField(r, "BIZRNO", "bizrno"),
        rare_drug_yn: getField(r, "RARE_DRUG_YN", "rare_drug_yn"),
      };
    });

    return NextResponse.json({ items, totalCount, pageNo: page, numOfRows: size });
  } catch (err) {
    return NextResponse.json(
      { error: `의약품 검색 실패: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}

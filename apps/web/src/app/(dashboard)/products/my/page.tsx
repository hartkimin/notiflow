import { getMyDrugs, getMyDevices } from "@/lib/queries/products";
import { MfdsSearchPanel } from "@/components/mfds-search-panel";

export default async function MyProductsPage() {
  const [drugs, devices] = await Promise.all([
    getMyDrugs().catch(() => []),
    getMyDevices().catch(() => []),
  ]);

  const mapToUpperCase = (items: Record<string, unknown>[], keys: string[]) =>
    items.map((item) => {
      const mapped = { ...item };
      for (const key of keys) {
        mapped[key.toUpperCase()] = item[key];
      }
      return mapped;
    });

  const drugKeys = [
    "item_seq", "item_name", "item_eng_name", "entp_name", "entp_no",
    "item_permit_date", "cnsgn_manuf", "etc_otc_code", "chart", "bar_code",
    "material_name", "ee_doc_id", "ud_doc_id", "nb_doc_id", "storage_method",
    "valid_term", "pack_unit", "edi_code", "permit_kind_name", "cancel_date",
    "cancel_name", "change_date", "atc_code", "rare_drug_yn",
  ];

  const deviceKeys = [
    "udidi_cd", "prdlst_nm", "mnft_iprt_entp_nm", "mdeq_clsf_no",
    "clsf_no_grad_cd", "permit_no", "prmsn_ymd", "foml_info", "prdt_nm_info",
    "hmbd_trspt_mdeq_yn", "dspsbl_mdeq_yn", "trck_mng_trgt_yn", "total_dev",
    "cmbnmd_yn", "use_before_strlzt_need_yn", "sterilization_method_nm",
    "use_purps_cont", "strg_cnd_info", "circ_cnd_info", "rcprslry_trgt_yn",
  ];

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">내 품목</h1>
        <p className="text-sm text-muted-foreground mt-1">
          등록된 품목을 관리하고 식약처 API와 동기화합니다.
        </p>
      </div>
      <MfdsSearchPanel
        mode="manage"
        myDrugs={mapToUpperCase(drugs as Record<string, unknown>[], drugKeys)}
        myDevices={mapToUpperCase(devices as Record<string, unknown>[], deviceKeys)}
      />
    </>
  );
}

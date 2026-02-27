import type { MfdsApiSource } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FilterOperator =
  | "contains"
  | "equals"
  | "startsWith"
  | "notContains"
  | "before"
  | "after"
  | "between";

export interface FilterChip {
  field: string;
  label: string;
  value: string;
  /** Secondary value for "between" operator */
  valueTo?: string;
  operator: FilterOperator;
}

export type ColumnType = "text" | "date" | "status";

export interface SearchableColumn {
  field: string;
  label: string;
  type: ColumnType;
}

// ---------------------------------------------------------------------------
// Searchable column definitions per tab (used by search dropdown)
// ---------------------------------------------------------------------------

const DRUG_SEARCHABLE_COLUMNS: SearchableColumn[] = [
  { field: "ITEM_NAME", label: "품목명", type: "text" },
  { field: "ENTP_NAME", label: "업체명", type: "text" },
  { field: "BAR_CODE", label: "표준코드", type: "text" },
  { field: "EDI_CODE", label: "보험코드", type: "text" },
  { field: "ATC_CODE", label: "ATC코드", type: "text" },
  { field: "ITEM_SEQ", label: "품목기준코드", type: "text" },
  { field: "PERMIT_KIND_NAME", label: "허가종류", type: "text" },
  { field: "CANCEL_NAME", label: "상태", type: "status" },
];

const DEVICE_SEARCHABLE_COLUMNS: SearchableColumn[] = [
  { field: "PRDLST_NM", label: "품목명", type: "text" },
  { field: "MNFT_IPRT_ENTP_NM", label: "업체명", type: "text" },
  { field: "UDIDI_CD", label: "UDI-DI", type: "text" },
  { field: "PERMIT_NO", label: "품목허가번호", type: "text" },
  { field: "MDEQ_CLSF_NO", label: "분류번호", type: "text" },
  { field: "CLSF_NO_GRAD_CD", label: "등급", type: "status" },
  { field: "FOML_INFO", label: "모델명", type: "text" },
];

/** Get searchable columns for search field dropdown */
export function getSearchableColumns(tab: MfdsApiSource): SearchableColumn[] {
  return tab === "drug" ? DRUG_SEARCHABLE_COLUMNS : DEVICE_SEARCHABLE_COLUMNS;
}

// ---------------------------------------------------------------------------
// Filterable column definitions per tab (used by filter builder)
// ---------------------------------------------------------------------------

const DRUG_FILTERABLE_COLUMNS: SearchableColumn[] = [
  { field: "ITEM_NAME", label: "품목명", type: "text" },
  { field: "ENTP_NAME", label: "업체명", type: "text" },
  { field: "BAR_CODE", label: "표준코드", type: "text" },
  { field: "EDI_CODE", label: "보험코드", type: "text" },
  { field: "ATC_CODE", label: "ATC코드", type: "text" },
  { field: "ITEM_SEQ", label: "품목기준코드", type: "text" },
  { field: "ITEM_ENG_NAME", label: "영문명", type: "text" },
  { field: "ENTP_NO", label: "업체허가번호", type: "text" },
  { field: "CNSGN_MANUF", label: "위탁제조업체", type: "text" },
  { field: "MATERIAL_NAME", label: "성분", type: "text" },
  { field: "CHART", label: "성상", type: "text" },
  { field: "STORAGE_METHOD", label: "저장방법", type: "text" },
  { field: "VALID_TERM", label: "유효기간", type: "text" },
  { field: "PACK_UNIT", label: "포장단위", type: "text" },
  { field: "PERMIT_KIND_NAME", label: "허가구분", type: "text" },
  { field: "ETC_OTC_CODE", label: "전문/일반", type: "status" },
  { field: "CANCEL_NAME", label: "상태", type: "status" },
  { field: "RARE_DRUG_YN", label: "희귀의약품", type: "text" },
  { field: "ITEM_PERMIT_DATE", label: "허가일자", type: "date" },
  { field: "CANCEL_DATE", label: "취소일자", type: "date" },
  { field: "CHANGE_DATE", label: "변경일자", type: "date" },
];

const DEVICE_FILTERABLE_COLUMNS: SearchableColumn[] = [
  { field: "PRDLST_NM", label: "품목명", type: "text" },
  { field: "MNFT_IPRT_ENTP_NM", label: "제조수입업체명", type: "text" },
  { field: "UDIDI_CD", label: "UDI-DI코드", type: "text" },
  { field: "PERMIT_NO", label: "품목허가번호", type: "text" },
  { field: "MDEQ_CLSF_NO", label: "분류번호", type: "text" },
  { field: "FOML_INFO", label: "모델명", type: "text" },
  { field: "PRDT_NM_INFO", label: "제품명", type: "text" },
  { field: "USE_PURPS_CONT", label: "사용목적", type: "text" },
  { field: "STERILIZATION_METHOD_NM", label: "멸균방법", type: "text" },
  { field: "STRG_CND_INFO", label: "저장조건", type: "text" },
  { field: "CIRC_CND_INFO", label: "유통취급조건", type: "text" },
  { field: "CLSF_NO_GRAD_CD", label: "등급", type: "status" },
  { field: "DSPSBL_MDEQ_YN", label: "일회용여부", type: "status" },
  { field: "HMBD_TRSPT_MDEQ_YN", label: "인체이식형여부", type: "status" },
  { field: "TRCK_MNG_TRGT_YN", label: "추적관리대상", type: "status" },
  { field: "TOTAL_DEV", label: "한벌구성여부", type: "status" },
  { field: "CMBNMD_YN", label: "조합의료기기", type: "status" },
  { field: "RCPRSLRY_TRGT_YN", label: "요양급여대상", type: "status" },
  { field: "USE_BEFORE_STRLZT_NEED_YN", label: "사전멸균필요", type: "status" },
  { field: "PRMSN_YMD", label: "허가일자", type: "date" },
];

/** Get filterable columns for filter builder */
export function getFilterableColumns(tab: MfdsApiSource): SearchableColumn[] {
  return tab === "drug" ? DRUG_FILTERABLE_COLUMNS : DEVICE_FILTERABLE_COLUMNS;
}

// ---------------------------------------------------------------------------
// Operators per column type
// ---------------------------------------------------------------------------

const OPERATOR_OPTIONS: Record<ColumnType, { value: FilterOperator; label: string }[]> = {
  text: [
    { value: "contains", label: "포함" },
    { value: "equals", label: "일치" },
    { value: "startsWith", label: "시작" },
    { value: "notContains", label: "제외" },
  ],
  date: [
    { value: "before", label: "이전" },
    { value: "after", label: "이후" },
    { value: "between", label: "범위" },
  ],
  status: [
    { value: "equals", label: "일치" },
  ],
};

export function getOperatorsForType(type: ColumnType) {
  return OPERATOR_OPTIONS[type];
}

// ---------------------------------------------------------------------------
// Client-side filter matching
// ---------------------------------------------------------------------------

/** Check if a single row value matches a filter chip (client-side) */
export function matchesFilter(
  rowValue: unknown,
  chip: FilterChip,
): boolean {
  const val = String(rowValue ?? "").toLowerCase();
  const target = chip.value.toLowerCase();

  switch (chip.operator) {
    case "contains":
      return val.includes(target);
    case "equals":
      return val === target;
    case "startsWith":
      return val.startsWith(target);
    case "notContains":
      return !val.includes(target);
    case "before":
      return val !== "" && val < target;
    case "after":
      return val !== "" && val > target;
    case "between": {
      const to = (chip.valueTo ?? "").toLowerCase();
      return val !== "" && val >= target && val <= to;
    }
    default:
      return true;
  }
}

"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Check, Copy } from "lucide-react";
import type { MfdsApiSource } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldDef {
  key: string;
  label: string;
}

interface FieldGroup {
  title: string;
  fields: FieldDef[];
}

export interface MfdsRowDetailProps {
  item: Record<string, unknown>;
  tab: MfdsApiSource;
  isAdded: boolean;
  isAdding: boolean;
  onAdd: () => void;
  colSpan: number;
  /** Render as a plain div instead of a table row (for mobile card context) */
  variant?: "table-row" | "div";
}

// ---------------------------------------------------------------------------
// Field group definitions per tab
// ---------------------------------------------------------------------------

const DRUG_GROUPS: FieldGroup[] = [
  {
    title: "기본 정보",
    fields: [
      { key: "item_seq", label: "품목기준코드" },
      { key: "item_name", label: "품목명" },
      { key: "item_eng_name", label: "품목영문명" },
      { key: "entp_name", label: "업체명" },
      { key: "entp_no", label: "업체허가번호" },
      { key: "cnsgn_manuf", label: "위탁제조업체" },
      { key: "pack_unit", label: "포장단위" },
    ],
  },
  {
    title: "분류/허가",
    fields: [
      { key: "etc_otc_code", label: "전문/일반" },
      { key: "permit_kind_name", label: "허가/신고구분" },
      { key: "bar_code", label: "표준코드" },
      { key: "edi_code", label: "보험코드" },
      { key: "atc_code", label: "ATC코드" },
      { key: "cancel_name", label: "상태" },
      { key: "cancel_date", label: "취소일자" },
      { key: "item_permit_date", label: "허가일자" },
      { key: "change_date", label: "변경일자" },
      { key: "rare_drug_yn", label: "희귀의약품" },
    ],
  },
  {
    title: "상세 정보",
    fields: [
      { key: "material_name", label: "성분" },
      { key: "chart", label: "성상" },
      { key: "storage_method", label: "저장방법" },
      { key: "valid_term", label: "유효기간" },
      { key: "ee_doc_id", label: "효능효과" },
      { key: "ud_doc_id", label: "용법용량" },
      { key: "nb_doc_id", label: "주의사항" },
    ],
  },
];

const DEVICE_STD_GROUPS: FieldGroup[] = [
  {
    title: "기본 정보",
    fields: [
      { key: "prdlst_nm", label: "품목명" },
      { key: "prdt_nm_info", label: "제품명" },
      { key: "mnft_iprt_entp_nm", label: "제조수입업체명" },
      { key: "foml_info", label: "모델명" },
      { key: "total_dev", label: "한벌구성의료기기여부" },
    ],
  },
  {
    title: "분류/허가",
    fields: [
      { key: "mdeq_clsf_no", label: "분류번호" },
      { key: "clsf_no_grad_cd", label: "등급" },
      { key: "udidi_cd", label: "UDI-DI코드" },
      { key: "permit_no", label: "품목허가번호" },
      { key: "prmsn_ymd", label: "허가일자" },
      { key: "use_purps_cont", label: "사용목적" },
    ],
  },
  {
    title: "관리/보관",
    fields: [
      { key: "dspsbl_mdeq_yn", label: "일회용여부" },
      { key: "hmbd_trspt_mdeq_yn", label: "인체이식형여부" },
      { key: "trck_mng_trgt_yn", label: "추적관리대상여부" },
      { key: "cmbnmd_yn", label: "조합의료기기여부" },
      { key: "rcprslry_trgt_yn", label: "요양급여대상여부" },
      { key: "use_before_strlzt_need_yn", label: "사용전멸균필요여부" },
      { key: "sterilization_method_nm", label: "멸균방법" },
      { key: "strg_cnd_info", label: "저장조건" },
      { key: "circ_cnd_info", label: "유통취급조건" },
    ],
  },
];

const GROUPS_BY_TAB: Record<MfdsApiSource, FieldGroup[]> = {
  drug: DRUG_GROUPS,
  device_std: DEVICE_STD_GROUPS,
};

// ---------------------------------------------------------------------------
// Helper: check if a value is non-empty
// ---------------------------------------------------------------------------

function isNonEmpty(value: unknown): value is string | number {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  return false;
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for non-HTTPS
      const textarea = document.createElement("textarea");
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded"
      title="복사"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MfdsRowDetail({
  item,
  tab,
  isAdded,
  isAdding,
  onAdd,
  colSpan,
  variant = "table-row",
}: MfdsRowDetailProps) {
  const groups = GROUPS_BY_TAB[tab];

  const content = (
    <div className="bg-muted/20 px-6 py-4">
      {/* Field groups grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <div key={group.title}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {group.title}
            </h4>
            <dl className="space-y-1">
              {group.fields.map((field) => {
                const rawValue = item[field.key];
                const displayValue = isNonEmpty(rawValue) ? String(rawValue) : "-";
                return (
                  <div key={field.key} className="flex gap-2 text-sm items-start">
                    <dt className="text-muted-foreground shrink-0 w-28 text-right pt-0.5">
                      {field.label}
                    </dt>
                    <dd className="min-w-0 whitespace-pre-wrap break-words flex-1">
                      {displayValue}
                    </dd>
                    {isNonEmpty(rawValue) && (
                      <CopyButton value={String(rawValue)} />
                    )}
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      {/* Add button area */}
      <div className="flex justify-end pt-2 border-t mt-4">
        {isAdded ? (
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" />
            추가됨
          </Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={isAdding}
            onClick={onAdd}
            className="gap-1"
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            내 품목에 추가
          </Button>
        )}
      </div>
    </div>
  );

  if (variant === "div") {
    return content;
  }

  return (
    <tr>
      <td colSpan={colSpan} className="border-t p-0">
        {content}
      </td>
    </tr>
  );
}

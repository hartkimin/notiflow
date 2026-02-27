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
      { key: "ITEM_SEQ", label: "품목기준코드" },
      { key: "ITEM_NAME", label: "품목명" },
      { key: "ITEM_ENG_NAME", label: "품목영문명" },
      { key: "ENTP_NAME", label: "업체명" },
      { key: "ENTP_NO", label: "업체허가번호" },
      { key: "CNSGN_MANUF", label: "위탁제조업체" },
      { key: "PACK_UNIT", label: "포장단위" },
    ],
  },
  {
    title: "분류/허가",
    fields: [
      { key: "ETC_OTC_CODE", label: "전문/일반" },
      { key: "PERMIT_KIND_NAME", label: "허가/신고구분" },
      { key: "BAR_CODE", label: "표준코드" },
      { key: "EDI_CODE", label: "보험코드" },
      { key: "ATC_CODE", label: "ATC코드" },
      { key: "CANCEL_NAME", label: "상태" },
      { key: "CANCEL_DATE", label: "취소일자" },
      { key: "ITEM_PERMIT_DATE", label: "허가일자" },
      { key: "CHANGE_DATE", label: "변경일자" },
      { key: "RARE_DRUG_YN", label: "희귀의약품" },
    ],
  },
  {
    title: "상세 정보",
    fields: [
      { key: "MATERIAL_NAME", label: "성분" },
      { key: "CHART", label: "성상" },
      { key: "STORAGE_METHOD", label: "저장방법" },
      { key: "VALID_TERM", label: "유효기간" },
      { key: "EE_DOC_ID", label: "효능효과" },
      { key: "UD_DOC_ID", label: "용법용량" },
      { key: "NB_DOC_ID", label: "주의사항" },
    ],
  },
];

const DEVICE_STD_GROUPS: FieldGroup[] = [
  {
    title: "기본 정보",
    fields: [
      { key: "PRDLST_NM", label: "품목명" },
      { key: "PRDT_NM_INFO", label: "제품명" },
      { key: "MNFT_IPRT_ENTP_NM", label: "제조수입업체명" },
      { key: "FOML_INFO", label: "모델명" },
      { key: "TOTAL_DEV", label: "한벌구성의료기기여부" },
    ],
  },
  {
    title: "분류/허가",
    fields: [
      { key: "MDEQ_CLSF_NO", label: "분류번호" },
      { key: "CLSF_NO_GRAD_CD", label: "등급" },
      { key: "UDIDI_CD", label: "UDI-DI코드" },
      { key: "PERMIT_NO", label: "품목허가번호" },
      { key: "PRMSN_YMD", label: "허가일자" },
      { key: "USE_PURPS_CONT", label: "사용목적" },
    ],
  },
  {
    title: "관리/보관",
    fields: [
      { key: "DSPSBL_MDEQ_YN", label: "일회용여부" },
      { key: "HMBD_TRSPT_MDEQ_YN", label: "인체이식형여부" },
      { key: "TRCK_MNG_TRGT_YN", label: "추적관리대상여부" },
      { key: "CMBNMD_YN", label: "조합의료기기여부" },
      { key: "RCPRSLRY_TRGT_YN", label: "요양급여대상여부" },
      { key: "USE_BEFORE_STRLZT_NEED_YN", label: "사용전멸균필요여부" },
      { key: "STERILIZATION_METHOD_NM", label: "멸균방법" },
      { key: "STRG_CND_INFO", label: "저장조건" },
      { key: "CIRC_CND_INFO", label: "유통취급조건" },
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

"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Check } from "lucide-react";
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
}

// ---------------------------------------------------------------------------
// Field group definitions per tab
// ---------------------------------------------------------------------------

const DRUG_GROUPS: FieldGroup[] = [
  {
    title: "기본 정보",
    fields: [
      { key: "ITEM_ENG_NAME", label: "품목영문명" },
      { key: "CNSGN_MANUF", label: "위탁제조업체" },
      { key: "PACK_UNIT", label: "포장단위" },
      { key: "ATC_CODE", label: "ATC코드" },
      { key: "ENTP_NO", label: "업체허가번호" },
    ],
  },
  {
    title: "허가/분류",
    fields: [
      { key: "PERMIT_KIND_NAME", label: "허가/신고구분" },
      { key: "CHANGE_DATE", label: "변경일자" },
      { key: "CANCEL_DATE", label: "취소일자" },
      { key: "RARE_DRUG_YN", label: "희귀의약품" },
    ],
  },
  {
    title: "상세 정보",
    fields: [
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
      { key: "PRDT_NM_INFO", label: "제품명" },
      { key: "MDEQ_CLSF_NO", label: "분류번호" },
      { key: "USE_PURPS_CONT", label: "사용목적" },
    ],
  },
  {
    title: "관리 구분",
    fields: [
      { key: "HMBD_TRSPT_MDEQ_YN", label: "인체이식형여부" },
      { key: "TRCK_MNG_TRGT_YN", label: "추적관리대상여부" },
      { key: "TOTAL_DEV", label: "한벌구성의료기기여부" },
      { key: "CMBNMD_YN", label: "조합의료기기여부" },
      { key: "RCPRSLRY_TRGT_YN", label: "요양급여대상여부" },
    ],
  },
  {
    title: "보관/멸균",
    fields: [
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
// Component
// ---------------------------------------------------------------------------

export function MfdsRowDetail({
  item,
  tab,
  isAdded,
  isAdding,
  onAdd,
  colSpan,
}: MfdsRowDetailProps) {
  const groups = GROUPS_BY_TAB[tab];

  return (
    <tr>
      <td colSpan={colSpan} className="bg-muted/20 border-t px-6 py-4">
        {/* Field groups grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            // Filter out fields with empty values
            const visibleFields = group.fields.filter((f) =>
              isNonEmpty(item[f.key])
            );

            if (visibleFields.length === 0) return null;

            return (
              <div key={group.title}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {group.title}
                </h4>
                <dl className="space-y-1">
                  {visibleFields.map((field) => (
                    <div key={field.key} className="flex gap-2 text-sm">
                      <dt className="text-muted-foreground shrink-0 w-24 text-right">
                        {field.label}
                      </dt>
                      <dd className="break-words min-w-0">
                        {String(item[field.key])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
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
      </td>
    </tr>
  );
}

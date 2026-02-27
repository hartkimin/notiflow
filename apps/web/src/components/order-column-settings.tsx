"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Columns3 } from "lucide-react";
import type { OrderDisplayColumns } from "@/lib/queries/settings";
import { updateOrderDisplayColumnsAction } from "@/app/(dashboard)/settings/actions";

const MAX_SELECTIONS = 4;

const DRUG_COLUMNS = [
  { key: "ITEM_SEQ", label: "품목기준코드" },
  { key: "ITEM_NAME", label: "품목명" },
  { key: "ITEM_ENG_NAME", label: "영문명" },
  { key: "ENTP_NAME", label: "업체명" },
  { key: "ENTP_NO", label: "업체허가번호" },
  { key: "ITEM_PERMIT_DATE", label: "허가일자" },
  { key: "CNSGN_MANUF", label: "위탁제조업체" },
  { key: "ETC_OTC_CODE", label: "전문/일반" },
  { key: "CHART", label: "성상" },
  { key: "BAR_CODE", label: "표준코드" },
  { key: "MATERIAL_NAME", label: "성분" },
  { key: "EE_DOC_ID", label: "효능효과" },
  { key: "UD_DOC_ID", label: "용법용량" },
  { key: "NB_DOC_ID", label: "주의사항" },
  { key: "STORAGE_METHOD", label: "저장방법" },
  { key: "VALID_TERM", label: "유효기간" },
  { key: "PACK_UNIT", label: "포장단위" },
  { key: "EDI_CODE", label: "보험코드" },
  { key: "PERMIT_KIND_NAME", label: "허가구분" },
  { key: "CANCEL_DATE", label: "취소일자" },
  { key: "CANCEL_NAME", label: "상태" },
  { key: "CHANGE_DATE", label: "변경일자" },
  { key: "ATC_CODE", label: "ATC코드" },
  { key: "RARE_DRUG_YN", label: "희귀의약품" },
];

const DEVICE_COLUMNS = [
  { key: "UDIDI_CD", label: "UDI-DI코드" },
  { key: "PRDLST_NM", label: "품목명" },
  { key: "MNFT_IPRT_ENTP_NM", label: "제조수입업체명" },
  { key: "MDEQ_CLSF_NO", label: "분류번호" },
  { key: "CLSF_NO_GRAD_CD", label: "등급" },
  { key: "PERMIT_NO", label: "품목허가번호" },
  { key: "PRMSN_YMD", label: "허가일자" },
  { key: "FOML_INFO", label: "모델명" },
  { key: "PRDT_NM_INFO", label: "제품명" },
  { key: "HMBD_TRSPT_MDEQ_YN", label: "인체이식형여부" },
  { key: "DSPSBL_MDEQ_YN", label: "일회용여부" },
  { key: "TRCK_MNG_TRGT_YN", label: "추적관리대상" },
  { key: "TOTAL_DEV", label: "한벌구성여부" },
  { key: "CMBNMD_YN", label: "조합의료기기" },
  { key: "USE_BEFORE_STRLZT_NEED_YN", label: "사전멸균필요" },
  { key: "STERILIZATION_METHOD_NM", label: "멸균방법" },
  { key: "USE_PURPS_CONT", label: "사용목적" },
  { key: "STRG_CND_INFO", label: "저장조건" },
  { key: "CIRC_CND_INFO", label: "유통취급조건" },
  { key: "RCPRSLRY_TRGT_YN", label: "요양급여대상" },
];

interface OrderColumnSettingsProps {
  initialColumns: OrderDisplayColumns;
}

export function OrderColumnSettings({ initialColumns }: OrderColumnSettingsProps) {
  const [drugColumns, setDrugColumns] = useState<string[]>(initialColumns.drug);
  const [deviceColumns, setDeviceColumns] = useState<string[]>(initialColumns.device);
  const [isPending, startTransition] = useTransition();

  function toggleColumn(
    type: "drug" | "device",
    key: string,
    checked: boolean,
  ) {
    const setter = type === "drug" ? setDrugColumns : setDeviceColumns;
    setter((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key),
    );
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateOrderDisplayColumnsAction({
          drug: drugColumns,
          device: deviceColumns,
        });
        toast.success("표시 컬럼 설정이 저장되었습니다.");
      } catch {
        toast.error("설정 저장에 실패했습니다.");
      }
    });
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Columns3 className="h-4 w-4" />
            주문 표시 컬럼
          </CardTitle>
          <CardDescription>
            주문서에서 품목별로 표시할 컬럼을 선택합니다. 각 유형별 최대 {MAX_SELECTIONS}개까지 선택 가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ColumnSection
            title="의약품"
            columns={DRUG_COLUMNS}
            selected={drugColumns}
            onToggle={(key, checked) => toggleColumn("drug", key, checked)}
          />
          <ColumnSection
            title="의료기기"
            columns={DEVICE_COLUMNS}
            selected={deviceColumns}
            onToggle={(key, checked) => toggleColumn("device", key, checked)}
          />
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ColumnSection({
  title,
  columns,
  selected,
  onToggle,
}: {
  title: string;
  columns: { key: string; label: string }[];
  selected: string[];
  onToggle: (key: string, checked: boolean) => void;
}) {
  const atMax = selected.length >= MAX_SELECTIONS;

  return (
    <div>
      <h4 className="text-sm font-medium mb-3">
        {title}{" "}
        <span className="text-muted-foreground font-normal">
          ({selected.length}/{MAX_SELECTIONS})
        </span>
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {columns.map((col) => {
          const isChecked = selected.includes(col.key);
          const isDisabled = !isChecked && atMax;
          return (
            <div key={col.key} className="flex items-center gap-2">
              <Checkbox
                id={`col-${col.key}`}
                checked={isChecked}
                disabled={isDisabled}
                onCheckedChange={(checked: boolean | "indeterminate") =>
                  onToggle(col.key, checked === true)
                }
              />
              <Label
                htmlFor={`col-${col.key}`}
                className={`text-sm cursor-pointer ${isDisabled ? "text-muted-foreground" : ""}`}
              >
                {col.label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

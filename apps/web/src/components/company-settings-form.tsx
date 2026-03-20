"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { upsertCompanySettingsAction } from "@/app/(dashboard)/settings/company/actions";
import type { CompanySettings } from "@/lib/tax-invoice/types";

interface Props {
  initialSettings: CompanySettings | null;
}

export default function CompanySettingsForm({ initialSettings }: Props) {
  const [form, setForm] = useState({
    biz_no: initialSettings?.biz_no ?? "",
    company_name: initialSettings?.company_name ?? "",
    ceo_name: initialSettings?.ceo_name ?? "",
    address: initialSettings?.address ?? "",
    biz_type: initialSettings?.biz_type ?? "",
    biz_item: initialSettings?.biz_item ?? "",
    email: initialSettings?.email ?? "",
    auto_issue_on_delivery: initialSettings?.auto_issue_on_delivery ?? false,
    monthly_consolidation: initialSettings?.monthly_consolidation ?? false,
    consolidation_day: initialSettings?.consolidation_day ?? 25,
  });
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  }

  function handleSwitch(name: keyof typeof form, checked: boolean) {
    setForm((prev) => ({ ...prev, [name]: checked }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await upsertCompanySettingsAction(form);
        toast.success("자사 정보가 저장되었습니다.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>자사 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="biz_no">사업자등록번호</Label>
            <Input
              id="biz_no"
              name="biz_no"
              value={form.biz_no}
              onChange={handleChange}
              placeholder="0000000000"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company_name">상호</Label>
            <Input
              id="company_name"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ceo_name">대표자</Label>
            <Input
              id="ceo_name"
              name="ceo_name"
              value={form.ceo_name}
              onChange={handleChange}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">사업장 주소</Label>
            <Input
              id="address"
              name="address"
              value={form.address}
              onChange={handleChange}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="biz_type">업태</Label>
            <Input
              id="biz_type"
              name="biz_type"
              value={form.biz_type}
              onChange={handleChange}
              placeholder="예: 도소매업"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="biz_item">종목</Label>
            <Input
              id="biz_item"
              name="biz_item"
              value={form.biz_item}
              onChange={handleChange}
              placeholder="예: 의료기기"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
            />
          </div>

          <hr className="my-2" />

          <p className="text-sm font-semibold">자동화 설정</p>

          <div className="flex items-center gap-3">
            <Switch
              id="auto_issue_on_delivery"
              checked={form.auto_issue_on_delivery}
              onCheckedChange={(checked) =>
                handleSwitch("auto_issue_on_delivery", checked)
              }
            />
            <Label htmlFor="auto_issue_on_delivery">배송완료 시 자동 발행</Label>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="monthly_consolidation"
              checked={form.monthly_consolidation}
              onCheckedChange={(checked) =>
                handleSwitch("monthly_consolidation", checked)
              }
            />
            <Label htmlFor="monthly_consolidation">월합산 발행</Label>
          </div>

          {form.monthly_consolidation && (
            <div className="grid gap-2">
              <Label htmlFor="consolidation_day">월합산 마감일</Label>
              <Input
                id="consolidation_day"
                name="consolidation_day"
                type="number"
                min={1}
                max={31}
                value={form.consolidation_day}
                onChange={handleChange}
                className="w-24"
              />
            </div>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

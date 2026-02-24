"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import { createFilterRule, updateFilterRule, deleteFilterRule } from "@/lib/actions";
import { argbToHex } from "@/lib/schedule-utils";
import type { MobileCategory, FilterRule } from "@/lib/types";

interface FilterRuleEditorProps {
  filterRules: FilterRule[];
  categories: MobileCategory[];
}

export function FilterRuleEditor({ filterRules, categories }: FilterRuleEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSenderKeywords, setFormSenderKeywords] = useState("");
  const [formSenderMatchType, setFormSenderMatchType] = useState("CONTAINS");
  const [formIncludeWords, setFormIncludeWords] = useState("");
  const [formExcludeWords, setFormExcludeWords] = useState("");
  const [formIncludeMatchType, setFormIncludeMatchType] = useState("OR");
  const [formConditionType, setFormConditionType] = useState("AND");
  const [formActive, setFormActive] = useState(true);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  function startEdit(rule: FilterRule) {
    setEditingId(rule.id);
    setFormCategoryId(rule.category_id);
    setFormSenderKeywords(rule.sender_keywords.join(", "));
    setFormSenderMatchType(rule.sender_match_type);
    setFormIncludeWords(rule.include_words.join(", "));
    setFormExcludeWords(rule.exclude_words.join(", "));
    setFormIncludeMatchType(rule.include_match_type);
    setFormConditionType(rule.condition_type);
    setFormActive(rule.is_active);
    setIsCreating(false);
  }

  function startCreate() {
    setEditingId(null);
    setFormCategoryId(categories[0]?.id ?? "");
    setFormSenderKeywords("");
    setFormSenderMatchType("CONTAINS");
    setFormIncludeWords("");
    setFormExcludeWords("");
    setFormIncludeMatchType("OR");
    setFormConditionType("AND");
    setFormActive(true);
    setIsCreating(true);
  }

  function cancelForm() { setEditingId(null); setIsCreating(false); }

  function parseCSV(s: string): string[] {
    return s.split(",").map((w) => w.trim()).filter(Boolean);
  }

  function handleSave() {
    if (!formCategoryId) { toast.error("카테고리를 선택하세요"); return; }
    const data = {
      category_id: formCategoryId,
      sender_keywords: parseCSV(formSenderKeywords),
      sender_match_type: formSenderMatchType,
      include_words: parseCSV(formIncludeWords),
      exclude_words: parseCSV(formExcludeWords),
      include_match_type: formIncludeMatchType,
      condition_type: formConditionType,
      is_active: formActive,
    };
    startTransition(async () => {
      try {
        if (isCreating) { await createFilterRule(data); toast.success("규칙이 생성되었습니다."); }
        else if (editingId) { await updateFilterRule(editingId, data); toast.success("규칙이 수정되었습니다."); }
        cancelForm();
        router.refresh();
      } catch { toast.error("저장 실패"); }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteFilterRule(id);
        toast.success("규칙이 삭제되었습니다.");
        if (editingId === id) cancelForm();
        router.refresh();
      } catch { toast.error("삭제 실패"); }
    });
  }

  function summarizeRule(rule: FilterRule): string {
    const parts: string[] = [];
    if (rule.sender_keywords.length > 0) parts.push(`발신: ${rule.sender_keywords.join(", ")}`);
    if (rule.include_words.length > 0) parts.push(`포함: ${rule.include_words.join(", ")}`);
    if (rule.exclude_words.length > 0) parts.push(`제외: ${rule.exclude_words.join(", ")}`);
    return parts.join(" | ") || "조건 없음";
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {filterRules.map((rule) => {
          const cat = categoryMap.get(rule.category_id);
          return (
            <div
              key={rule.id}
              className={[
                "flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors",
                editingId === rule.id && "bg-muted/50 ring-1 ring-primary/30",
                !rule.is_active && "opacity-50",
              ].filter(Boolean).join(" ")}
            >
              {cat && <span className="h-2.5 w-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: argbToHex(cat.color) }} />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cat?.name ?? "알 수 없음"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{summarizeRule(rule)}</p>
              </div>
              <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted shrink-0" onClick={() => startEdit(rule)}>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 shrink-0">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>규칙을 삭제할까요?</AlertDialogTitle>
                    <AlertDialogDescription>이 필터 규칙이 삭제됩니다.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(rule.id)}>삭제</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        })}
        {filterRules.length === 0 && !isCreating && (
          <p className="text-sm text-muted-foreground text-center py-4">등록된 규칙이 없습니다</p>
        )}
      </div>

      {!isCreating && !editingId && (
        <Button variant="outline" size="sm" className="w-full" onClick={startCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" /> 새 규칙
        </Button>
      )}

      {(isCreating || editingId) && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{isCreating ? "새 규칙" : "규칙 편집"}</h4>
            <div className="space-y-1.5">
              <Label className="text-xs">대상 카테고리</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="카테고리 선택" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: argbToHex(c.color) }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">발신자 키워드 (쉼표 구분)</Label>
              <Input value={formSenderKeywords} onChange={(e) => setFormSenderKeywords(e.target.value)} placeholder="과장, 팀장, 병원" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">발신자 매칭 방식</Label>
              <Select value={formSenderMatchType} onValueChange={setFormSenderMatchType}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTAINS">포함</SelectItem>
                  <SelectItem value="EXACT">정확히 일치</SelectItem>
                  <SelectItem value="REGEX">정규식</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">포함 단어 (쉼표 구분)</Label>
              <Input value={formIncludeWords} onChange={(e) => setFormIncludeWords(e.target.value)} placeholder="회의, 보고, 주문" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">제외 단어 (쉼표 구분)</Label>
              <Input value={formExcludeWords} onChange={(e) => setFormExcludeWords(e.target.value)} placeholder="광고, 스팸" className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">포함 조건</Label>
                <Select value={formIncludeMatchType} onValueChange={setFormIncludeMatchType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OR">하나라도 (OR)</SelectItem>
                    <SelectItem value="AND">모두 (AND)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">전체 조건</Label>
                <Select value={formConditionType} onValueChange={setFormConditionType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">모두 충족 (AND)</SelectItem>
                    <SelectItem value="OR">하나만 (OR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">활성화</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isPending}>저장</Button>
              <Button size="sm" variant="outline" onClick={cancelForm}>취소</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Pencil, Trash2, GripVertical } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createCategory, updateCategory, deleteCategory,
} from "@/lib/actions";
import { argbToHex } from "@/lib/schedule-utils";
import type { MobileCategory } from "@/lib/types";

// Predefined color palette (ARGB integers matching Android defaults)
const COLOR_PALETTE = [
  0xFFE57373, 0xFFFFB74D, 0xFFFFF176, 0xFFAED581,
  0xFF81C784, 0xFF4FC3F7, 0xFF64B5F6, 0xFF9575CD,
  0xFFF06292, 0xFF90A4AE, 0xFFA1887F, 0xFFE0E0E0,
];

interface CategoryManagerProps {
  categories: MobileCategory[];
}

export function CategoryManager({ categories }: CategoryManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(COLOR_PALETTE[0]);
  const [formActive, setFormActive] = useState(true);

  function startEdit(cat: MobileCategory) {
    setEditingId(cat.id);
    setFormName(cat.name);
    setFormColor(cat.color);
    setFormActive(cat.is_active);
    setIsCreating(false);
  }

  function startCreate() {
    setEditingId(null);
    setFormName("");
    setFormColor(COLOR_PALETTE[0]);
    setFormActive(true);
    setIsCreating(true);
  }

  function cancelForm() {
    setEditingId(null);
    setIsCreating(false);
  }

  function handleSave() {
    const name = formName.trim();
    if (!name) { toast.error("이름을 입력하세요"); return; }

    startTransition(async () => {
      try {
        if (isCreating) {
          await createCategory({ name, color: formColor, order_index: categories.length });
          toast.success("카테고리가 생성되었습니다.");
        } else if (editingId) {
          await updateCategory(editingId, { name, color: formColor, is_active: formActive });
          toast.success("카테고리가 수정되었습니다.");
        }
        cancelForm();
        router.refresh();
      } catch { toast.error("저장 실패"); }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteCategory(id);
        toast.success("카테고리가 삭제되었습니다.");
        if (editingId === id) cancelForm();
        router.refresh();
      } catch { toast.error("삭제 실패"); }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={[
              "flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors",
              editingId === cat.id && "bg-muted/50 ring-1 ring-primary/30",
              !cat.is_active && "opacity-50",
            ].filter(Boolean).join(" ")}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab shrink-0" />
            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: argbToHex(cat.color) }} />
            <span className="flex-1 text-sm truncate">{cat.name}</span>
            {!cat.is_active && <span className="text-[10px] text-muted-foreground">비활성</span>}
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted shrink-0" onClick={() => startEdit(cat)}>
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
                  <AlertDialogTitle>카테고리를 삭제할까요?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &quot;{cat.name}&quot; 카테고리가 삭제됩니다. 관련된 플랜과 메시지는 유지됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(cat.id)}>삭제</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </div>

      {!isCreating && !editingId && (
        <Button variant="outline" size="sm" className="w-full" onClick={startCreate}>
          + 새 카테고리
        </Button>
      )}

      {(isCreating || editingId) && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{isCreating ? "새 카테고리" : "카테고리 편집"}</h4>
            <div className="space-y-1.5">
              <Label className="text-xs">이름</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="카테고리 이름" className="h-8 text-sm" maxLength={30} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">색상</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    className={["h-6 w-6 rounded-full border-2 transition-all", formColor === c ? "border-foreground scale-110" : "border-transparent"].join(" ")}
                    style={{ backgroundColor: argbToHex(c) }}
                    onClick={() => setFormColor(c)}
                  />
                ))}
              </div>
            </div>
            {editingId && (
              <div className="flex items-center justify-between">
                <Label className="text-xs">활성화</Label>
                <Switch checked={formActive} onCheckedChange={setFormActive} />
              </div>
            )}
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

# TypeScript 암시적 any 타입 수정 (2026-02-18)

## 요약

프로덕션 빌드를 차단하던 기존 컴포넌트의 `implicit any` 타입 오류 수정.

## 수정 내용

shadcn/ui 콜백 매개변수에 명시적 타입 어노테이션 추가:

- `onCheckedChange={(v) => ...}` → `onCheckedChange={(v: boolean) => ...}`
- `onValueChange={(v) => ...}` → `onValueChange={(v: string) => ...}`
- `onOpenChange={(open) => ...}` → `onOpenChange={(open: boolean) => ...}`

## 수정 파일

| 파일 | 수정 개수 |
|------|-----------|
| `apps/web/src/components/ai-settings.tsx` | 4개 |
| `apps/web/src/components/manual-parse-form.tsx` | 1개 |
| `apps/web/src/components/message-list.tsx` | 1개 |
| `apps/web/src/components/order-calendar.tsx` | 2개 |
| `apps/web/src/components/order-table.tsx` | 1개 |

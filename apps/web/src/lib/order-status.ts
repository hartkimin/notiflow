export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "임시",
  confirmed: "확인됨",
  processing: "처리중",
  delivered: "배송완료",
  cancelled: "취소",
};

export const ORDER_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  confirmed: "default",
  processing: "default",
  delivered: "outline",
  cancelled: "destructive",
};

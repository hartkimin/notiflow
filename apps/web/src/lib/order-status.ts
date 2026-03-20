export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  confirmed: "접수확인",
  delivered: "배송완료",
  invoiced: "발행완료",
  cancelled: "취소",
};

export const ORDER_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  confirmed: "default",
  delivered: "outline",
  invoiced: "default",
  cancelled: "destructive",
};

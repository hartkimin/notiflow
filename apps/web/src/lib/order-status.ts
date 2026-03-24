export const ORDER_STATUS_LABELS: Record<string, string> = {
  confirmed: "주문완료",
  delivered: "배송완료",
};

export const ORDER_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  confirmed: "default",
  delivered: "outline",
};

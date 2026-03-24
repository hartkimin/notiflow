export const ORDER_STATUS_LABELS: Record<string, string> = {
  confirmed: "미완료",
  delivered: "완료",
};

export const ORDER_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  confirmed: "secondary",
  delivered: "default",
};

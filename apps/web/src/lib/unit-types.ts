export const UNIT_OPTIONS = [
  { value: "piece", label: "개" },
  { value: "box", label: "박스" },
  { value: "pack", label: "팩" },
  { value: "set", label: "세트" },
  { value: "bottle", label: "병" },
  { value: "ampoule", label: "앰플" },
  { value: "vial", label: "바이알" },
] as const;

export type UnitType = (typeof UNIT_OPTIONS)[number]["value"];

export const CUSTOM_UNIT_VALUE = "__custom__" as const;

export function getUnitLabel(value: string): string {
  const found = UNIT_OPTIONS.find((o) => o.value === value);
  return found ? found.label : value;
}

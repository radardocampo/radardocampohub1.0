export type RangeValue = 7 | 30 | 90;

export const RANGE_OPTIONS: { value: RangeValue; label: string; full: string }[] = [
  { value: 7, label: "7d", full: "Últimos 7 dias" },
  { value: 30, label: "30d", full: "Últimos 30 dias" },
  { value: 90, label: "90d", full: "Últimos 90 dias" },
];

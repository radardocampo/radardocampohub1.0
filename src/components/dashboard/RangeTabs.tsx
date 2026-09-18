import { RANGE_OPTIONS, type RangeValue } from "./range";

export function RangeTabs({
  value,
  onChange,
}: {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Período analisado"
      className="inline-flex rounded-md border border-border bg-surface p-0.5"
    >
      {RANGE_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            title={option.full}
            className={`rounded-[0.3rem] px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

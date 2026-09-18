import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

/**
 * Variação percentual. Sem pílula colorida: o sinal e a seta já comunicam a
 * direção, e um fundo tingido em cada número transforma a tela em semáforo.
 */
export function Delta({
  value,
  suffix,
  className = "",
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const flat = Math.abs(value) < 0.05;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = flat ? "text-subtle" : value > 0 ? "text-success" : "text-destructive";
  const formatted = `${value > 0 && !flat ? "+" : ""}${value.toFixed(1).replace(".", ",")}%`;

  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${tone} ${className}`}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {flat ? "estável" : formatted}
      {suffix ? <span className="text-subtle">{suffix}</span> : null}
    </span>
  );
}

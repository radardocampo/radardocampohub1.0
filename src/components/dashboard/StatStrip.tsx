import type { ReactNode } from "react";

export type Stat = {
  label: string;
  value: string;
  /** Segunda linha: comparação, base de cálculo ou unidade. */
  hint?: ReactNode;
};

/**
 * Faixa única dividida por réguas, em vez de quatro cartões soltos e idênticos.
 * Lidos lado a lado, os números viram uma frase; em caixas separadas, viram
 * quatro anúncios competindo entre si.
 */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="panel grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`px-5 py-4 ${i % 2 === 1 ? "border-l border-border sm:border-l-0" : ""} ${
            i >= 2 ? "border-t border-border sm:border-t-0" : ""
          }`}
        >
          <dt className="text-xs font-medium text-subtle">{stat.label}</dt>
          <dd className="stat mt-1.5 text-2xl text-foreground md:text-[1.75rem]">{stat.value}</dd>
          {stat.hint ? <div className="mt-1 text-xs text-muted-foreground">{stat.hint}</div> : null}
        </div>
      ))}
    </dl>
  );
}

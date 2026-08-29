import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { buildEarnings, earningsByDay } from "@/lib/mock-data";
import { MONETIZED_PLATFORMS, formatBRL, getPlatform } from "@/lib/platforms";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Radar do Campo Hub" },
      {
        name: "description",
        content:
          "Ganhos diários do YouTube, TikTok e Shopee com gráfico por plataforma e histórico detalhado.",
      },
      { property: "og:title", content: "Financeiro — Radar do Campo Hub" },
      {
        property: "og:description",
        content: "Resumo e histórico de ganhos das plataformas monetizadas do Radar do Campo.",
      },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const rows = useMemo(() => buildEarnings(14), []);
  const byDay = useMemo(() => earningsByDay(rows), [rows]);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const today = rows[0]?.date;
  const todayTotal = rows.filter((r) => r.date === today).reduce((sum, r) => sum + r.amount, 0);

  return (
    <AppShell
      title="Financeiro"
      subtitle="Ganhos das plataformas monetizadas: YouTube, TikTok e Shopee."
      actions={
        <Badge className="bg-secondary text-secondary-foreground text-sm py-1 px-3">
          Últimos 14 dias
        </Badge>
      }
    >
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Hoje" value={formatBRL(todayTotal)} hint="somando as 3 fontes" />
        <Tile label="Total do período" value={formatBRL(total)} hint="14 dias" />
        <Tile label="Média diária" value={formatBRL(total / 14)} hint="por dia" />
        {MONETIZED_PLATFORMS.slice(0, 1).map((p) => (
          <Tile
            key={p.id}
            label="Maior fonte"
            value={
              MONETIZED_PLATFORMS.map((m) => ({
                name: m.name,
                total: rows.filter((r) => r.platform_id === m.id).reduce((s, r) => s + r.amount, 0),
              })).sort((a, b) => b.total - a.total)[0]!.name
            }
            hint="no período"
          />
        ))}
      </div>

      <section className="panel mt-10 p-6">
        <h2 className="text-2xl font-semibold">Ganhos por dia e plataforma</h2>
        <div className="mt-8 h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDay}>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="4 4" />
              <XAxis
                dataKey="label"
                stroke="var(--muted-foreground)"
                fontSize={13}
                tickMargin={12}
              />
              <YAxis stroke="var(--muted-foreground)" fontSize={13} width={60} />
              <Tooltip
                cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  color: "var(--popover-foreground)",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number, name) => [
                  formatBRL(value),
                  getPlatform(String(name)).name,
                ]}
              />
              <Legend
                formatter={(value) => getPlatform(String(value)).name}
                wrapperStyle={{ paddingTop: "20px" }}
              />
              {MONETIZED_PLATFORMS.map((p) => (
                <Bar
                  key={p.id}
                  dataKey={p.id}
                  stackId="earnings"
                  fill={p.color}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel mt-10 overflow-x-auto p-6">
        <h2 className="text-2xl font-semibold">Histórico detalhado</h2>
        <table className="mt-6 w-full min-w-[640px] text-base">
          <thead className="text-left text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="pb-4">Data</th>
              <th className="pb-4">Plataforma</th>
              <th className="pb-4">Fonte</th>
              <th className="pb-4 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 30).map((row, index) => {
              const meta = getPlatform(row.platform_id);
              const Icon = meta.icon;
              return (
                <tr
                  key={`${row.date}-${row.platform_id}-${index}`}
                  className="border-t border-border/50 hover:bg-surface-2 transition-colors"
                >
                  <td className="py-4 font-medium">{row.label}</td>
                  <td className="py-4">
                    <span className="flex items-center gap-3 font-medium">
                      <Icon className={`size-5 ${meta.textClass}`} />
                      {meta.name}
                    </span>
                  </td>
                  <td className="py-4 text-muted-foreground">{row.source_type}</td>
                  <td className="py-4 text-right font-semibold">{formatBRL(row.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="panel p-6 flex flex-col justify-between">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-4">
        <p className="font-display text-4xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground font-medium">{hint}</p>
      </div>
    </article>
  );
}

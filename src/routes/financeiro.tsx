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
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { earningsByDay } from "@/lib/mock-data";
import { MONETIZED_PLATFORMS, formatBRL, getPlatform } from "@/lib/platforms";
import { getFinancialEntries } from "@/lib/youtube.functions";

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
  const fetchFinancials = useServerFn(getFinancialEntries);

  const query = useQuery({
    queryKey: ["financial-entries", 14],
    queryFn: () => fetchFinancials({ data: { days: 14 } }),
  });

  const rows = useMemo(() => {
    const data = query.data ?? [];
    return data.map((r) => {
      const parsed = new Date(`${r.date}T00:00:00`);
      return {
        ...r,
        label: parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      };
    });
  }, [query.data]);

  const byDay = useMemo(() => earningsByDay(rows as any), [rows]);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const today = rows[0]?.date;
  const todayTotal = rows.filter((r) => r.date === today).reduce((sum, r) => sum + r.amount, 0);

  const byPlatform = MONETIZED_PLATFORMS.map((m) => ({
    name: m.name,
    total: rows.filter((r) => r.platform_id === m.id).reduce((s, r) => s + r.amount, 0),
  })).sort((a, b) => b.total - a.total);
  const top = byPlatform[0]?.total ? byPlatform[0] : undefined;
  const isEmpty = !query.isLoading && rows.length === 0;

  return (
    <AppShell
      title="Financeiro"
      subtitle="Ganhos das plataformas monetizadas: YouTube, TikTok e Shopee."
      actions={<span className="text-sm text-muted-foreground">Últimos 14 dias</span>}
    >
      <StatStrip
        stats={[
          { label: "Hoje", value: formatBRL(todayTotal), hint: "somando as 3 fontes" },
          { label: "Total do período", value: formatBRL(total), hint: "14 dias" },
          { label: "Média diária", value: formatBRL(total / 14), hint: "por dia no período" },
          {
            label: "Maior fonte",
            value: top?.name ?? "—",
            hint: top ? `${formatBRL(top.total)} no período` : "sem lançamentos",
          },
        ]}
      />

      <section className="panel mt-6 p-5">
        <SectionHeader
          title="Ganhos por dia e plataforma"
          description="Barras empilhadas por fonte de receita."
          action={
            query.isLoading ? (
              <span className="text-sm text-muted-foreground">Carregando…</span>
            ) : undefined
          }
        />
        {isEmpty ? (
          <EmptyState isError={query.isError} />
        ) : (
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay}>
                <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="4 4" />
                <XAxis
                  dataKey="label"
                  stroke="var(--subtle)"
                  fontSize={12}
                  tickMargin={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--subtle)"
                  fontSize={12}
                  width={56}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.625rem",
                    color: "var(--popover-foreground)",
                    boxShadow: "var(--shadow-overlay)",
                    fontSize: "0.8125rem",
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
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="panel mt-6 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <SectionHeader title="Histórico detalhado" description="Lançamento a lançamento." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-subtle">
                <th scope="col" className="px-5 py-2.5">
                  Data
                </th>
                <th scope="col" className="px-5 py-2.5">
                  Plataforma
                </th>
                <th scope="col" className="px-5 py-2.5">
                  Fonte
                </th>
                <th scope="col" className="px-5 py-2.5 text-right">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 30).map((row, index) => {
                const meta = getPlatform(row.platform_id);
                const Icon = meta.icon;
                return (
                  <tr
                    key={`${row.date}-${row.platform_id}-${index}`}
                    className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{row.label}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2.5">
                        <Icon className="size-4" style={{ color: meta.color }} aria-hidden />
                        {meta.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{row.source_type}</td>
                    <td className="stat px-5 py-3 text-right tabular-nums">
                      {formatBRL(row.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function EmptyState({ isError }: { isError: boolean }) {
  return (
    <p className="px-5 py-12 text-center text-sm text-muted-foreground">
      {isError
        ? "Não foi possível carregar os ganhos agora. Tente recarregar a página."
        : "Nenhum lançamento registrado nos últimos 14 dias."}
    </p>
  );
}

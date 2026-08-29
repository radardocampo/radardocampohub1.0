import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { buildSnapshots, type PlatformSnapshot } from "@/lib/mock-data";
import { CONTENT_PLATFORMS, formatFull, formatNumber, getPlatform } from "@/lib/platforms";

const RANGES = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
] as const;

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  color: "var(--popover-foreground)",
} as const;

export const Route = createFileRoute("/metricas")({
  head: () => ({
    meta: [
      { title: "Métricas por plataforma — Radar do Campo Hub" },
      {
        name: "description",
        content:
          "Seguidores, views, curtidas e taxa de engajamento do YouTube, TikTok, Instagram, Pinterest, Threads, Facebook e Kwai.",
      },
      { property: "og:title", content: "Métricas por plataforma — Radar do Campo Hub" },
      {
        property: "og:description",
        content: "Evolução detalhada de audiência e engajamento por plataforma e período.",
      },
    ],
  }),
  component: MetricsPage,
});

function MetricsPage() {
  const [days, setDays] = useState<number>(30);
  const [selected, setSelected] = useState<string>("youtube");
  const snapshots = useMemo(() => buildSnapshots(days), [days]);
  const current = snapshots.find((s) => s.id === selected) ?? snapshots[0]!;
  const meta = getPlatform(current.id);

  return (
    <AppShell
      title="Métricas"
      subtitle="Audiência e engajamento por plataforma."
      actions={
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {RANGES.map((range) => (
            <Button
              key={range.days}
              size="sm"
              variant={days === range.days ? "default" : "ghost"}
              onClick={() => setDays(range.days)}
              className="px-4 text-sm font-medium"
            >
              {range.label}
            </Button>
          ))}
        </div>
      }
    >
      <div className="flex flex-wrap gap-3">
        {CONTENT_PLATFORMS.map((platform) => {
          const Icon = platform.icon;
          const active = platform.id === selected;
          return (
            <button
              key={platform.id}
              onClick={() => setSelected(platform.id)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-base font-medium transition-colors ${
                active
                  ? `border-transparent shadow-sm ${platform.bgClass} ${platform.textClass}`
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Icon className="size-5" />
              {platform.name}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Seguidores"
          value={formatFull(current.followers)}
          hint={`+${current.followersDelta}% no período`}
        />
        <MetricTile
          label="Views"
          value={formatNumber(current.views)}
          hint="no período selecionado"
        />
        <MetricTile
          label="Curtidas"
          value={formatNumber(current.likes)}
          hint="no período selecionado"
        />
        <MetricTile
          label="Engajamento"
          value={`${current.engagement_rate}%`}
          hint="média do período"
        />
      </div>

      <section className="panel mt-10 p-6">
        <h2 className="text-2xl font-semibold">
          Evolução — <span className={meta.textClass}>{meta.name}</span>
        </h2>
        <p className="text-base text-muted-foreground mt-1">
          Views por dia e crescimento de seguidores.
        </p>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="h-[340px]">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Views por dia
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart data={current.series}>
                <defs>
                  <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.color} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={meta.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="4 4" />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  fontSize={13}
                  tickMargin={12}
                  minTickGap={28}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={13}
                  width={56}
                  tickFormatter={(v: number) => formatNumber(v)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatFull(value), "Views"]}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke={meta.color}
                  strokeWidth={3}
                  fill="url(#viewsFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="h-[340px]">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Seguidores
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <AreaChart data={current.series}>
                <defs>
                  <linearGradient id="followersFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="4 4" />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  fontSize={13}
                  tickMargin={12}
                  minTickGap={28}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={13}
                  width={56}
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v: number) => formatNumber(v)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatFull(value), "Seguidores"]}
                />
                <Area
                  type="monotone"
                  dataKey="followers"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  fill="url(#followersFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="panel mt-10 overflow-x-auto p-6">
        <h2 className="text-2xl font-semibold">Comparativo entre plataformas</h2>
        <table className="mt-6 w-full min-w-[720px] text-base">
          <thead className="text-left text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="pb-4">Plataforma</th>
              <th className="pb-4">Seguidores</th>
              <th className="pb-4">Views</th>
              <th className="pb-4">Curtidas</th>
              <th className="pb-4">Engajamento</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snap: PlatformSnapshot) => {
              const row = getPlatform(snap.id);
              const Icon = row.icon;
              return (
                <tr
                  key={snap.id}
                  className="border-t border-border/50 hover:bg-surface-2 transition-colors"
                >
                  <td className="py-4">
                    <span className="flex items-center gap-3 font-medium">
                      <Icon className={`size-5 ${row.textClass}`} />
                      {row.name}
                    </span>
                  </td>
                  <td className="py-4 font-semibold">{formatFull(snap.followers)}</td>
                  <td className="py-4">{formatNumber(snap.views)}</td>
                  <td className="py-4">{formatNumber(snap.likes)}</td>
                  <td className="py-4 font-medium text-success bg-success/10 px-2 py-1 inline-flex rounded-md mt-3">
                    {snap.engagement_rate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}

function MetricTile({ label, value, hint }: { label: string; value: string; hint: string }) {
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

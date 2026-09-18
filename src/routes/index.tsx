import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Checkbox } from "@/components/ui/checkbox";
import { Delta } from "@/components/dashboard/Delta";
import { RangeTabs } from "@/components/dashboard/RangeTabs";
import { RANGE_OPTIONS, type RangeValue } from "@/components/dashboard/range";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { StatStrip } from "@/components/dashboard/StatStrip";
import {
  buildSnapshots,
  buildEarnings,
  MOCK_TASKS,
  type PlatformSnapshot,
  type RoutineTask,
} from "@/lib/mock-data";
import {
  getPlatform,
  formatNumber,
  formatFull,
  formatBRL,
  MONETIZED_PLATFORMS,
} from "@/lib/platforms";

/** Destaques editoriais da semana — ainda curados à mão. */
const DESTAQUES = [
  { title: "Análise tática: nova formação do time", platform: "youtube", views: 145000, delta: 25 },
  { title: "Curiosidades sobre o clássico", platform: "tiktok", views: 450000, delta: 40 },
  { title: "Bastidores do vestiário", platform: "instagram", views: 200000, delta: 15 },
];

/** Variação entre a segunda e a primeira metade do período. */
function halfSplitDelta(values: number[]) {
  if (values.length < 4) return 0;
  const mid = Math.floor(values.length / 2);
  const before = values.slice(0, mid).reduce((s, v) => s + v, 0);
  const after = values.slice(mid).reduce((s, v) => s + v, 0);
  if (!before) return 0;
  return ((after - before) / before) * 100;
}

type SortKey = "followers" | "views" | "engagement_rate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Radar do Campo Hub" },
      {
        name: "description",
        content:
          "Visão geral das plataformas de conteúdo do Radar do Campo: seguidores, views, engajamento e ganhos do dia.",
      },
      { property: "og:title", content: "Dashboard — Radar do Campo Hub" },
      {
        property: "og:description",
        content:
          "Painel de gestão de conteúdo digital: métricas, financeiro, rotina e banco de ideias.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [range, setRange] = useState<RangeValue>(30);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "followers",
    desc: true,
  });
  const [tasks, setTasks] = useState<RoutineTask[]>(MOCK_TASKS);

  const snapshots = useMemo(() => buildSnapshots(range), [range]);
  const earnings = useMemo(() => buildEarnings(Math.min(range, 90)), [range]);

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)!.full;

  const today = earnings[0]?.date;
  const todayEarnings = earnings.filter((e) => e.date === today);
  const todayTotal = todayEarnings.reduce((sum, e) => sum + e.amount, 0);
  const periodTotal = earnings.reduce((sum, e) => sum + e.amount, 0);
  const dailyAverage = periodTotal / range;

  const totalFollowers = snapshots.reduce((sum, s) => sum + s.followers, 0);
  const totalViews = snapshots.reduce((sum, s) => sum + s.views, 0);
  const followersGained = snapshots.reduce(
    (sum, s) => sum + (s.followers - (s.series[0]?.followers ?? s.followers)),
    0,
  );
  const viewsDelta = halfSplitDelta(
    snapshots[0]?.series.map((_, i) =>
      snapshots.reduce((sum, s) => sum + (s.series[i]?.views ?? 0), 0),
    ) ?? [],
  );
  const avgEngagement =
    snapshots.reduce((sum, s) => sum + s.engagement_rate, 0) / (snapshots.length || 1);

  const doneTasks = tasks.filter((t) => t.completed).length;

  const sorted = useMemo(
    () =>
      [...snapshots].sort((a, b) =>
        sort.desc ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key],
      ),
    [snapshots, sort],
  );

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({ key, desc: prev.key === key ? !prev.desc : true }));

  const toggleTask = (id: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));

  const maxEarning = Math.max(
    ...MONETIZED_PLATFORMS.map((meta) =>
      todayEarnings.filter((e) => e.platform_id === meta.id).reduce((s, e) => s + e.amount, 0),
    ),
    1,
  );

  return (
    <AppShell
      title="Dashboard"
      subtitle={new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
      actions={<RangeTabs value={range} onChange={setRange} />}
    >
      <StatStrip
        stats={[
          {
            label: "Seguidores",
            value: formatNumber(totalFollowers),
            hint: (
              <span className="tabular-nums">
                +{formatFull(followersGained)} em {range} dias
              </span>
            ),
          },
          {
            label: "Views no período",
            value: formatNumber(totalViews),
            hint: <Delta value={viewsDelta} suffix="vs. metade anterior" />,
          },
          {
            label: "Ganhos de hoje",
            value: formatBRL(todayTotal),
            hint: <span className="tabular-nums">média de {formatBRL(dailyAverage)}/dia</span>,
          },
          {
            label: "Rotina de hoje",
            value: `${doneTasks}/${tasks.length}`,
            hint:
              doneTasks === tasks.length
                ? "tudo concluído"
                : `${tasks.length - doneTasks} ${
                    tasks.length - doneTasks === 1 ? "tarefa" : "tarefas"
                  } em aberto`,
          },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="panel overflow-hidden lg:col-span-2">
          <div className="border-b border-border px-5 py-4">
            <SectionHeader
              title="Plataformas"
              description={`${rangeLabel} · ${avgEngagement.toFixed(1).replace(".", ",")}% de engajamento médio`}
              action={
                <Link
                  to="/metricas"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Ver métricas <ArrowRight className="size-3.5" />
                </Link>
              }
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="px-5 py-2.5 text-xs font-medium text-subtle">
                    Plataforma
                  </th>
                  <SortableHeader
                    label="Seguidores"
                    active={sort.key === "followers"}
                    desc={sort.desc}
                    onClick={() => toggleSort("followers")}
                  />
                  <SortableHeader
                    label="Views"
                    active={sort.key === "views"}
                    desc={sort.desc}
                    onClick={() => toggleSort("views")}
                  />
                  <SortableHeader
                    label="Engaj."
                    active={sort.key === "engagement_rate"}
                    desc={sort.desc}
                    onClick={() => toggleSort("engagement_rate")}
                  />
                  <th
                    scope="col"
                    className="hidden px-5 py-2.5 text-right text-xs font-medium text-subtle sm:table-cell"
                  >
                    Tendência
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((snap) => (
                  <PlatformRow key={snap.id} snap={snap} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section className="panel p-5">
            <SectionHeader
              title="Ganhos de hoje"
              action={
                <Link to="/financeiro" className="text-sm font-medium text-primary hover:underline">
                  Detalhar
                </Link>
              }
            />
            <ul className="mt-4 space-y-3.5">
              {MONETIZED_PLATFORMS.map((meta) => {
                const amount = todayEarnings
                  .filter((e) => e.platform_id === meta.id)
                  .reduce((sum, e) => sum + e.amount, 0);
                return (
                  <li key={meta.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: meta.color }}
                          aria-hidden
                        />
                        {meta.name}
                      </span>
                      <span className="stat text-sm tabular-nums">{formatBRL(amount)}</span>
                    </div>
                    {/* A barra mostra o peso relativo da fonte no dia. */}
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(amount / maxEarning) * 100}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="stat text-lg tabular-nums">{formatBRL(todayTotal)}</span>
            </div>
          </section>

          <section className="panel p-5">
            <SectionHeader
              title="Rotina de hoje"
              action={
                <Link to="/rotina" className="text-sm font-medium text-primary hover:underline">
                  Abrir
                </Link>
              }
            />
            <ul className="mt-4 space-y-1">
              {tasks.slice(0, 5).map((task) => (
                <li key={task.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/60">
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => toggleTask(task.id)}
                      className="mt-0.5"
                    />
                    <span
                      className={`text-sm leading-snug ${
                        task.completed ? "text-subtle line-through" : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="panel mt-6 p-5">
        <SectionHeader title="Em alta na semana" description="Os conteúdos que puxaram alcance." />
        <ol className="mt-4 divide-y divide-border">
          {DESTAQUES.map((item, i) => {
            const meta = getPlatform(item.platform);
            const Icon = meta.icon;
            return (
              <li
                key={item.title}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
              >
                <span className="stat w-5 shrink-0 text-lg text-subtle">{i + 1}</span>
                <Icon className="size-4 shrink-0" style={{ color: meta.color }} aria-hidden />
                <span className="min-w-0 flex-1 basis-[12rem] text-sm">{item.title}</span>
                <span className="stat ml-9 shrink-0 text-sm tabular-nums sm:ml-0">
                  {formatNumber(item.views)}
                  <span className="ml-1 text-xs font-normal text-subtle">views</span>
                </span>
                <Delta value={item.delta} className="shrink-0 text-sm sm:w-24 sm:justify-end" />
              </li>
            );
          })}
        </ol>
      </section>
    </AppShell>
  );
}

function SortableHeader({
  label,
  active,
  desc,
  onClick,
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
}) {
  const Icon = desc ? ChevronDown : ChevronUp;
  return (
    <th
      scope="col"
      aria-sort={active ? (desc ? "descending" : "ascending") : "none"}
      className="group/th px-5 py-2.5 text-right"
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground ${
          active ? "text-foreground" : "text-subtle"
        }`}
      >
        {label}
        <Icon
          className={`size-3 transition-opacity ${
            active ? "opacity-100" : "opacity-0 group-hover/th:opacity-60"
          }`}
          aria-hidden
        />
      </button>
    </th>
  );
}

function PlatformRow({ snap }: { snap: PlatformSnapshot }) {
  const meta = getPlatform(snap.id);
  const Icon = meta.icon;
  const views = snap.series.map((p) => p.views);

  return (
    <tr className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40">
      <th scope="row" className="px-5 py-3 text-left font-normal">
        <span className="flex items-center gap-2.5">
          <Icon className="size-4 shrink-0" style={{ color: meta.color }} aria-hidden />
          <span className="font-medium">{meta.name}</span>
          {meta.monetized && (
            <span className="rounded border border-border px-1.5 py-px text-[0.6875rem] text-subtle">
              monetizada
            </span>
          )}
        </span>
      </th>
      <td className="px-5 py-3 text-right">
        <div className="stat text-sm tabular-nums">{formatNumber(snap.followers)}</div>
        <Delta value={snap.followersDelta} className="mt-0.5 text-xs" />
      </td>
      <td className="stat px-5 py-3 text-right text-sm tabular-nums">{formatNumber(snap.views)}</td>
      <td className="stat px-5 py-3 text-right text-sm tabular-nums">
        {snap.engagement_rate.toFixed(1).replace(".", ",")}%
      </td>
      <td className="hidden px-5 py-3 sm:table-cell">
        <div className="flex justify-end">
          <Sparkline
            values={views}
            color={meta.color}
            title={`Evolução de views no ${meta.name}`}
          />
        </div>
      </td>
    </tr>
  );
}

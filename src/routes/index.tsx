import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowUpRight, Trophy, Flame, CircleDollarSign, Flag, Play } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { buildSnapshots, buildEarnings, MOCK_TASKS } from "@/lib/mock-data";
import { getPlatform, formatNumber, formatBRL, MONETIZED_PLATFORMS } from "@/lib/platforms";

const GOLEADAS = [
  {
    title: "Análise tática: Nova formação do time",
    platform: "YouTube",
    views: "145k",
    trend: "+25%",
  },
  { title: "Curiosidades sobre o clássico", platform: "TikTok", views: "450k", trend: "+40%" },
  { title: "Bastidores do vestiário", platform: "Instagram", views: "200k", trend: "+15%" },
];

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
  const snapshots = useMemo(() => buildSnapshots(30), []);
  const earnings = useMemo(() => buildEarnings(14), []);

  const today = earnings[0]?.date;
  const todayEarnings = earnings.filter((e) => e.date === today);
  const todayTotal = todayEarnings.reduce((sum, e) => sum + e.amount, 0);
  const monthTotal = earnings.reduce((sum, e) => sum + e.amount, 0);
  const totalFollowers = snapshots.reduce((sum, s) => sum + s.followers, 0);
  const totalViews = snapshots.reduce((sum, s) => sum + s.views, 0);
  const doneTasks = MOCK_TASKS.filter((t) => t.completed).length;

  return (
    <AppShell
      title="Dashboard"
      subtitle="Visão geral de hoje em todas as frentes do Radar do Campo."
      actions={
        <Badge className="bg-secondary text-secondary-foreground text-sm py-1 px-3">
          Dados de exemplo
        </Badge>
      }
    >
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Trophy className="size-6" />}
          label="Seguidores totais"
          value={formatNumber(totalFollowers)}
          hint="7 plataformas de conteúdo"
        />
        <SummaryCard
          icon={<Flame className="size-6" />}
          label="Views (30 dias)"
          value={formatNumber(totalViews)}
          hint="soma de todas as plataformas"
        />
        <SummaryCard
          icon={<CircleDollarSign className="size-6" />}
          label="Ganhos de hoje"
          value={formatBRL(todayTotal)}
          hint={`${formatBRL(monthTotal)} nos últimos 14 dias`}
        />
        <SummaryCard
          icon={<Flag className="size-6" />}
          label="Rotina do dia"
          value={`${doneTasks}/${MOCK_TASKS.length}`}
          hint="tarefas concluídas"
        />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Goleadas da Semana (Em Alta)</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {GOLEADAS.map((item, i) => (
            <article key={i} className="panel p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                    <Play className="size-5" />
                  </span>
                  <span className="text-base font-semibold">{item.platform}</span>
                </div>
                <p className="text-base font-medium line-clamp-2 leading-relaxed">{item.title}</p>
              </div>
              <div className="mt-6 flex items-center justify-between text-sm font-medium">
                <span className="text-muted-foreground text-base">{item.views} views</span>
                <span className="text-success flex items-center gap-1 text-base bg-success/10 px-2 py-1 rounded-md">
                  <Flame className="size-4" /> {item.trend}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Plataformas</h2>
          <Link
            to="/metricas"
            className="flex items-center gap-1 text-base text-primary hover:underline font-medium"
          >
            Ver métricas <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {snapshots.map((snap) => {
            const meta = getPlatform(snap.id);
            const Icon = meta.icon;
            return (
              <article key={snap.id} className="panel p-6">
                <div className="flex items-center gap-4">
                  <span
                    className={`flex size-12 items-center justify-center rounded-xl ${meta.bgClass} ${meta.textClass}`}
                  >
                    <Icon className="size-6" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold">{meta.name}</p>
                    <p className="text-sm text-muted-foreground font-medium">
                      {meta.monetized ? "Monetizada" : "Alcance"}
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="font-display text-4xl font-bold tracking-tight">
                    {formatNumber(snap.followers)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">seguidores</p>
                </div>
                <div className="mt-6 flex items-center justify-between text-sm font-medium">
                  <span className="text-success bg-success/10 px-2 py-1 rounded-md">
                    +{snap.followersDelta}% / 30d
                  </span>
                  <span className="text-muted-foreground">{snap.engagement_rate}% eng.</span>
                </div>
                <Progress
                  value={Math.min(snap.engagement_rate * 10, 100)}
                  className="mt-4 h-2 rounded-full"
                />
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="text-2xl font-semibold">Financeiro de hoje</h2>
          <p className="text-base text-muted-foreground mt-1">Somente plataformas monetizadas.</p>
          <ul className="mt-6 space-y-4">
            {MONETIZED_PLATFORMS.map((meta) => {
              const amount = todayEarnings
                .filter((e) => e.platform_id === meta.id)
                .reduce((sum, e) => sum + e.amount, 0);
              const Icon = meta.icon;
              return (
                <li
                  key={meta.id}
                  className="flex items-center justify-between rounded-xl bg-surface-2 px-5 py-4 shadow-sm"
                >
                  <span className="flex items-center gap-4 text-base font-medium">
                    <Icon className={`size-5 ${meta.textClass}`} />
                    {meta.name}
                  </span>
                  <span className="font-display text-lg font-bold">{formatBRL(amount)}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Rotina de hoje</h2>
            <Link to="/rotina" className="text-base font-medium text-primary hover:underline">
              Abrir tudo
            </Link>
          </div>
          <ul className="mt-6 space-y-3">
            {MOCK_TASKS.slice(0, 5).map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-4 rounded-xl bg-surface-2 px-5 py-4 text-base shadow-sm"
              >
                <span
                  className={`size-3 rounded-full shrink-0 ${task.completed ? "bg-primary shadow-[0_0_8px_rgba(0,255,0,0.5)]" : "bg-muted-foreground/40"}`}
                />
                <span
                  className={`font-medium ${task.completed ? "text-muted-foreground line-through opacity-80" : "text-foreground"}`}
                >
                  {task.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </AppShell>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="panel-field p-6 flex flex-col justify-between">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary shadow-sm">
          {icon}
        </span>
        <span className="text-sm font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-6">
        <p className="font-display text-4xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground font-medium">{hint}</p>
      </div>
    </article>
  );
}

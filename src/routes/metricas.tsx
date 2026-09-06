import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildSnapshots, type MetricPoint, type PlatformSnapshot } from "@/lib/mock-data";
import { CONTENT_PLATFORMS, formatFull, formatNumber, getPlatform } from "@/lib/platforms";
import { supabase } from "@/integrations/supabase/client";
import { getYoutubeMetrics, checkYoutubeHistoryExists } from "@/lib/youtube.functions";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MetricsPage,
});

function MetricsPage() {
  const [days, setDays] = useState<number>(30);
  const [selected, setSelected] = useState<string>("youtube");
  const queryClient = useQueryClient();

  const fetchYoutube = useServerFn(getYoutubeMetrics);
  const fetchHistoryExists = useServerFn(checkYoutubeHistoryExists);

  const historyExistsQuery = useQuery({
    queryKey: ["youtube-history-exists"],
    queryFn: () => fetchHistoryExists(),
  });

  const youtubeQuery = useQuery({
    queryKey: ["youtube-metrics", days],
    queryFn: () => fetchYoutube({ data: { days } }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("backfill-youtube-history", {
        method: "POST",
      });
      if (error) {
        let detail = error.message;
        const response = (error as { context?: Response }).context;
        if (response && typeof response.json === "function") {
          try {
            const body = await response.clone().json();
            if (body?.error) detail = String(body.error);
          } catch {
            /* corpo não é JSON: mantém a mensagem padrão */
          }
        }
        throw new Error(detail);
      }
      if (data && typeof data === "object" && "error" in data && data.error) {
        throw new Error(String((data as { error: unknown }).error));
      }
      return data;
    },
    onMutate: () => {
      toast.info("Iniciando sincronização histórica do YouTube...", { id: "sync-youtube" });
    },
    onSuccess: async () => {
      toast.success("Sincronização concluída com sucesso!", { id: "sync-youtube" });
      await queryClient.invalidateQueries({ queryKey: ["youtube-metrics"] });
      await queryClient.invalidateQueries({ queryKey: ["youtube-history-exists"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Falha ao sincronizar: ${message}`, { id: "sync-youtube", duration: 8000 });
    },
  });

  const youtubeSnapshot = useMemo(() => {
    const rows = youtubeQuery.data ?? [];
    if (rows.length === 0) return null;

    // metrics_daily do YouTube agora guarda os dados diários (delta).
    const series: MetricPoint[] = rows.map((row) => {
      const parsed = new Date(`${row.date}T00:00:00`);
      return {
        date: row.date,
        label: parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        followers: row.followers,
        views: row.views,
        likes: row.likes,
        engagement_rate: row.engagement_rate,
        watch_time_hours: row.watch_time_hours || 0,
        subs_gained: row.subs_gained || 0,
        subs_lost: row.subs_lost || 0,
      } as MetricPoint & { watch_time_hours: number; subs_gained: number; subs_lost: number };
    });

    const first = rows[0]!;
    const last = rows[rows.length - 1]!;
    const followersDelta =
      first.followers > 0
        ? Number((((last.followers - first.followers) / first.followers) * 100).toFixed(1))
        : 0;

    const totalViews = rows.reduce((acc, row) => acc + row.views, 0);
    const totalLikes = rows.reduce((acc, row) => acc + row.likes, 0);
    const totalWatchTime = rows.reduce((acc, row) => acc + (row.watch_time_hours || 0), 0);
    const totalAvd = rows.reduce((acc, row) => acc + (row.avd_seconds || 0), 0);
    const avgAvd = rows.length > 0 ? totalAvd / rows.length : 0;
    const avgEngagement = totalViews > 0 ? Number(((totalLikes / totalViews) * 100).toFixed(2)) : 0;
    const totalSubsGained = rows.reduce((acc, row) => acc + (row.subs_gained || 0), 0);
    const totalSubsLost = rows.reduce((acc, row) => acc + (row.subs_lost || 0), 0);
    const totalRevenue = rows.reduce((acc, row) => acc + (row.estimated_revenue || 0), 0);

    return {
      id: "youtube",
      followers: last.followers,
      followersDelta,
      views: totalViews,
      likes: totalLikes,
      engagement_rate: avgEngagement,
      watch_time_hours: totalWatchTime,
      avd_seconds: avgAvd,
      subs_gained: totalSubsGained,
      subs_lost: totalSubsLost,
      estimated_revenue: totalRevenue,
      series,
    } as any;
  }, [youtubeQuery.data]);


  const snapshots = useMemo(() => {
    const mocks = buildSnapshots(days);
    return mocks.map((snap) =>
      snap.id === "youtube"
        ? (youtubeSnapshot ?? {
            ...snap,
            followers: 0,
            followersDelta: 0,
            views: 0,
            likes: 0,
            engagement_rate: 0,
            series: [],
          })
        : snap,
    );
  }, [days, youtubeSnapshot]);

  const current = snapshots.find((s) => s.id === selected) ?? snapshots[0]!;
  const meta = getPlatform(current.id);
  const isYoutube = selected === "youtube";

  const formatAvd = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const renderEvolutionCharts = (seriesData: any[]) => {
    if (seriesData.length === 0) {
      return (
        <p className="mt-8 text-base text-muted-foreground">
          Sem dados no período selecionado. Clique em “Sincronizar agora” para baixar as métricas.
        </p>
      );
    }
    
    return (
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="h-[340px]">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Views por dia
          </p>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={seriesData}>
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
            <AreaChart data={seriesData}>
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
    );
  };

  return (
    <AppShell
      title="Métricas"
      subtitle="Audiência e engajamento por plataforma."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {isYoutube && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="gap-2"
            >
              <RefreshCw className={`size-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Sincronizar agora
            </Button>
          )}
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
              type="button"
              onClick={() => setSelected(platform.id)}
              aria-pressed={active}
              aria-label={`Visualizar métricas do ${platform.name}`}
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

      {isYoutube ? (
        <Tabs defaultValue="geral" className="mt-8">
          <TabsList className="mb-6 grid w-full max-w-[500px] grid-cols-3">
            <TabsTrigger value="geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="retencao">Retenção</TabsTrigger>
            <TabsTrigger value="audiencia">Audiência</TabsTrigger>
          </TabsList>
          
          <TabsContent value="geral">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <MetricTile
                label="Seguidores"
                value={formatFull(current.followers)}
                hint={`+${current.followersDelta}% no período`}
              />
              <MetricTile
                label="Views (Total no período)"
                value={formatNumber(current.views)}
                hint={(youtubeQuery.data?.length ?? 0) < 2
                    ? "acumulando dados desde hoje"
                    : "soma do período selecionado"
                }
              />
              <MetricTile
                label="Curtidas"
                value={formatNumber(current.likes)}
                hint="soma do período selecionado"
              />
            </div>
            <section className="panel mt-10 p-6">
              <h2 className="text-2xl font-semibold">
                Evolução — <span className={meta.textClass}>{meta.name}</span>
              </h2>
              <p className="text-base text-muted-foreground mt-1">
                Views por dia e crescimento de seguidores.
              </p>
              {youtubeQuery.isLoading ? (
                <p className="mt-8 text-base text-muted-foreground">Carregando dados...</p>
              ) : (
                renderEvolutionCharts(current.series)
              )}
            </section>
          </TabsContent>

          <TabsContent value="retencao">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-2">
              <MetricTile
                label="Tempo de Exibição (Horas)"
                value={`${formatNumber((current as any).watch_time_hours || 0)}h`}
                hint="horas assistidas no período"
              />
              <MetricTile
                label="Duração Média (AVD)"
                value={formatAvd((current as any).avd_seconds || 0)}
                hint="tempo médio por view no período"
              />
            </div>
            
            <section className="panel mt-10 p-6">
              <h2 className="text-2xl font-semibold">
                Tempo de Exibição (Horas)
              </h2>
              <p className="text-base text-muted-foreground mt-1">
                Evolução diária das horas consumidas pelo seu público.
              </p>
              {youtubeQuery.isLoading ? (
                <p className="mt-8 text-base text-muted-foreground">Carregando dados...</p>
              ) : current.series.length === 0 ? (
                <p className="mt-8 text-base text-muted-foreground">Sem dados no período.</p>
              ) : (
                <div className="mt-8 h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={current.series}>
                      <defs>
                        <linearGradient id="watchTimeFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
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
                        tickFormatter={(v: number) => formatNumber(v)}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [formatFull(value), "Horas Assistidas"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="watch_time_hours"
                        stroke="var(--primary)"
                        strokeWidth={3}
                        fill="url(#watchTimeFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="audiencia">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-2">
              <MetricTile
                label="Inscritos Ganhos"
                value={`+${formatNumber((current as any).subs_gained || 0)}`}
                hint="ganhos no período"
              />
              <MetricTile
                label="Inscritos Perdidos"
                value={`-${formatNumber((current as any).subs_lost || 0)}`}
                hint="perdidos no período"
              />
            </div>
            
            <section className="panel mt-10 p-6">
              <h2 className="text-2xl font-semibold">
                Fluxo de Inscritos
              </h2>
              <p className="text-base text-muted-foreground mt-1">
                Ganhos e perdas diárias.
              </p>
              {youtubeQuery.isLoading ? (
                <p className="mt-8 text-base text-muted-foreground">Carregando dados...</p>
              ) : current.series.length === 0 ? (
                <p className="mt-8 text-base text-muted-foreground">Sem dados no período.</p>
              ) : (
                <div className="mt-8 h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={current.series}>
                      <defs>
                        <linearGradient id="gainedFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--success)" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="var(--success)" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="lostFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.02} />
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
                        formatter={(value: number, name: string) => [formatFull(value), name === 'subs_gained' ? "Ganhos" : "Perdidos"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="subs_gained"
                        name="Ganhos"
                        stroke="var(--success)"
                        strokeWidth={3}
                        fill="url(#gainedFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="subs_lost"
                        name="Perdidos"
                        stroke="var(--destructive)"
                        strokeWidth={3}
                        fill="url(#lostFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Seguidores"
              value={formatFull(current.followers)}
              hint={`+${current.followersDelta}% no período`}
            />
            <MetricTile
              label="Views"
              value={formatNumber(current.views)}
              hint="crescimento no período selecionado"
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
            {renderEvolutionCharts(current.series)}
          </section>
        </>
      )}

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

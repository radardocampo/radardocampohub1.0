import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw, Video } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildSnapshots, type MetricPoint, type PlatformSnapshot } from "@/lib/mock-data";
import { CONTENT_PLATFORMS, formatFull, formatNumber, getPlatform, type PlatformId } from "@/lib/platforms";
import { supabase } from "@/integrations/supabase/client";
import {
  getYoutubeMetrics,
  getYoutubeMetricsPrevious,
  checkYoutubeHistoryExists,
  getYoutubeAudience,
  getYoutubeGeography,
  getYoutubeTrafficSources,
  getYoutubeTopVideos,
  getYoutubeBestPostingTime,
  getLatestSyncLog,
  getPlatformGoals,
  type YoutubeVideoRow,
} from "@/lib/youtube.functions";
import { formatAvd, formatCurrency } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const RANGES = [
  { days: 7, label: "Últimos 7 dias" },
  { days: 30, label: "Últimos 30 dias" },
  { days: 90, label: "Últimos 90 dias" },
  { days: null, label: "Todo período" },
] as const;

const countryDisplay = new Intl.DisplayNames(["pt-BR"], { type: "region" });
const getFlagEmoji = (countryCode: string) => {
  if (!countryCode || countryCode.length !== 2) return "";
  return countryCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
};

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  color: "var(--popover-foreground)",
} as const;

/** Translate YouTube API traffic source types to Portuguese labels. */
const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  YT_SEARCH: "Pesquisa do YouTube",
  EXT_URL: "Tráfego Externo",
  PLAYLIST: "Playlists",
  SUBSCRIBER: "Feed de Inscritos",
  NOTIFICATION: "Notificações",
  YT_CHANNEL: "Página do Canal",
  YT_OTHER_PAGE: "Outras Páginas YT",
  NO_LINK_OTHER: "Outros (Direto)",
  SHORTS: "Shorts",
  SHORTS_CONTENT_LINKS: "Links de Conteúdo Shorts",
  END_SCREEN: "Telas Finais",
  HASHTAGS: "Hashtags",
  LIVE: "Ao Vivo",
  RELATED_VIDEO: "Vídeos Sugeridos",
  CAMPAIGN_CARD: "Cards de Campanha",
  ANNOTATION: "Anotações",
  ADVERTISING: "Publicidade",
  PROMOTED: "Promovido",
  EXTERNAL_APP: "App Externo",
};



const formatTrafficSource = (type: string) =>
  TRAFFIC_SOURCE_LABELS[type] ?? type;

const PIE_COLORS = [
  "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
  "#FF9F40", "#7BC8A4", "#E7A9D1", "#86CBDB", "#C4B5FD",
];

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

/** Calculate percentage change between two values. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function MetricsPage() {
  const [days, setDays] = useState<number | null>(30);
  const [selected, setSelected] = useState<PlatformId>("youtube");
  const [activeTab, setActiveTab] = useState("geral");
  const [videoFilter, setVideoFilter] = useState<"all" | "shorts" | "long">("all");
  const [videoSort, setVideoSort] = useState<{ key: keyof YoutubeVideoRow; desc: boolean }>({ key: "views", desc: true });
  const queryClient = useQueryClient();

  const fetchYoutube = useServerFn(getYoutubeMetrics);
  const fetchYoutubePrev = useServerFn(getYoutubeMetricsPrevious);
  const fetchHistoryExists = useServerFn(checkYoutubeHistoryExists);
  const fetchAudience = useServerFn(getYoutubeAudience);
  const fetchGeography = useServerFn(getYoutubeGeography);
  const fetchTrafficSources = useServerFn(getYoutubeTrafficSources);
  const fetchTopVideos = useServerFn(getYoutubeTopVideos);
  const fetchBestTime = useServerFn(getYoutubeBestPostingTime);
  const fetchLatestSync = useServerFn(getLatestSyncLog);
  const fetchPlatformGoals = useServerFn(getPlatformGoals);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const goalsQuery = useQuery({
    queryKey: ["platform-goals", selected, currentMonth],
    queryFn: () => fetchPlatformGoals({ data: { platform_id: selected, period: currentMonth } }),
  });

  const syncLogQuery = useQuery({
    queryKey: ["sync-log", selected],
    queryFn: () => fetchLatestSync({ data: { platform_id: selected } }),
  });

  const historyExistsQuery = useQuery({
    queryKey: ["youtube-history-exists"],
    queryFn: () => fetchHistoryExists(),
  });

  const youtubeQuery = useQuery({
    queryKey: ["youtube-metrics", days],
    queryFn: () => fetchYoutube({ data: { days } }),
  });

  const youtubePrevQuery = useQuery({
    queryKey: ["youtube-metrics-prev", days],
    queryFn: () => fetchYoutubePrev({ data: { days } }),
  });

  // Audiência, geografia e tráfego são fotografias de uma janela fixa de 90 dias
  // (definida pela edge function sync-youtube-audience), não uma série diária.
  // Por isso não dependem do seletor de período "days" — mostram sempre o snapshot
  // mais recente sincronizado.
  const audienceQuery = useQuery({
    queryKey: ["youtube-audience"],
    queryFn: () => fetchAudience(),
    enabled: selected === "youtube",
  });

  const geographyQuery = useQuery({
    queryKey: ["youtube-geography"],
    queryFn: () => fetchGeography(),
    enabled: selected === "youtube",
  });

  const trafficQuery = useQuery({
    queryKey: ["youtube-traffic"],
    queryFn: () => fetchTrafficSources(),
    enabled: selected === "youtube",
  });

  const videosQuery = useQuery({
    queryKey: ["youtube-videos", days],
    queryFn: () => fetchTopVideos({ data: { days } }),
    enabled: selected === "youtube",
  });

  // Não depende de "days": analisa todo o histórico de vídeos sincronizado, não só o
  // período selecionado no topo da página (ver nota em getYoutubeBestPostingTime).
  const bestTimeQuery = useQuery({
    queryKey: ["youtube-best-time"],
    queryFn: () => fetchBestTime(),
    enabled: selected === "youtube",
  });

  // --- Sync mutation: um único botão "inteligente".
  //     Se ainda não há histórico salvo (historyExistsQuery), faz o backfill completo
  //     (mais lento, refaz tudo desde a criação do canal). Se já há histórico, faz só a
  //     atualização rápida dos últimos 14 dias (sync-youtube-metrics), que é o caso do
  //     dia a dia. Assim o usuário não precisa escolher manualmente qual rodar. ---
  const syncMutation = useMutation({
    mutationFn: async () => {
      const isFirstSync = historyExistsQuery.data === false;
      const fnName = isFirstSync ? "backfill-youtube-history" : "sync-youtube-metrics";
      const { data, error } = await supabase.functions.invoke(fnName, {
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
      return { data, isFirstSync };
    },
    onMutate: () => {
      const isFirstSync = historyExistsQuery.data === false;
      toast.info(
        isFirstSync
          ? "Nenhum histórico encontrado — preenchendo todo o histórico do canal. Isso pode levar alguns segundos..."
          : "Sincronizando os últimos 14 dias do YouTube...",
        { id: "sync-youtube" },
      );
    },
    onSuccess: async ({ isFirstSync }) => {
      toast.success(
        isFirstSync ? "Histórico preenchido com sucesso!" : "Sincronização concluída com sucesso!",
        { id: "sync-youtube" },
      );
      await queryClient.invalidateQueries({ queryKey: ["youtube-metrics"] });
      await queryClient.invalidateQueries({ queryKey: ["youtube-metrics-prev"] });
      await queryClient.invalidateQueries({ queryKey: ["youtube-history-exists"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-log"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      const hint = message.toLowerCase().includes("canal não encontrado")
        ? " Verifique o secret YOUTUBE_CHANNEL_ID no Supabase (deve ser o ID do canal, começando com UC...)."
        : "";
      toast.error(`Falha ao sincronizar: ${message}${hint}`, {
        id: "sync-youtube",
        duration: 8000,
      });
    },
  });

  // --- Sync mutation: audience + videos (comments now sync from their own page, /comentarios) ---
  const syncAudienceVideosMutation = useMutation({
    mutationFn: async () => {
      // Call audience sync
      const { error: err1, data: d1 } = await supabase.functions.invoke("sync-youtube-audience", { method: "POST" });
      if (err1) {
        let detail = err1.message;
        const response = (err1 as { context?: Response }).context;
        if (response && typeof response.json === "function") {
          try { const body = await response.clone().json(); if (body?.error) detail = String(body.error); } catch {}
        }
        throw new Error(`Audiência: ${detail}`);
      }

      // Call videos sync
      const { error: err2, data: d2 } = await supabase.functions.invoke("sync-youtube-videos", { method: "POST" });
      if (err2) {
        let detail = err2.message;
        const response = (err2 as { context?: Response }).context;
        if (response && typeof response.json === "function") {
          try { const body = await response.clone().json(); if (body?.error) detail = String(body.error); } catch {}
        }
        throw new Error(`Vídeos: ${detail}`);
      }

      return { audience: d1, videos: d2 };
    },
    onMutate: () => {
      toast.info("Sincronizando audiência e vídeos...", { id: "sync-audience-videos" });
    },
    onSuccess: async () => {
      toast.success("Audiência e vídeos sincronizados!", { id: "sync-audience-videos" });
      await queryClient.invalidateQueries({ queryKey: ["youtube-audience"] });
      await queryClient.invalidateQueries({ queryKey: ["youtube-geography"] });
      await queryClient.invalidateQueries({ queryKey: ["youtube-traffic"] });
      await queryClient.invalidateQueries({ queryKey: ["youtube-videos"] });
      await queryClient.invalidateQueries({ queryKey: ["youtube-best-time"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-log"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Falha: ${message}`, { id: "sync-audience-videos", duration: 8000 });
    },
  });

  // --- Compute current period metrics ---
  const youtubeSnapshot = useMemo(() => {
    const rows = youtubeQuery.data ?? [];
    if (rows.length === 0) return null;

    const series: MetricPoint[] = rows.map((row) => {
      const parsed = new Date(`${row.date}T00:00:00`);
      return {
        date: row.date,
        label: parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        followers: row.followers,
        views: row.views,
        likes: row.likes,
        comments: row.comments || 0,
        shares: row.shares || 0,
        engagement_rate: row.engagement_rate,
        watch_time_hours: row.watch_time_hours || 0,
        avd_seconds: row.avd_seconds || 0,
        subs_gained: row.subs_gained || 0,
        subs_lost: row.subs_lost || 0,
        synced_at: row.synced_at,
        views_estimated: row.views_estimated || false,
      } as MetricPoint & {
        comments: number;
        shares: number;
        watch_time_hours: number;
        avd_seconds: number;
        subs_gained: number;
        subs_lost: number;
        synced_at?: string;
        views_estimated?: boolean;
      };
    });

    const first = rows[0]!;
    const last = rows[rows.length - 1]!;
    const followersDelta =
      first.followers > 0
        ? Number((((last.followers - first.followers) / first.followers) * 100).toFixed(1))
        : 0;

    const totalViews = rows.reduce((acc, row) => acc + row.views, 0);
    const totalLikes = rows.reduce((acc, row) => acc + row.likes, 0);
    const totalComments = rows.reduce((acc, row) => acc + (row.comments || 0), 0);
    const totalShares = rows.reduce((acc, row) => acc + (row.shares || 0), 0);
    const totalWatchTime = rows.reduce((acc, row) => acc + (row.watch_time_hours || 0), 0);
    // Ponderado por views (mesmo método usado no AVD por vídeo na aba "Vídeos"),
    // em vez de uma média simples dos AVDs diários — evita que um dia com poucas
    // views e AVD alto distorça a média do período.
    const avdWeightedSum = rows.reduce((acc, row) => acc + (row.avd_seconds || 0) * row.views, 0);
    const avgAvd = totalViews > 0 ? avdWeightedSum / totalViews : 0;
    const avgEngagement = totalViews > 0 ? Number((((totalLikes + totalComments) / totalViews) * 100).toFixed(2)) : 0;
    const totalSubsGained = rows.reduce((acc, row) => acc + (row.subs_gained || 0), 0);
    const totalSubsLost = rows.reduce((acc, row) => acc + (row.subs_lost || 0), 0);
    const totalRevenue = rows.reduce((acc, row) => acc + (row.estimated_revenue || 0), 0);

    return {
      id: "youtube",
      followers: last.followers,
      followersDelta,
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      engagement_rate: avgEngagement,
      watch_time_hours: totalWatchTime,
      avd_seconds: avgAvd,
      subs_gained: totalSubsGained,
      subs_lost: totalSubsLost,
      estimated_revenue: totalRevenue,
      series,
    } as any;
  }, [youtubeQuery.data]);

  // --- Compute previous period for percentage changes ---
  const prevTotals = useMemo(() => {
    const rows = youtubePrevQuery.data ?? [];
    if (rows.length === 0) return null;
    return {
      views: rows.reduce((acc, row) => acc + row.views, 0),
      likes: rows.reduce((acc, row) => acc + row.likes, 0),
      comments: rows.reduce((acc, row) => acc + (row.comments || 0), 0),
      shares: rows.reduce((acc, row) => acc + (row.shares || 0), 0),
      engagement_rate: (() => {
        const tv = rows.reduce((a, r) => a + r.views, 0);
        const tl = rows.reduce((a, r) => a + r.likes, 0);
        const tc = rows.reduce((a, r) => a + (r.comments || 0), 0);
        return tv > 0 ? Number((((tl + tc) / tv) * 100).toFixed(2)) : 0;
      })(),
    };
  }, [youtubePrevQuery.data]);

  const snapshots = useMemo(() => {
    const mocks = buildSnapshots(days ?? 365);
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

  // --- Find peak day for views annotation ---
  const peakDay = useMemo(() => {
    if (!isYoutube || !current.series || current.series.length === 0) return null;
    let maxIdx = 0;
    let maxViews = 0;
    current.series.forEach((point: any, idx: number) => {
      if (point.views > maxViews) {
        maxViews = point.views;
        maxIdx = idx;
      }
    });
    const peakPoint = current.series[maxIdx] as any;
    // Find closest published video to the peak date
    const videos = videosQuery.data ?? [];
    let closestVideo: YoutubeVideoRow | null = null;
    let closestDist = Infinity;
    const peakDate = new Date(peakPoint.date + "T00:00:00").getTime();
    for (const v of videos) {
      const dist = Math.abs(new Date(v.published_at).getTime() - peakDate);
      if (dist < closestDist) {
        closestDist = dist;
        closestVideo = v;
      }
    }
    // Only show annotation if video was published within 3 days of peak
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    return {
      label: peakPoint.label,
      views: maxViews,
      videoTitle: closestVideo && closestDist <= threeDaysMs ? closestVideo.title : null,
    };
  }, [current.series, isYoutube, videosQuery.data]);

  const filteredVideos = useMemo(() => {
    let result = [...(videosQuery.data ?? [])];
    if (videoFilter === "shorts") result = result.filter((v) => v.duration_seconds <= 180);
    else if (videoFilter === "long") result = result.filter((v) => v.duration_seconds > 180);

    if (videoSort.key) {
      result.sort((a: any, b: any) => {
        let valA = a[videoSort.key!];
        let valB = b[videoSort.key!];
        
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        
        if (valA < valB) return videoSort.desc ? 1 : -1;
        if (valA > valB) return videoSort.desc ? -1 : 1;
        return 0;
      });
    }
    return result;
  }, [videosQuery.data, videoSort, videoFilter]);

  const handleExportCSV = () => {
    let csv = "";
    if (activeTab === "geral") {
       csv = "Data,Seguidores,Views,Curtidas,Comentarios,Compartilhamentos,Engajamento\n";
       if (current && current.series) {
         current.series.forEach((r: any) => {
           csv += `${r.date},${r.followers},${r.views},${r.likes},${r.comments || 0},${r.shares || 0},${r.engagement_rate}\n`;
         });
       }
    } else if (activeTab === "retencao" && isYoutube) {
       csv = "Data,Tempo de Exibicao (h),AVD (s)\n";
       if (current && current.series) {
         current.series.forEach((r: any) => {
           csv += `${r.date},${r.watch_time_hours || 0},${r.avd_seconds || 0}\n`;
         });
       }
    } else if (activeTab === "audiencia" && isYoutube) {
       csv = "Data,Inscritos Ganhos,Inscritos Perdidos\n";
       if (current && current.series) {
         current.series.forEach((r: any) => {
           csv += `${r.date},${r.subs_gained || 0},${r.subs_lost || 0}\n`;
         });
       }
    } else if (activeTab === "videos" && isYoutube) {
       csv = "Video_ID,Titulo,Data,Views,Curtidas,Comentarios,Engajamento,Tempo(h),AVD(s)\n";
       filteredVideos.forEach(v => {
         const safeTitle = v.title ? v.title.replace(/,/g, "") : "";
         csv += `${v.video_id},${safeTitle},${v.published_at.split("T")[0]},${v.views},${v.likes},${v.comments},${(v as any).eng_rate?.toFixed(2) || 0},${v.watch_time_hours},${v.avg_view_duration_seconds}\n`;
       });
    }
    if (!csv) {
      toast.info("Nenhum dado para exportar nesta aba ainda.");
      return;
    }
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `export_${activeTab}_${selected}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Audience chart data ---
  const audienceChartData = useMemo(() => {
    const rows = audienceQuery.data ?? [];
    if (rows.length === 0) return [];
    const ageGroups = [...new Set(rows.map((r) => r.age_group))].sort();
    return ageGroups.map((age) => {
      const entry: Record<string, any> = { age_group: age.replace("age", "") };
      for (const r of rows) {
        if (r.age_group === age) {
          entry[r.gender] = r.gender === 'female' ? -r.viewer_percentage : r.viewer_percentage;
        }
      }
      return entry;
    });
  }, [audienceQuery.data]);

  const renderEvolutionCharts = (seriesData: any[]) => {
    if (seriesData.length === 0) {
      return (
        <p className="mt-8 text-base text-muted-foreground">
          Sem dados no período selecionado. Clique em "Sincronizar agora" para baixar as métricas.
        </p>
      );
    }
    
    return (
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="h-[340px]">
          <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Views por dia
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            {seriesData[seriesData.length - 1]?.views_estimated
              ? "O último dia ainda não foi processado pelo YouTube Analytics — o número mostrado é uma estimativa baseada nas views totais do canal, e será substituído pelo valor real na próxima sincronização."
              : " "}
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
              {peakDay && (
                <ReferenceDot
                  x={peakDay.label}
                  y={peakDay.views}
                  r={6}
                  fill={meta.color}
                  stroke="var(--background)"
                  strokeWidth={2}
                  label={{
                    value: peakDay.videoTitle
                      ? `📈 ${peakDay.videoTitle.slice(0, 30)}${peakDay.videoTitle.length > 30 ? "…" : ""}`
                      : "📈 Pico",
                    position: "top",
                    fill: "var(--foreground)",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
              )}
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

  const toggleSort = (key: keyof YoutubeVideoRow) => {
    setVideoSort((prev) =>
      prev.key === key ? { key, desc: !prev.desc } : { key, desc: true }
    );
  };

  return (
    <AppShell
      title="Métricas"
      subtitle="Audiência e engajamento por plataforma."
      hideDemoWarning={isYoutube}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {isYoutube && (
            <div className="flex items-center gap-3">
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => syncAudienceVideosMutation.mutate()}
                      disabled={syncAudienceVideosMutation.isPending}
                      className="h-9 px-3 text-sm font-medium"
                    >
                      <RefreshCw
                        className={`mr-2 size-4 ${syncAudienceVideosMutation.isPending ? "animate-spin" : ""}`}
                      />
                      Sincronizar Audiência e Vídeos
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Atualiza os dados demográficos e vídeos (últimos 90 dias) do YouTube.
                  </TooltipContent>
                </UITooltip>

                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => syncMutation.mutate()}
                      disabled={syncMutation.isPending}
                      className="h-9 px-3 text-sm font-medium"
                    >
                      <RefreshCw className={`mr-2 size-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                      Sincronizar Visão Geral
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Atualiza as métricas diárias gerais (views, inscritos, engajamento).
                    {historyExistsQuery.data === false
                      ? " Nenhum histórico encontrado ainda — vai buscar tudo desde a criação do canal (mais lento)."
                      : " Busca só os últimos 14 dias (rápido)."}
                    {current?.series?.[current.series.length - 1]?.synced_at && (
                      <span className="block mt-1 text-muted-foreground">
                        Última sync: {new Date(current.series[current.series.length - 1].synced_at).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
              {syncLogQuery.data && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">
                  Última sync: há {
                    (() => {
                      const mins = Math.floor((new Date().getTime() - new Date(syncLogQuery.data.run_at).getTime()) / 60000);
                      if (mins < 60) return `${mins}m`;
                      if (mins < 1440) return `${Math.floor(mins/60)}h`;
                      return `${Math.floor(mins/1440)}d`;
                    })()
                  }
                  <span className={`flex items-center gap-1 font-medium ${
                    syncLogQuery.data.status === 'success' ? 'text-success'
                    : syncLogQuery.data.status === 'warning' ? 'text-warning'
                    : 'text-destructive'
                  }`}>
                    · {syncLogQuery.data.status === 'success' ? 'sucesso' : syncLogQuery.data.status === 'warning' ? 'aviso' : 'erro'}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-sm font-medium"
              onClick={handleExportCSV}
            >
              Exportar CSV
            </Button>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="mb-8 grid w-full max-w-[640px] grid-cols-4">
            <TabsTrigger value="geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="retencao">Retenção</TabsTrigger>
            <TabsTrigger value="audiencia">Audiência</TabsTrigger>
            <TabsTrigger value="videos">Vídeos</TabsTrigger>
          </TabsList>
          
          {/* ============================================================
              TAB: VISÃO GERAL
              ============================================================ */}
          <TabsContent value="geral">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <MetricTile
                label="Seguidores"
                value={formatFull(current.followers)}
                hint={`+${current.followersDelta}% no período`}
              />
              <MetricTile
                label="Views"
                value={formatNumber(current.views)}
                hint={
                  prevTotals
                    ? (() => {
                        const delta = pctChange(current.views, prevTotals.views);
                        return delta !== null ? `${delta > 0 ? "+" : ""}${delta}% vs período anterior` : "soma do período";
                      })()
                    : (youtubeQuery.data?.length ?? 0) < 2
                      ? "acumulando dados desde hoje"
                      : "soma do período selecionado"
                }
              />
              <MetricTile
                label="Curtidas"
                value={formatNumber(current.likes)}
                hint={
                  prevTotals
                    ? (() => {
                        const delta = pctChange(current.likes, prevTotals.likes);
                        return delta !== null ? `${delta > 0 ? "+" : ""}${delta}% vs período anterior` : "soma do período";
                      })()
                    : "soma do período selecionado"
                }
              />
              <MetricTile
                label="Comentários"
                value={formatNumber(current.comments || 0)}
                hint={
                  prevTotals
                    ? (() => {
                        const delta = pctChange(current.comments || 0, prevTotals.comments || 0);
                        return delta !== null ? `${delta > 0 ? "+" : ""}${delta}% vs período anterior` : "soma do período";
                      })()
                    : "soma do período selecionado"
                }
              />
              <MetricTile
                label="Compartilhamentos"
                value={formatNumber(current.shares || 0)}
                hint={
                  prevTotals
                    ? (() => {
                        const delta = pctChange(current.shares || 0, prevTotals.shares || 0);
                        return delta !== null ? `${delta > 0 ? "+" : ""}${delta}% vs período anterior` : "soma do período";
                      })()
                    : "soma do período selecionado"
                }
              />
              <MetricTile
                label="Engajamento"
                value={`${current.engagement_rate}%`}
                hint="médio do período selecionado"
              />
              <MetricTile
                label="Receita Estimada"
                value={formatCurrency((current as any).estimated_revenue, "USD")}
                hint="soma do período (AdSense, em USD)"
              />
            </div>

            {goalsQuery.data && goalsQuery.data.length > 0 && (
              <section className="panel mt-6 p-6">
                <h3 className="text-lg font-semibold mb-4">Metas do Mês</h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  {goalsQuery.data.map(goal => {
                    const metricValues: Record<string, number> = {
                      views: current.views,
                      followers: current.followers,
                      likes: current.likes,
                      comments: current.comments || 0,
                      shares: current.shares || 0,
                      watch_time_hours: (current as any).watch_time_hours || 0,
                      subs_gained: (current as any).subs_gained || 0,
                    };
                    const currentValue = metricValues[goal.metric] ?? 0;

                    const percent = Math.min(100, Math.max(0, (currentValue / goal.target_value) * 100));

                    return (
                      <div key={goal.metric}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium capitalize">{goal.metric}</span>
                          <span className="text-muted-foreground">{formatNumber(currentValue)} / {formatNumber(goal.target_value)}</span>
                        </div>
                        <Progress value={percent} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            <section className="panel mt-10 p-6">
              <h2 className="text-2xl font-semibold">
                Evolução — <span className={meta.textClass}>{meta.name}</span>
              </h2>
              <p className="text-base text-muted-foreground mt-1">
                Views por dia e crescimento de seguidores.
              </p>
              {youtubeQuery.isLoading ? (
                <p className="mt-8 text-base text-muted-foreground">Carregando dados...</p>
              ) : current.series.length === 0 ? (
                <p className="mt-8 text-base text-muted-foreground">
                  Sem dados no período selecionado. Clique em “Sincronizar agora” para baixar as
                  métricas.
                </p>
              ) : (
                renderEvolutionCharts(current.series)
              )}
            </section>
          </TabsContent>

          {/* ============================================================
              TAB: RETENÇÃO
              ============================================================ */}
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

          {/* ============================================================
              TAB: AUDIÊNCIA
              ============================================================ */}
          <TabsContent value="audiencia">
            {/* Existing: subscriber flow cards */}
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
            
            {/* Existing: subscriber flow chart */}
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
                        formatter={(value: number, name: string) => [formatFull(value), name]}
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

            {/* NEW: Demographics (age × gender bar chart) */}
            <section className="panel mt-10 p-6">
              <h2 className="text-2xl font-semibold">Demografia</h2>
              <p className="text-base text-muted-foreground mt-1">
                Distribuição de audiência por faixa etária e gênero, com base nos últimos 90 dias
                (atualizado na última sincronização de Audiência e Vídeos).
              </p>
              {audienceQuery.isLoading ? (
                <p className="mt-8 text-base text-muted-foreground">Carregando dados...</p>
              ) : audienceChartData.length === 0 ? (
                <p className="mt-8 text-base text-muted-foreground">
                  Dados insuficientes para este período. A API do YouTube pode não retornar dados demográficos para canais menores ou períodos curtos.
                </p>
              ) : (
                <div className="mt-8 h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={audienceChartData} layout="vertical" stackOffset="sign">
                      <CartesianGrid stroke="var(--border)" horizontal={false} strokeDasharray="4 4" />
                      <XAxis type="number" stroke="var(--muted-foreground)" fontSize={13} tickFormatter={(v: number) => `${Math.abs(v)}%`} />
                      <YAxis type="category" dataKey="age_group" stroke="var(--muted-foreground)" fontSize={13} width={56} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${Math.abs(value)}%`, ""]} />
                      <Legend />
                      <Bar dataKey="female" name="Feminino" fill="#FF6384" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="male" name="Masculino" fill="#36A2EB" stackId="a" radius={[0, 0, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* NEW: Geography (top countries table) */}
            <section className="panel mt-10 p-6">
              <h2 className="text-2xl font-semibold">Top Países por Views</h2>
              <p className="text-base text-muted-foreground mt-1">
                Distribuição geográfica da audiência com base nos últimos 90 dias (atualizado na
                última sincronização de Audiência e Vídeos).
              </p>
              {geographyQuery.isLoading ? (
                <p className="mt-8 text-base text-muted-foreground">Carregando dados...</p>
              ) : (geographyQuery.data?.length ?? 0) === 0 ? (
                <p className="mt-8 text-base text-muted-foreground">
                  Dados insuficientes. Clique em "Sincronizar Audiência e Vídeos" para buscar os dados.
                </p>
              ) : (
                <table className="mt-6 w-full text-base">
                  <thead className="text-left text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="pb-4">País</th>
                      <th className="pb-4">Views</th>
                      <th className="pb-4">Tempo (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(geographyQuery.data ?? []).map((row) => {
                      const flag = getFlagEmoji(row.country_code);
                      const name = countryDisplay.of(row.country_code) || row.country_code;
                      return (
                        <tr key={row.country_code} className="border-t border-border/50 hover:bg-surface-2 transition-colors">
                          <td className="py-3 font-medium flex items-center gap-2">
                            <span>{flag}</span> {name}
                          </td>
                          <td className="py-3">{formatFull(row.views)}</td>
                          <td className="py-3">{formatNumber(row.watch_time_minutes)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>

            {/* NEW: Traffic Sources (horizontal bar or pie chart) */}
            <section className="panel mt-10 p-6">
              <h2 className="text-2xl font-semibold">Origens de Tráfego</h2>
              <p className="text-base text-muted-foreground mt-1">
                De onde vêm as visualizações, com base nos últimos 90 dias (atualizado na última
                sincronização de Audiência e Vídeos).
              </p>
              {trafficQuery.isLoading ? (
                <p className="mt-8 text-base text-muted-foreground">Carregando dados...</p>
              ) : (trafficQuery.data?.length ?? 0) === 0 ? (
                <p className="mt-8 text-base text-muted-foreground">
                  Dados insuficientes. Clique em "Sincronizar Audiência e Vídeos" para buscar os dados.
                </p>
              ) : (
                <div className="mt-8">
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(trafficQuery.data ?? []).map((r) => ({
                          name: TRAFFIC_SOURCE_LABELS[r.traffic_source_type] ?? r.traffic_source_type,
                          views: r.views,
                        }))}
                        layout="vertical"
                        margin={{ left: 140 }}
                      >
                        <CartesianGrid stroke="var(--border)" horizontal={false} strokeDasharray="4 4" />
                        <XAxis type="number" stroke="var(--muted-foreground)" fontSize={13} tickFormatter={(v: number) => formatNumber(v)} />
                        <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} width={130} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatFull(value), "Views"]} />
                        <Bar dataKey="views" fill={meta.color} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </section>
          </TabsContent>

          {/* ============================================================
              TAB: VÍDEOS
              ============================================================ */}
          <TabsContent value="videos">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="flex gap-1 rounded-lg bg-secondary p-1">
                {(["all", "long", "shorts"] as const).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={videoFilter === f ? "default" : "ghost"}
                    onClick={() => setVideoFilter(f)}
                    className="px-4 text-sm font-medium"
                  >
                    {f === "all" ? "Todos" : f === "shorts" ? "Shorts (≤ 3min)" : "Vídeos Longos"}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {filteredVideos.length} vídeo{filteredVideos.length !== 1 ? "s" : ""}
                {days !== null && " publicado" + (filteredVideos.length !== 1 ? "s" : "") + " nos últimos " + days + " dias"}
              </p>
            </div>

            {/* NEW: Videos Summary Cards */}
            {filteredVideos.length > 0 && (
              <div className="grid gap-6 md:grid-cols-3 mb-8">
                <MetricTile
                  label="Total de Views (Filtro)"
                  value={formatNumber(filteredVideos.reduce((acc, v) => acc + v.views, 0))}
                  hint={`${filteredVideos.length} vídeos listados`}
                />
                <MetricTile
                  label="Média de Views / Vídeo"
                  value={formatNumber(Math.round(filteredVideos.reduce((acc, v) => acc + v.views, 0) / filteredVideos.length))}
                  hint="Desempenho médio"
                />
                <MetricTile
                  label="Tempo de Exibição"
                  value={`${formatNumber(filteredVideos.reduce((acc, v) => acc + v.watch_time_hours, 0))}h`}
                  hint="Horas assistidas"
                />
              </div>
            )}

            {/* NEW: Best Posting Time */}
            {(bestTimeQuery.isLoading || bestTimeQuery.data) && (
              <section className="panel mb-8 p-6">
                <h2 className="text-xl font-semibold mb-1">Melhor Horário para Postar</h2>
                {bestTimeQuery.isLoading || !bestTimeQuery.data ? (
                  <p className="text-sm text-muted-foreground">Analisando horários...</p>
                ) : !bestTimeQuery.data.hasEnoughData ? (
                  <p className="text-sm text-muted-foreground">
                    Dados insuficientes para sugerir horários consistentes (requer pelo menos 3 vídeos no mesmo horário).
                  </p>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Baseado nos <strong>{bestTimeQuery.data.totalVideosAnalyzed} vídeos</strong> do canal
                      {bestTimeQuery.data.earliestPublishedAt
                        ? ` publicados desde ${new Date(bestTimeQuery.data.earliestPublishedAt).toLocaleDateString("pt-BR")}`
                        : ""}
                      , sempre — não muda com o período selecionado acima. Cada card abaixo mostra quantos
                      desses vídeos caíram naquele dia + horário específico (há até 28 combinações possíveis,
                      então poucos vídeos por combinação é esperado).
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                      {bestTimeQuery.data.blocks.slice(0, 3).map((block: any, idx: number) => {
                        const isTop = idx === 0;
                        const diff = bestTimeQuery.data.overallAvgViews > 0
                          ? ((block.avg_views - bestTimeQuery.data.overallAvgViews) / bestTimeQuery.data.overallAvgViews) * 100
                          : 0;
                        return (
                          <div key={block.key} className={`rounded-xl p-4 border ${isTop ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-surface-2'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              {isTop && <span className="text-lg">🔥</span>}
                              <h3 className="font-semibold">{block.key}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">
                              Média de <strong>{formatNumber(Math.round(block.avg_views))} views</strong>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ({block.count} de {bestTimeQuery.data.totalVideosAnalyzed} vídeos publicados neste dia + horário)
                            </p>
                            {diff > 0 && (
                              <span className="text-xs text-success font-medium inline-block mt-2">
                                +{diff.toFixed(0)}% vs média
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {videosQuery.isLoading ? (
              <div className="space-y-4 mt-8">
                <Skeleton className="h-[200px] w-full" />
                <Skeleton className="h-[400px] w-full" />
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-xl border-border bg-surface-1/50 my-8">
                 <Video className="size-12 text-muted-foreground/30 mb-4" />
                 <h3 className="text-xl font-semibold mb-2">Nenhum vídeo no período</h3>
                 <p className="text-muted-foreground max-w-sm">
                   Ajuste a janela de tempo acima ou clique em "Sincronizar Audiência e Vídeos" para buscar os dados mais recentes.
                 </p>
              </div>
            ) : (
              <>
                <div className="mb-8 grid gap-6 sm:grid-cols-2">
                  <MetricTile
                    label="Média - Shorts (≤ 3m)"
                    value={(() => {
                      const shorts = (videosQuery.data ?? []).filter(v => v.duration_seconds <= 180);
                      if (!shorts.length) return "N/A";
                      const avgViews = shorts.reduce((acc, v) => acc + v.views, 0) / shorts.length;
                      return `${formatNumber(Math.round(avgViews))} views`;
                    })()}
                    hint={(() => {
                      const shorts = (videosQuery.data ?? []).filter(v => v.duration_seconds <= 180);
                      if (!shorts.length) return "";
                      const avgAvd = shorts.reduce((acc, v) => acc + v.avg_view_duration_seconds, 0) / shorts.length;
                      return `${formatAvd(avgAvd)} retenção média`;
                    })()}
                  />
                  <MetricTile
                    label="Média - Vídeos Longos (> 3m)"
                    value={(() => {
                      const longs = (videosQuery.data ?? []).filter(v => v.duration_seconds > 180);
                      if (!longs.length) return "N/A";
                      const avgViews = longs.reduce((acc, v) => acc + v.views, 0) / longs.length;
                      return `${formatNumber(Math.round(avgViews))} views`;
                    })()}
                    hint={(() => {
                      const longs = (videosQuery.data ?? []).filter(v => v.duration_seconds > 180);
                      if (!longs.length) return "";
                      const avgAvd = longs.reduce((acc, v) => acc + v.avg_view_duration_seconds, 0) / longs.length;
                      return `${formatAvd(avgAvd)} retenção média`;
                    })()}
                  />
                </div>
                <div className="overflow-x-auto panel p-4">
                  <table className="w-full min-w-[950px] text-base">
                  <thead className="text-left text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="pb-4 pl-2">Vídeo</th>
                      <th className="pb-4 cursor-pointer select-none" onClick={() => toggleSort("published_at")}>
                        Data {videoSort.key === "published_at" ? (videoSort.desc ? "↓" : "↑") : ""}
                      </th>
                      <th className="pb-4 cursor-pointer select-none" onClick={() => toggleSort("views")}>
                        Views {videoSort.key === "views" ? (videoSort.desc ? "↓" : "↑") : ""}
                      </th>
                      <th className="pb-4 cursor-pointer select-none" onClick={() => toggleSort("likes")}>
                        Curtidas {videoSort.key === "likes" ? (videoSort.desc ? "↓" : "↑") : ""}
                      </th>
                      <th className="pb-4 cursor-pointer select-none" onClick={() => toggleSort("comments")}>
                        Comentários {videoSort.key === "comments" ? (videoSort.desc ? "↓" : "↑") : ""}
                      </th>
                      <th className="pb-4 cursor-pointer select-none" onClick={() => toggleSort("eng_rate" as any)}>
                        Engajamento {videoSort.key === ("eng_rate" as any) ? (videoSort.desc ? "↓" : "↑") : ""}
                      </th>
                      <th className="pb-4 cursor-pointer select-none" onClick={() => toggleSort("watch_time_hours")}>
                        Tempo {videoSort.key === "watch_time_hours" ? (videoSort.desc ? "↓" : "↑") : ""}
                      </th>
                      <th className="pb-4 cursor-pointer select-none" onClick={() => toggleSort("avg_view_duration_seconds")}>
                        AVD {videoSort.key === "avg_view_duration_seconds" ? (videoSort.desc ? "↓" : "↑") : ""}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVideos.map((video) => (
                      <tr
                        key={video.video_id}
                        className="border-t border-border/50 hover:bg-surface-2 transition-colors"
                      >
                        <td className="py-3 pl-2">
                          <div className="flex items-center gap-3">
                            {video.thumbnail_url ? (
                              <img
                                src={video.thumbnail_url}
                                alt=""
                                className="h-16 w-28 rounded-md object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="h-16 w-28 rounded-md bg-secondary flex-shrink-0 flex items-center justify-center">
                                <Video className="size-6 text-muted-foreground opacity-50" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[280px]" title={video.title}>
                                {video.title}
                              </p>
                              {video.duration_seconds <= 180 && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
                                  Short
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(video.published_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 font-semibold">{formatNumber(video.views)}</td>
                        <td className="py-3">{formatNumber(video.likes)}</td>
                        <td className="py-3">{formatNumber(video.comments)}</td>
                        <td className="py-3 font-medium text-success bg-success/10 px-2 py-0.5 rounded-md inline-flex mt-2">
                          {video.eng_rate?.toFixed(2)}%
                        </td>
                        <td className="py-3">{formatNumber(video.watch_time_hours)}h</td>
                        <td className="py-3">{formatAvd(video.avg_view_duration_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Seguidores"
              value={formatFull(current.followers)}
              hint={days === null ? "" : `+${current.followersDelta}% no período`}
            />
            <MetricTile
              label="Views"
              value={formatNumber(current.views)}
              hint={days === null ? "" : "crescimento no período selecionado"}
            />
            <MetricTile
              label="Curtidas"
              value={formatNumber(current.likes)}
              hint={days === null ? "" : "no período selecionado"}
            />
            <MetricTile
              label="Engajamento"
              value={`${current.engagement_rate}%`}
              hint={days === null ? "" : "média do período"}
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

      {/* Comparativo entre plataformas — rendered once, outside Tabs */}
      <section className="panel mt-10 overflow-x-auto p-6">
        <div className="flex items-baseline gap-4 flex-wrap">
          <h2 className="text-2xl font-semibold">Comparativo entre plataformas</h2>
          <p className="text-sm text-muted-foreground max-w-lg">
            Engajamento calculado de forma distinta por plataforma; compare tendências, não valores absolutos.
          </p>
        </div>
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
                      {snap.id !== "youtube" && (
                        <span className="ml-2 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          Demonstração
                        </span>
                      )}
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

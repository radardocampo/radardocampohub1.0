import { createServerFn } from "@tanstack/react-start";

export type YoutubeDailyRow = {
  date: string;
  followers: number;
  views: number;
  likes: number;
  engagement_rate: number;
  watch_time_hours?: number;
  avd_seconds?: number;
  subs_gained?: number;
  subs_lost?: number;
  estimated_revenue?: number | null;
  comments?: number;
  shares?: number;
  synced_at?: string;
  views_estimated?: boolean;
};

export type YoutubeAudienceRow = {
  age_group: string;
  gender: string;
  viewer_percentage: number;
};

export type YoutubeGeographyRow = {
  country_code: string;
  views: number;
  watch_time_minutes: number;
};

export type YoutubeTrafficSourceRow = {
  traffic_source_type: string;
  views: number;
};

export type YoutubeVideoRow = {
  video_id: string;
  title: string;
  thumbnail_url: string;
  published_at: string;
  duration_seconds: number;
  views: number;
  likes: number;
  comments: number;
  watch_time_hours: number;
  avg_view_duration_seconds: number;
  eng_rate?: number;
};

export type YoutubeCommentReplyRow = {
  reply_id: string;
  author_display_name: string;
  text_display: string;
  is_owner: boolean;
  published_at: string;
};

export type YoutubeModerationStatus = "published" | "heldForReview" | "likelySpam" | "rejected";

export type YoutubeCommentRow = {
  comment_id: string;
  video_id: string;
  video_title: string;
  video_thumbnail_url: string;
  author_display_name: string;
  author_profile_image_url: string;
  text_display: string;
  like_count: number;
  total_reply_count: number;
  has_owner_reply: boolean;
  can_reply: boolean;
  moderation_status: YoutubeModerationStatus;
  published_at: string;
  replies: YoutubeCommentReplyRow[];
};

/** Lê as métricas diárias reais do YouTube já salvas no banco. */
export const getYoutubeMetrics = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number | null }) => ({
    days: data.days === null ? null : Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<YoutubeDailyRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("metrics_daily")
      .select("date, followers, views, likes, engagement_rate, watch_time_hours, avd_seconds, subs_gained, subs_lost, estimated_revenue, comments, shares, synced_at, views_estimated")
      .eq("platform_id", "youtube")
      .order("date", { ascending: true });

    if (data.days !== null) {
      const from = new Date();
      from.setDate(from.getDate() - data.days);
      query = query.gte("date", from.toISOString().slice(0, 10));
    }

    const { data: rows, error } = await query;

    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      date: r.date,
      followers: Number(r.followers),
      views: Number(r.views),
      likes: Number(r.likes),
      engagement_rate: Number(r.engagement_rate),
      watch_time_hours: r.watch_time_hours ? Number(r.watch_time_hours) : 0,
      avd_seconds: r.avd_seconds ? Number(r.avd_seconds) : 0,
      subs_gained: r.subs_gained ? Number(r.subs_gained) : 0,
      subs_lost: r.subs_lost ? Number(r.subs_lost) : 0,
      estimated_revenue: r.estimated_revenue != null ? Number(r.estimated_revenue) : null,
      comments: r.comments ? Number(r.comments) : 0,
      shares: r.shares ? Number(r.shares) : 0,
      synced_at: r.synced_at,
      views_estimated: !!(r as { views_estimated?: boolean }).views_estimated,
    }));
  });

/** Busca métricas do período anterior para cálculo de variação percentual. */
export const getYoutubeMetricsPrevious = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number | null }) => ({
    days: data.days === null ? null : Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<YoutubeDailyRow[]> => {
    if (data.days === null) return []; // No previous period for "all time"
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = new Date();
    const to = new Date();
    from.setDate(from.getDate() - data.days * 2);
    to.setDate(to.getDate() - data.days);
    const { data: rows, error } = await supabaseAdmin
      .from("metrics_daily")
      .select("date, followers, views, likes, engagement_rate, watch_time_hours, avd_seconds, subs_gained, subs_lost, estimated_revenue, comments, shares, synced_at")
      .eq("platform_id", "youtube")
      .gte("date", from.toISOString().slice(0, 10))
      .lt("date", to.toISOString().slice(0, 10))
      .order("date", { ascending: true });

    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      date: r.date,
      followers: Number(r.followers),
      views: Number(r.views),
      likes: Number(r.likes),
      engagement_rate: Number(r.engagement_rate),
      watch_time_hours: r.watch_time_hours ? Number(r.watch_time_hours) : 0,
      avd_seconds: r.avd_seconds ? Number(r.avd_seconds) : 0,
      subs_gained: r.subs_gained ? Number(r.subs_gained) : 0,
      subs_lost: r.subs_lost ? Number(r.subs_lost) : 0,
      estimated_revenue: r.estimated_revenue != null ? Number(r.estimated_revenue) : null,
      comments: r.comments ? Number(r.comments) : 0,
      shares: r.shares ? Number(r.shares) : 0,
      synced_at: r.synced_at,
    }));
  });

export const checkYoutubeHistoryExists = createServerFn({ method: "GET" })
  .handler(async (): Promise<boolean> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: row, error } = await supabaseAdmin
      .from("metrics_daily")
      .select("id")
      .eq("platform_id", "youtube")
      .lt("date", sevenDaysAgo.toISOString().slice(0, 10))
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return !!row;
  });

/**
 * Lê dados de audiência demográfica (idade × gênero).
 *
 * Cada linha em `youtube_audience_daily` já é uma fotografia agregada de uma
 * janela fixa de 90 dias (definida pela edge function sync-youtube-audience),
 * marcada com a data em que a sincronização rodou — não uma métrica por dia.
 * Por isso lemos apenas o snapshot mais recente, em vez de somar/tirar média
 * de várias janelas de 90 dias sobrepostas (o que não teria significado
 * estatístico e ignoraria o parâmetro de período da UI de qualquer forma).
 */
export const getYoutubeAudience = createServerFn({ method: "GET" })
  .handler(async (): Promise<YoutubeAudienceRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: latest, error: latestError } = await supabaseAdmin
      .from("youtube_audience_daily")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw new Error(latestError.message);
    if (!latest) return [];

    const { data: rows, error } = await supabaseAdmin
      .from("youtube_audience_daily")
      .select("age_group, gender, viewer_percentage")
      .eq("date", latest.date);
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => ({
      age_group: r.age_group,
      gender: r.gender,
      viewer_percentage: Number(r.viewer_percentage),
    }));
  });

/**
 * Lê dados geográficos (top países por views).
 * Ver nota em `getYoutubeAudience`: lê apenas o snapshot mais recente de 90 dias.
 */
export const getYoutubeGeography = createServerFn({ method: "GET" })
  .handler(async (): Promise<YoutubeGeographyRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: latest, error: latestError } = await supabaseAdmin
      .from("youtube_geography_daily")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw new Error(latestError.message);
    if (!latest) return [];

    const { data: rows, error } = await supabaseAdmin
      .from("youtube_geography_daily")
      .select("country_code, views, watch_time_minutes")
      .eq("date", latest.date)
      .order("views", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => ({
      country_code: r.country_code,
      views: Number(r.views),
      watch_time_minutes: Number(r.watch_time_minutes),
    }));
  });

/**
 * Lê dados de origens de tráfego.
 * Ver nota em `getYoutubeAudience`: lê apenas o snapshot mais recente de 90 dias.
 */
export const getYoutubeTrafficSources = createServerFn({ method: "GET" })
  .handler(async (): Promise<YoutubeTrafficSourceRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: latest, error: latestError } = await supabaseAdmin
      .from("youtube_traffic_sources_daily")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw new Error(latestError.message);
    if (!latest) return [];

    const { data: rows, error } = await supabaseAdmin
      .from("youtube_traffic_sources_daily")
      .select("traffic_source_type, views")
      .eq("date", latest.date)
      .order("views", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => ({
      traffic_source_type: r.traffic_source_type,
      views: Number(r.views),
    }));
  });

/**
 * Lê ranking de vídeos com métricas.
 *
 * Com um período específico (7/30/90 dias), agrega youtube_video_metrics_daily
 * filtrado por data — reflete corretamente "desempenho nesses dias".
 *
 * Com "Todo período" (days=null), monta a lista a partir de youtube_videos
 * inteiro (todo vídeo já sincronizado), usando views/curtidas/comentários
 * vitalícios (da Data API, independente de qualquer janela de datas). Antes,
 * mesmo "Todo período" ficava preso à tabela de métricas diárias, que só tem
 * linhas pra vídeos com views dentro da janela de ~90 dias da última
 * sincronização — um vídeo antigo sem views recentes simplesmente não
 * aparecia, mesmo estando sincronizado, e o vídeo "mais antigo" mostrado não
 * era o mais antigo de verdade. Tempo de exibição e AVD continuam vindo da
 * tabela diária (a Data API não expõe watch time histórico), então para
 * vídeos antigos esses dois campos podem ficar subestimados — mas o vídeo em
 * si nunca mais desaparece da lista.
 */
export const getYoutubeTopVideos = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number | null }) => ({
    days: data.days === null ? null : Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<YoutubeVideoRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.days === null) {
      const { data: videos, error: videosError } = await supabaseAdmin
        .from("youtube_videos")
        .select("video_id, title, thumbnail_url, published_at, duration_seconds, lifetime_views, lifetime_likes, lifetime_comment_count");
      if (videosError) throw new Error(videosError.message);
      if (!videos || videos.length === 0) return [];

      // Paginated (see fetchAllRows): with full per-video history now synced
      // (not just a 90-day trailing window), this table comfortably exceeds
      // this project's 1000-row PostgREST response cap, which no `.limit()`
      // can raise — a single unbounded/high-limit select silently came back
      // truncated to an arbitrary ~1000 rows covering a handful of videos.
      const dailyMetrics = await fetchAllRows<{ video_id: string; views: number; watch_time_hours?: number; avg_view_duration_seconds?: number }>(
        (rangeFrom, rangeTo) =>
          (supabaseAdmin as any)
            .from("youtube_video_metrics_daily")
            .select("video_id, views, watch_time_hours, avg_view_duration_seconds")
            .order("id", { ascending: true })
            .range(rangeFrom, rangeTo),
      );

      const watchTimeMap = new Map<string, { watch_time: number; avd_weighted_sum: number; views: number }>();
      for (const m of dailyMetrics) {
        const curr = watchTimeMap.get(m.video_id) ?? { watch_time: 0, avd_weighted_sum: 0, views: 0 };
        const dailyViews = Number(m.views);
        curr.watch_time += Number(m.watch_time_hours ?? 0);
        curr.avd_weighted_sum += Number(m.avg_view_duration_seconds ?? 0) * dailyViews;
        curr.views += dailyViews;
        watchTimeMap.set(m.video_id, curr);
      }

      return videos
        .map((v) => {
          const views = Number(v.lifetime_views ?? 0);
          const likes = Number(v.lifetime_likes ?? 0);
          const comments = Number(v.lifetime_comment_count ?? 0);
          const watchStats = watchTimeMap.get(v.video_id);
          return {
            video_id: v.video_id,
            title: v.title ?? "",
            thumbnail_url: v.thumbnail_url ?? "",
            published_at: v.published_at ?? "",
            duration_seconds: v.duration_seconds ?? 0,
            views,
            likes,
            comments,
            watch_time_hours: watchStats?.watch_time ?? 0,
            avg_view_duration_seconds: watchStats && watchStats.views > 0 ? watchStats.avd_weighted_sum / watchStats.views : 0,
            eng_rate: views > 0 ? ((likes + comments) / views) * 100 : 0,
          };
        })
        .sort((a, b) => b.views - a.views);
    }

    const from = new Date();
    from.setDate(from.getDate() - data.days);
    const fromDateStr = from.toISOString().slice(0, 10);
    // Paginated (see fetchAllRows): wider windows (e.g. 90 dias) easily exceed
    // this project's 1000-row PostgREST response cap across the whole catalog,
    // and no `.limit()` value raises that cap — it silently truncated to an
    // arbitrary subset of rows, so the video count went backwards as the
    // period grew instead of only growing.
    const metrics = await fetchAllRows<{ video_id: string; date: string; views: number; likes?: number; comments?: number; watch_time_hours?: number; avg_view_duration_seconds?: number }>(
      (rangeFrom, rangeTo) =>
        (supabaseAdmin as any)
          .from("youtube_video_metrics_daily")
          .select("video_id, date, views, likes, comments, watch_time_hours, avg_view_duration_seconds")
          .gte("date", fromDateStr)
          .order("id", { ascending: true })
          .range(rangeFrom, rangeTo),
    );
    if (metrics.length === 0) return [];

    const map = new Map<string, { views: number; likes: number; comments: number; watch_time: number; avd_weighted_sum: number; count: number }>();
    for (const m of metrics) {
      const curr = map.get(m.video_id) ?? { views: 0, likes: 0, comments: 0, watch_time: 0, avd_weighted_sum: 0, count: 0 };
      const dailyViews = Number(m.views);
      curr.views += dailyViews;
      curr.likes += Number(m.likes);
      curr.comments += Number(m.comments);
      curr.watch_time += Number(m.watch_time_hours);
      curr.avd_weighted_sum += Number(m.avg_view_duration_seconds) * dailyViews;
      curr.count += 1;
      map.set(m.video_id, curr);
    }

    const aggregatedList = Array.from(map.entries())
      .map(([id, val]) => ({
        video_id: id,
        views: val.views,
        likes: val.likes,
        comments: val.comments,
        watch_time_hours: val.watch_time,
        avg_view_duration_seconds: val.views > 0 ? val.avd_weighted_sum / val.views : 0,
      }))
      .sort((a, b) => b.views - a.views);

    const videoIds = aggregatedList.map((m) => m.video_id);
    const { data: videos, error: videosError } = await supabaseAdmin
      .from("youtube_videos")
      .select("video_id, title, thumbnail_url, published_at, duration_seconds")
      .in("video_id", videoIds);

    if (videosError) throw new Error(videosError.message);

    const videoMap = new Map((videos ?? []).map((v) => [v.video_id, v]));

    return aggregatedList.map((m) => {
      const v = videoMap.get(m.video_id);
      return {
        video_id: m.video_id,
        title: v?.title ?? "",
        thumbnail_url: v?.thumbnail_url ?? "",
        published_at: v?.published_at ?? "",
        duration_seconds: v?.duration_seconds ?? 0,
        views: m.views,
        likes: m.likes,
        comments: m.comments,
        watch_time_hours: m.watch_time_hours,
        avg_view_duration_seconds: m.avg_view_duration_seconds,
        eng_rate: m.views > 0 ? ((m.likes + m.comments) / m.views) * 100 : 0,
      };
    });
  });

// "Melhor Horário para Postar" analisa TODOS os vídeos já sincronizados do canal,
// usando o total de views vitalício de cada um (youtube_videos.lifetime_views, vindo
// direto de videos.list statistics.viewCount) — não a tabela de métricas diárias, que
// só guarda uma janela de 90 dias por vídeo. Um vídeo antigo teria a maior parte das
// views fora dessa janela, então somar só os últimos 90 dias subestimaria vídeos mais
// antigos e distorceria a comparação entre eles. lifetime_views resolve isso porque
// não depende de quando o vídeo foi publicado.
export const getYoutubeBestPostingTime = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: videos, error: videosError } = await supabaseAdmin
      .from("youtube_videos")
      .select("video_id, published_at, lifetime_views");
    if (videosError) throw new Error(videosError.message);

    const usable = (videos ?? []).filter((v) => v.published_at);
    if (usable.length === 0) {
      return { bestBlock: null, blocks: [], overallAvgViews: 0, hasEnoughData: false, totalVideosAnalyzed: 0, earliestPublishedAt: null };
    }

    const blocks: Record<string, { views: number; count: number }> = {};
    let totalViews = 0;

    for (const v of usable) {
      const views = Number(v.lifetime_views ?? 0);
      const date = new Date(v.published_at!);
      const brazilTime = new Date(date.getTime() + (date.getTimezoneOffset() * 60000) - (3 * 3600000));
      const day = brazilTime.getDay();
      const hour = brazilTime.getHours();

      let block = "Madrugada (00h-06h)";
      if (hour >= 6 && hour < 12) block = "Manhã (06h-12h)";
      else if (hour >= 12 && hour < 18) block = "Tarde (12h-18h)";
      else if (hour >= 18) block = "Noite (18h-24h)";

      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const key = `${dayNames[day]} - ${block}`;

      if (!blocks[key]) blocks[key] = { views: 0, count: 0 };
      blocks[key].views += views;
      blocks[key].count += 1;

      totalViews += views;
    }

    const validBlocks = Object.entries(blocks)
      .filter(([_, stats]) => stats.count >= 3)
      .map(([key, stats]) => ({
        key,
        avg_views: stats.views / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.avg_views - a.avg_views);

    const overallAvgViews = usable.length > 0 ? totalViews / usable.length : 0;
    const earliestPublishedAt = usable.reduce(
      (min, v) => (v.published_at! < min ? v.published_at! : min),
      usable[0]!.published_at!,
    );

    return {
      bestBlock: validBlocks.length > 0 ? validBlocks[0] : null,
      blocks: validBlocks,
      overallAvgViews,
      hasEnoughData: validBlocks.length > 0,
      // Prova visível de que a análise usa todo o histórico sincronizado, não um
      // recorte — cada bloco individual (dia + faixa de 6h) naturalmente recebe
      // poucos vídeos porque há até 28 combinações possíveis para distribuir o total.
      totalVideosAnalyzed: usable.length,
      earliestPublishedAt,
    };
  });

export type FinancialEntryRow = {
  id: string;
  platform_id: string;
  date: string;
  amount: number;
  currency: string;
  source_type: string;
};

export const getFinancialEntries = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number | null }) => ({
    days: data.days === null ? null : Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<FinancialEntryRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("financial_entries")
      .select("id, platform_id, date, amount, currency, source_type")
      .order("date", { ascending: false });

    if (data.days !== null) {
      const from = new Date();
      from.setDate(from.getDate() - data.days);
      query = query.gte("date", from.toISOString().slice(0, 10));
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => ({
      id: r.id,
      platform_id: r.platform_id,
      date: r.date,
      amount: Number(r.amount),
      currency: r.currency,
      source_type: r.source_type ?? "",
    }));
  });

export type SyncLogRow = {
  platform_id: string;
  status: string;
  message: string;
  run_at: string;
};

export const getLatestSyncLog = createServerFn({ method: "GET" })
  .validator((data: { platform_id: string }) => data)
  .handler(async ({ data }): Promise<SyncLogRow | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("sync_logs")
      .select("platform_id, status, message, run_at")
      .eq("platform_id", data.platform_id)
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return row as SyncLogRow | null;
  });

export type GrowthGoal = {
  platform_id: string;
  metric: string;
  target_value: number;
  period: string;
};

export const getPlatformGoals = createServerFn({ method: "GET" })
  .validator((data: { platform_id: string; period: string }) => data)
  .handler(async ({ data }): Promise<GrowthGoal[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: goals, error } = await supabaseAdmin
      .from("growth_goals")
      .select("platform_id, metric, target_value, period")
      .eq("platform_id", data.platform_id)
      .eq("period", data.period);

    // A tabela de metas ainda pode não existir no banco: nesse caso seguimos sem metas.
    if (error) {
      const msg = error.message ?? "";
      if (error.code === "PGRST205" || msg.includes("growth_goals")) return [];
      throw new Error(msg);
    }
    return (goals ?? []) as GrowthGoal[];
  });

export type YoutubeCommentsResult = {
  comments: YoutubeCommentRow[];
  totalCount: number;
  unansweredCount: number;
  pendingCount: number;
};

/**
 * Lê comentários já sincronizados (com respostas), mais recentes primeiro.
 * Retorna também totalCount/unansweredCount/pendingCount (contagens reais, sem
 * o corte de .limit(200) da listagem) para deixar visível quando os filtros
 * batem por coincidência dos dados — por exemplo, se o canal nunca respondeu
 * nada com texto ainda (só com "coração", que a API não expõe), "Não
 * respondidos" e "Todos" são legitimamente o mesmo conjunto.
 *
 * filter "pending" mostra a fila de moderação (moderation_status IN
 * heldForReview, likelySpam) — comentários que a própria API do YouTube ainda
 * não tornou públicos (retidos para revisão explícita ou escondidos
 * automaticamente pelo detector de spam), separados dos demais porque não
 * fazem parte do fluxo normal de resposta.
 */
export const getYoutubeComments = createServerFn({ method: "GET" })
  .inputValidator((data: { filter: "all" | "unanswered" | "pending" }) => data)
  .handler(async ({ data }): Promise<YoutubeCommentsResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ count: totalCount }, { count: unansweredCount }, { count: pendingCount }] = await Promise.all([
      supabaseAdmin.from("youtube_comments").select("*", { count: "exact", head: true }).eq("moderation_status", "published"),
      supabaseAdmin
        .from("youtube_comments")
        .select("*", { count: "exact", head: true })
        .eq("moderation_status", "published")
        .eq("has_owner_reply", false),
      supabaseAdmin.from("youtube_comments").select("*", { count: "exact", head: true }).in("moderation_status", ["heldForReview", "likelySpam"]),
    ]);

    let query = supabaseAdmin
      .from("youtube_comments")
      .select(
        "comment_id, video_id, author_display_name, author_profile_image_url, text_display, like_count, total_reply_count, has_owner_reply, can_reply, moderation_status, published_at",
      )
      .order("published_at", { ascending: false })
      .limit(200);

    if (data.filter === "pending") {
      query = query.in("moderation_status", ["heldForReview", "likelySpam"]);
    } else {
      query = query.eq("moderation_status", "published");
      if (data.filter === "unanswered") {
        query = query.eq("has_owner_reply", false);
      }
    }

    const { data: comments, error } = await query;
    if (error) throw new Error(error.message);
    if (!comments || comments.length === 0) {
      return {
        comments: [],
        totalCount: totalCount ?? 0,
        unansweredCount: unansweredCount ?? 0,
        pendingCount: pendingCount ?? 0,
      };
    }

    const commentIds = comments.map((c) => c.comment_id);
    const videoIds = [...new Set(comments.map((c) => c.video_id))];

    const [{ data: videos }, { data: replies }] = await Promise.all([
      supabaseAdmin.from("youtube_videos").select("video_id, title, thumbnail_url").in("video_id", videoIds),
      supabaseAdmin
        .from("youtube_comment_replies")
        .select("reply_id, parent_comment_id, author_display_name, text_display, is_owner, published_at")
        .in("parent_comment_id", commentIds)
        .order("published_at", { ascending: true }),
    ]);

    const videoMap = new Map((videos ?? []).map((v) => [v.video_id, v]));
    const repliesByComment = new Map<string, YoutubeCommentReplyRow[]>();
    for (const r of replies ?? []) {
      const list = repliesByComment.get(r.parent_comment_id) ?? [];
      list.push({
        reply_id: r.reply_id,
        author_display_name: r.author_display_name ?? "",
        text_display: r.text_display ?? "",
        is_owner: r.is_owner,
        published_at: r.published_at ?? "",
      });
      repliesByComment.set(r.parent_comment_id, list);
    }

    const mapped = comments.map((c) => {
      const video = videoMap.get(c.video_id);
      return {
        comment_id: c.comment_id,
        video_id: c.video_id,
        video_title: video?.title ?? "(vídeo fora do cache local)",
        video_thumbnail_url: video?.thumbnail_url ?? "",
        author_display_name: c.author_display_name ?? "",
        author_profile_image_url: c.author_profile_image_url ?? "",
        text_display: c.text_display ?? "",
        like_count: Number(c.like_count),
        total_reply_count: Number(c.total_reply_count),
        has_owner_reply: c.has_owner_reply,
        can_reply: c.can_reply,
        moderation_status: c.moderation_status as YoutubeModerationStatus,
        published_at: c.published_at ?? "",
        replies: repliesByComment.get(c.comment_id) ?? [],
      };
    });

    return {
      comments: mapped,
      totalCount: totalCount ?? 0,
      unansweredCount: unansweredCount ?? 0,
      pendingCount: pendingCount ?? 0,
    };
  });

/**
 * Supabase/PostgREST projects cap every REST response at a fixed row count
 * (this project's is 1000) regardless of what `.limit()` the client asks
 * for — confirmed by calling the real query through a service-role client
 * and seeing exactly 1000 rows come back covering only 13 of 131 videos,
 * even with `.limit(50000)` requested. A single `.limit()` can never be
 * "big enough"; the only correct fix is to page through with `.range()`
 * until a page comes back short. `.order("id")` just keeps each page
 * disjoint and total — the id itself carries no business meaning here.
 */
async function fetchAllRows<T>(
  buildPage: (rangeFrom: number, rangeTo: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildPage(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return results;
}

export type ModerateCommentInput = {
  comment_id: string;
  moderation_status: YoutubeModerationStatus;
};

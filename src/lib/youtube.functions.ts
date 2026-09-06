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
      .select("date, followers, views, likes, engagement_rate, watch_time_hours, avd_seconds, subs_gained, subs_lost, estimated_revenue, comments, shares, synced_at")
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

/** Lê dados de audiência demográfica (idade × gênero). */
export const getYoutubeAudience = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number | null }) => ({
    days: data.days === null ? null : Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<YoutubeAudienceRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("youtube_audience_daily")
      .select("date, age_group, gender, viewer_percentage");

    if (data.days !== null) {
      const from = new Date();
      from.setDate(from.getDate() - data.days);
      query = query.gte("date", from.toISOString().slice(0, 10));
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const map = new Map<string, { sum: number; count: number }>();
    for (const r of (rows ?? [])) {
      const key = `${r.age_group}_${r.gender}`;
      const curr = map.get(key) ?? { sum: 0, count: 0 };
      curr.sum += Number(r.viewer_percentage);
      curr.count += 1;
      map.set(key, curr);
    }

    const aggregated: YoutubeAudienceRow[] = [];
    for (const [key, val] of map.entries()) {
      const [age_group, gender] = key.split("_");
      aggregated.push({
        age_group: age_group!,
        gender: gender!,
        viewer_percentage: Number((val.sum / val.count).toFixed(3)),
      });
    }

    return aggregated;
  });

/** Lê dados geográficos (top países por views). */
export const getYoutubeGeography = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number | null }) => ({
    days: data.days === null ? null : Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<YoutubeGeographyRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("youtube_geography_daily")
      .select("date, country_code, views, watch_time_minutes");

    if (data.days !== null) {
      const from = new Date();
      from.setDate(from.getDate() - data.days);
      query = query.gte("date", from.toISOString().slice(0, 10));
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const map = new Map<string, { views: number; watch_time: number }>();
    for (const r of (rows ?? [])) {
      const curr = map.get(r.country_code) ?? { views: 0, watch_time: 0 };
      curr.views += Number(r.views);
      curr.watch_time += Number(r.watch_time_minutes);
      map.set(r.country_code, curr);
    }

    const aggregated: YoutubeGeographyRow[] = [];
    for (const [code, val] of map.entries()) {
      aggregated.push({
        country_code: code,
        views: val.views,
        watch_time_minutes: val.watch_time,
      });
    }

    return aggregated.sort((a, b) => b.views - a.views).slice(0, 10);
  });

/** Lê dados de origens de tráfego. */
export const getYoutubeTrafficSources = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number | null }) => ({
    days: data.days === null ? null : Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<YoutubeTrafficSourceRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("youtube_traffic_sources_daily")
      .select("date, traffic_source_type, views");

    if (data.days !== null) {
      const from = new Date();
      from.setDate(from.getDate() - data.days);
      query = query.gte("date", from.toISOString().slice(0, 10));
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const map = new Map<string, number>();
    for (const r of (rows ?? [])) {
      map.set(r.traffic_source_type, (map.get(r.traffic_source_type) ?? 0) + Number(r.views));
    }

    const aggregated: YoutubeTrafficSourceRow[] = [];
    for (const [type, views] of map.entries()) {
      aggregated.push({ traffic_source_type: type, views });
    }

    return aggregated.sort((a, b) => b.views - a.views).slice(0, 20);
  });

/** Lê ranking de vídeos com métricas (join youtube_videos + youtube_video_metrics_daily). */
export const getYoutubeTopVideos = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number | null }) => ({
    days: data.days === null ? null : Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<YoutubeVideoRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    let metricsQuery = (supabaseAdmin as any)
      .from("youtube_video_metrics_daily")
      .select("video_id, date, views, likes, comments, watch_time_hours, avg_view_duration_seconds") as any;

    if (data.days !== null) {
      const from = new Date();
      from.setDate(from.getDate() - data.days);
      metricsQuery = metricsQuery.gte("date", from.toISOString().slice(0, 10));
    }

    const { data: metrics, error: metricsError } = (await metricsQuery) as {
      data: Array<Record<string, any>> | null;
      error: { message: string } | null;
    };
    if (metricsError) throw new Error(metricsError.message);
    if (!metrics || metrics.length === 0) return [];

    const map = new Map<string, { views: number; likes: number; comments: number; watch_time: number; avd_sum: number; count: number }>();
    for (const m of metrics) {
      const curr = map.get(m.video_id) ?? { views: 0, likes: 0, comments: 0, watch_time: 0, avd_sum: 0, count: 0 };
      curr.views += Number(m.views);
      curr.likes += Number(m.likes);
      curr.comments += Number(m.comments);
      curr.watch_time += Number(m.watch_time_hours);
      curr.avd_sum += Number(m.avg_view_duration_seconds);
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
        avg_view_duration_seconds: val.count > 0 ? val.avd_sum / val.count : 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 50);

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
      };
    });
  });

export const getYoutubeBestPostingTime = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number | null }) => ({
    days: data.days === null ? null : Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }) => {
    // Calling the function directly inside server scope requires re-importing dependencies if they were strictly encapsulated,
    // but we can just do the work. We'll reuse the logic we just defined.
    // Instead of calling getYoutubeTopVideos which is wrapped by createServerFn, we'll fetch from db directly here
    // or just fetch all videos and metrics.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let metricsQuery = (supabaseAdmin as any)
      .from("youtube_video_metrics_daily")
      .select("video_id, date, views, avg_view_duration_seconds") as any;
      
    if (data.days !== null) {
      const from = new Date();
      from.setDate(from.getDate() - data.days);
      metricsQuery = metricsQuery.gte("date", from.toISOString().slice(0, 10));
    }
    
    const { data: metrics, error: metricsError } = (await metricsQuery) as {
      data: Array<{ video_id: string; date: string; views: number; avg_view_duration_seconds: number }> | null;
      error: { message: string } | null;
    };
    if (metricsError) throw new Error(metricsError.message);
    
    if (!metrics || metrics.length === 0) return { bestBlock: null, blocks: [], overallAvgViews: 0, hasEnoughData: false };
    
    const map = new Map<string, { views: number; avd_sum: number; count: number }>();
    for (const m of metrics) {
      const curr = map.get(m.video_id) ?? { views: 0, avd_sum: 0, count: 0 };
      curr.views += Number(m.views);
      curr.avd_sum += Number(m.avg_view_duration_seconds);
      curr.count += 1;
      map.set(m.video_id, curr);
    }
    
    const videoIds = Array.from(map.keys());
    const { data: videos, error: videosError } = await supabaseAdmin
      .from("youtube_videos")
      .select("video_id, published_at")
      .in("video_id", videoIds);
      
    if (videosError) throw new Error(videosError.message);
    const videoMap = new Map((videos ?? []).map((v) => [v.video_id, v.published_at]));

    const blocks: Record<string, { views: number; avd: number; count: number }> = {};
    let totalViews = 0;
    
    for (const [vid, stats] of map.entries()) {
      const published_at = videoMap.get(vid);
      if (!published_at) continue;
      
      const date = new Date(published_at);
      const brazilTime = new Date(date.getTime() + (date.getTimezoneOffset() * 60000) - (3 * 3600000));
      const day = brazilTime.getDay();
      const hour = brazilTime.getHours();
      
      let block = "Madrugada (00h-06h)";
      if (hour >= 6 && hour < 12) block = "Manhã (06h-12h)";
      else if (hour >= 12 && hour < 18) block = "Tarde (12h-18h)";
      else if (hour >= 18) block = "Noite (18h-24h)";
      
      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const key = `${dayNames[day]} - ${block}`;
      
      if (!blocks[key]) blocks[key] = { views: 0, avd: 0, count: 0 };
      blocks[key].views += stats.views;
      blocks[key].avd += stats.count > 0 ? stats.avd_sum / stats.count : 0;
      blocks[key].count += 1;
      
      totalViews += stats.views;
    }
    
    const validBlocks = Object.entries(blocks)
      .filter(([_, stats]) => stats.count >= 3)
      .map(([key, stats]) => ({
        key,
        avg_views: stats.views / stats.count,
        avg_avd: stats.avd / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.avg_views - a.avg_views);
      
    const overallAvgViews = videoIds.length > 0 ? totalViews / videoIds.length : 0;
    
    return {
      bestBlock: validBlocks.length > 0 ? validBlocks[0] : null,
      blocks: validBlocks,
      overallAvgViews,
      hasEnoughData: validBlocks.length > 0
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

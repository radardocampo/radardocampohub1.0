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
  .inputValidator((data: { days: number }) => ({
    days: Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<YoutubeDailyRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = new Date();
    from.setDate(from.getDate() - data.days);
    const { data: rows, error } = await supabaseAdmin
      .from("metrics_daily")
      .select("date, followers, views, likes, engagement_rate, watch_time_hours, avd_seconds, subs_gained, subs_lost, estimated_revenue, comments, shares")
      .eq("platform_id", "youtube")
      .gte("date", from.toISOString().slice(0, 10))
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
    }));
  });

/** Busca métricas do período anterior para cálculo de variação percentual. */
export const getYoutubeMetricsPrevious = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number }) => ({
    days: Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<YoutubeDailyRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = new Date();
    const to = new Date();
    from.setDate(from.getDate() - data.days * 2);
    to.setDate(to.getDate() - data.days);
    const { data: rows, error } = await supabaseAdmin
      .from("metrics_daily")
      .select("date, followers, views, likes, engagement_rate, watch_time_hours, avd_seconds, subs_gained, subs_lost, estimated_revenue, comments, shares")
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
  .handler(async (): Promise<YoutubeAudienceRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("youtube_audience_daily")
      .select("age_group, gender, viewer_percentage")
      .order("synced_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      age_group: r.age_group,
      gender: r.gender,
      viewer_percentage: Number(r.viewer_percentage),
    }));
  });

/** Lê dados geográficos (top países por views). */
export const getYoutubeGeography = createServerFn({ method: "GET" })
  .handler(async (): Promise<YoutubeGeographyRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("youtube_geography_daily")
      .select("country_code, views, watch_time_minutes")
      .order("views", { ascending: false })
      .limit(10);

    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      country_code: r.country_code,
      views: Number(r.views),
      watch_time_minutes: Number(r.watch_time_minutes),
    }));
  });

/** Lê dados de origens de tráfego. */
export const getYoutubeTrafficSources = createServerFn({ method: "GET" })
  .handler(async (): Promise<YoutubeTrafficSourceRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("youtube_traffic_sources_daily")
      .select("traffic_source_type, views")
      .order("views", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      traffic_source_type: r.traffic_source_type,
      views: Number(r.views),
    }));
  });

/** Lê ranking de vídeos com métricas (join youtube_videos + youtube_video_metrics_period). */
export const getYoutubeTopVideos = createServerFn({ method: "GET" })
  .handler(async (): Promise<YoutubeVideoRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Get video metrics ordered by views
    const { data: metrics, error: metricsError } = await supabaseAdmin
      .from("youtube_video_metrics_period")
      .select("video_id, views, likes, comments, watch_time_hours, avg_view_duration_seconds")
      .order("views", { ascending: false })
      .limit(50);

    if (metricsError) throw new Error(metricsError.message);
    if (!metrics || metrics.length === 0) return [];

    // Get video metadata for all matched videos
    const videoIds = metrics.map((m) => m.video_id);
    const { data: videos, error: videosError } = await supabaseAdmin
      .from("youtube_videos")
      .select("video_id, title, thumbnail_url, published_at, duration_seconds")
      .in("video_id", videoIds);

    if (videosError) throw new Error(videosError.message);

    const videoMap = new Map((videos ?? []).map((v) => [v.video_id, v]));

    return metrics.map((m) => {
      const v = videoMap.get(m.video_id);
      return {
        video_id: m.video_id,
        title: v?.title ?? "",
        thumbnail_url: v?.thumbnail_url ?? "",
        published_at: v?.published_at ?? "",
        duration_seconds: v?.duration_seconds ?? 0,
        views: Number(m.views),
        likes: Number(m.likes),
        comments: Number(m.comments),
        watch_time_hours: Number(m.watch_time_hours),
        avg_view_duration_seconds: Number(m.avg_view_duration_seconds),
      };
    });
  });

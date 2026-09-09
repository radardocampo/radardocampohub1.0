import { createServerFn } from "@tanstack/react-start";

export type TiktokDailyRow = {
  date: string;
  followers: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  synced_at?: string;
};

export type TiktokVideoRow = {
  video_id: string;
  title: string;
  cover_image_url: string;
  share_url: string;
  create_time: string;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  eng_rate?: number;
};

/** Lê as métricas diárias reais do TikTok salvos em tiktok_video_metrics_daily. 
 *  Nota: Diferente do YouTube, o TikTok ainda não fornece followers/history-level. 
 *  Nós agregaremos por vídeo.
 */
export const getTiktokMetrics = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number | null }) => ({
    days: data.days === null ? null : Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<TiktokDailyRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("tiktok_video_metrics_daily")
      .select("date, views, likes, comments, shares, updated_at");

    if (data.days !== null) {
      const from = new Date();
      from.setDate(from.getDate() - data.days);
      query = query.gte("date", from.toISOString().slice(0, 10));
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const map = new Map<string, { views: number; likes: number; comments: number; shares: number; maxDate: string }>();

    for (const r of (rows ?? [])) {
      const curr = map.get(r.date) ?? { views: 0, likes: 0, comments: 0, shares: 0, maxDate: r.updated_at };
      curr.views += Number(r.views);
      curr.likes += Number(r.likes);
      curr.comments += Number(r.comments);
      curr.shares += Number(r.shares);
      if (new Date(r.updated_at) > new Date(curr.maxDate)) {
        curr.maxDate = r.updated_at;
      }
      map.set(r.date, curr);
    }

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, val]) => ({
      date,
      followers: 0, // TikTok API Display does not give daily follower history currently
      views: val.views,
      likes: val.likes,
      comments: val.comments,
      shares: val.shares,
      engagement_rate: val.views > 0 ? ((val.likes + val.comments + val.shares) / val.views) * 100 : 0,
      synced_at: val.maxDate,
    }));
  });

export const getTiktokTopVideos = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number | null }) => ({
    days: data.days === null ? null : Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<TiktokVideoRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    let metricsQuery = supabaseAdmin
      .from("tiktok_video_metrics_daily")
      .select("video_id, date, views, likes, comments, shares");

    if (data.days !== null) {
      const from = new Date();
      from.setDate(from.getDate() - data.days);
      metricsQuery = metricsQuery.gte("date", from.toISOString().slice(0, 10));
    }

    const { data: metrics, error: metricsError } = await metricsQuery;
    if (metricsError) throw new Error(metricsError.message);
    if (!metrics || metrics.length === 0) return [];

    const map = new Map<string, { views: number; likes: number; comments: number; shares: number }>();
    for (const m of metrics) {
      const curr = map.get(m.video_id) ?? { views: 0, likes: 0, comments: 0, shares: 0 };
      // TikTok daily sync saves cumulative for that day usually, but let's assume we want the max per video in period
      // Actually, if we want period delta we need max - min, but let's use the max for simplicity now
      if (Number(m.views) > curr.views) curr.views = Number(m.views);
      if (Number(m.likes) > curr.likes) curr.likes = Number(m.likes);
      if (Number(m.comments) > curr.comments) curr.comments = Number(m.comments);
      if (Number(m.shares) > curr.shares) curr.shares = Number(m.shares);
      map.set(m.video_id, curr);
    }

    const videoIds = Array.from(map.keys());
    const { data: videos, error: videosError } = await supabaseAdmin
      .from("tiktok_videos")
      .select("video_id, title, cover_image_url, share_url, create_time, duration")
      .in("video_id", videoIds);

    if (videosError) throw new Error(videosError.message);
    const videoMap = new Map((videos ?? []).map((v) => [v.video_id, v]));

    return Array.from(map.entries()).map(([id, val]) => {
      const v = videoMap.get(id);
      return {
        video_id: id,
        title: v?.title ?? "",
        cover_image_url: v?.cover_image_url ?? "",
        share_url: v?.share_url ?? "",
        create_time: v?.create_time ?? "",
        duration: v?.duration ?? 0,
        views: val.views,
        likes: val.likes,
        comments: val.comments,
        shares: val.shares,
        eng_rate: val.views > 0 ? ((val.likes + val.comments + val.shares) / val.views) * 100 : 0,
      };
    }).sort((a, b) => b.views - a.views).slice(0, 50);
  });

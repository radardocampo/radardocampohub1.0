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
  estimated_revenue?: number;
  comments?: number;
  shares?: number;
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
      estimated_revenue: r.estimated_revenue ? Number(r.estimated_revenue) : 0,
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

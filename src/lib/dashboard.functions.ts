import { createServerFn } from "@tanstack/react-start";

export type MetricPoint = {
  date: string;
  label: string;
  followers: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
};

export type PlatformSnapshot = {
  id: string;
  followers: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  series: MetricPoint[];
};

export type Earning = {
  id: string;
  platform_id: string;
  date: string;
  amount: number;
};

type DashboardData = {
  snapshots: PlatformSnapshot[];
  earnings: Earning[];
};

export const getDashboardData = createServerFn({ method: "GET" })
  .validator((data: { rangeDays: number }) => data)
  .handler(async ({ data: { rangeDays } }): Promise<DashboardData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - rangeDays + 1);

    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    // Generate dates array for the series
    const dates: string[] = [];
    const d = new Date(startDate);
    while (d <= endDate) {
      dates.push(d.toISOString().split("T")[0]);
      d.setDate(d.getDate() + 1);
    }

    const snapshots: PlatformSnapshot[] = [];
    const earnings: Earning[] = [];

    // --- YOUTUBE & TIKTOK DATA ---
    const { data: metricsData } = await supabaseAdmin
      .from("metrics_daily")
      .select("*")
      .in("platform_id", ["youtube", "tiktok"])
      .gte("date", startStr)
      .lte("date", endStr);

    const metricsByPlatform: Record<string, Record<string, any>> = {
      youtube: {},
      tiktok: {},
    };

    if (metricsData) {
      metricsData.forEach((row) => {
        metricsByPlatform[row.platform_id][row.date] = row;
      });
    }

    // --- PLATFORM CREDENTIALS (for tiktok followers) ---
    const { data: tiktokCreds } = await supabaseAdmin
      .from("platform_credentials")
      .select("follower_count")
      .eq("platform_id", "tiktok")
      .single();

    const tiktokFollowers = tiktokCreds?.follower_count || 0;

    for (const platform of ["youtube", "tiktok"]) {
      const series: MetricPoint[] = dates.map((date) => {
        const row = metricsByPlatform[platform][date];
        const parsedDate = new Date(`${date}T00:00:00`);
        const views = row?.views || 0;
        const likes = row?.likes || 0;
        const comments = row?.comments || 0;
        const shares = row?.shares || 0;
        const followers = platform === "youtube" ? (row?.followers || 0) : tiktokFollowers;
        
        const engagement_rate = views > 0 ? Number((((likes + comments + shares) / views) * 100).toFixed(2)) : 0;
        
        if (platform === "youtube" && row?.estimated_revenue) {
          earnings.push({
            id: `yt-${date}`,
            platform_id: "youtube",
            date,
            amount: row.estimated_revenue,
          });
        }

        return {
          date,
          label: parsedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          followers,
          views,
          likes,
          comments,
          shares,
          engagement_rate,
        };
      });

      const totalFollowers = series[series.length - 1]?.followers || 0;
      const totalViews = series.reduce((acc, p) => acc + p.views, 0);
      const totalLikes = series.reduce((acc, p) => acc + p.likes, 0);
      const totalComments = series.reduce((acc, p) => acc + p.comments, 0);
      const totalShares = series.reduce((acc, p) => acc + p.shares, 0);
      const avgEng = totalViews > 0 ? Number((((totalLikes + totalComments + totalShares) / totalViews) * 100).toFixed(2)) : 0;

      snapshots.push({
        id: platform,
        followers: totalFollowers,
        views: totalViews,
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
        engagement_rate: avgEng,
        series,
      });
    }

    return {
      snapshots,
      earnings: earnings.sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

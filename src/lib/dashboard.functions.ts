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

    // --- YOUTUBE DATA ---
    const { data: ytMetrics } = await supabaseAdmin
      .from("metrics_daily")
      .select("*")
      .eq("platform_id", "youtube")
      .gte("date", startStr)
      .lte("date", endStr);

    const ytByDate: Record<string, any> = {};
    if (ytMetrics) {
      ytMetrics.forEach((row) => {
        ytByDate[row.date] = row;
      });
    }

    const ytSeries: MetricPoint[] = dates.map((date) => {
      const row = ytByDate[date];
      const parsedDate = new Date(`${date}T00:00:00`);
      const views = row?.views || 0;
      const likes = row?.likes || 0;
      const comments = row?.comments || 0;
      const shares = row?.shares || 0;
      const followers = row?.followers || 0;
      
      const engagement_rate = views > 0 ? Number((((likes + comments + shares) / views) * 100).toFixed(2)) : 0;
      
      if (row?.estimated_revenue) {
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

    const ytTotalFollowers = ytSeries[ytSeries.length - 1]?.followers || 0;
    const ytTotalViews = ytSeries.reduce((acc, p) => acc + p.views, 0);
    const ytTotalLikes = ytSeries.reduce((acc, p) => acc + p.likes, 0);
    const ytTotalComments = ytSeries.reduce((acc, p) => acc + p.comments, 0);
    const ytTotalShares = ytSeries.reduce((acc, p) => acc + p.shares, 0);
    const ytAvgEng = ytTotalViews > 0 ? Number((((ytTotalLikes + ytTotalComments + ytTotalShares) / ytTotalViews) * 100).toFixed(2)) : 0;

    snapshots.push({
      id: "youtube",
      followers: ytTotalFollowers,
      views: ytTotalViews,
      likes: ytTotalLikes,
      comments: ytTotalComments,
      shares: ytTotalShares,
      engagement_rate: ytAvgEng,
      series: ytSeries,
    });

    // --- TIKTOK DATA ---
    const { data: tiktokCreds } = await supabaseAdmin
      .from("platform_credentials")
      .select("follower_count")
      .eq("platform_id", "tiktok")
      .single();

    const tiktokFollowers = tiktokCreds?.follower_count || 0;

    const { data: tkVideo } = await supabaseAdmin
      .from("tiktok_video_metrics_daily")
      .select("*")
      .gte("date", startStr)
      .lte("date", endStr);

    const tkByDate: Record<string, any> = {};
    if (tkVideo) {
      tkVideo.forEach((row) => {
        if (!tkByDate[row.date]) {
          tkByDate[row.date] = { views: 0, likes: 0, comments: 0, shares: 0 };
        }
        tkByDate[row.date].views += row.views || 0;
        tkByDate[row.date].likes += row.likes || 0;
        tkByDate[row.date].comments += row.comments || 0;
        tkByDate[row.date].shares += row.shares || 0;
      });
    }

    const tkSeries: MetricPoint[] = dates.map((date) => {
      const vid = tkByDate[date];
      const parsedDate = new Date(`${date}T00:00:00`);
      const views = vid?.views || 0;
      const likes = vid?.likes || 0;
      const comments = vid?.comments || 0;
      const shares = vid?.shares || 0;
      const engagement_rate = views > 0 ? Number((((likes + comments + shares) / views) * 100).toFixed(2)) : 0;

      return {
        date,
        label: parsedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        followers: tiktokFollowers,
        views,
        likes,
        comments,
        shares,
        engagement_rate,
      };
    });

    const tkTotalViews = tkSeries.reduce((acc, p) => acc + p.views, 0);
    const tkTotalLikes = tkSeries.reduce((acc, p) => acc + p.likes, 0);
    const tkTotalComments = tkSeries.reduce((acc, p) => acc + p.comments, 0);
    const tkTotalShares = tkSeries.reduce((acc, p) => acc + p.shares, 0);
    const tkAvgEng = tkTotalViews > 0 ? Number((((tkTotalLikes + tkTotalComments + tkTotalShares) / tkTotalViews) * 100).toFixed(2)) : 0;

    snapshots.push({
      id: "tiktok",
      followers: tiktokFollowers,
      views: tkTotalViews,
      likes: tkTotalLikes,
      comments: tkTotalComments,
      shares: tkTotalShares,
      engagement_rate: tkAvgEng,
      series: tkSeries,
    });

    return {
      snapshots,
      earnings: earnings.sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

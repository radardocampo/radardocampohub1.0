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
    const { data: ytAudience } = await supabaseAdmin
      .from("youtube_audience_metrics_daily")
      .select("*")
      .gte("date", startStr)
      .lte("date", endStr);

    const { data: ytVideo } = await supabaseAdmin
      .from("youtube_video_metrics_daily")
      .select("*")
      .gte("date", startStr)
      .lte("date", endStr);

    if (ytAudience || ytVideo) {
      const audienceByDate = (ytAudience ?? []).reduce((acc: any, row: any) => {
        acc[row.date] = row;
        return acc;
      }, {});

      const videoByDate = (ytVideo ?? []).reduce((acc: any, row: any) => {
        acc[row.date] = row;
        return acc;
      }, {});

      const series: MetricPoint[] = dates.map((date) => {
        const aud = audienceByDate[date];
        const vid = videoByDate[date];
        const parsedDate = new Date(`${date}T00:00:00`);
        const views = vid?.views || 0;
        const likes = vid?.likes || 0;
        const comments = vid?.comments || 0;
        const shares = vid?.shares || 0;
        const engagement_rate = views > 0 ? Number((((likes + comments + shares) / views) * 100).toFixed(2)) : 0;
        
        if (vid?.estimated_revenue) {
          earnings.push({
            id: `yt-${date}`,
            platform_id: "youtube",
            date,
            amount: vid.estimated_revenue,
          });
        }

        return {
          date,
          label: parsedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          followers: aud?.followers || 0,
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
        id: "youtube",
        followers: totalFollowers,
        views: totalViews,
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
        engagement_rate: avgEng,
        series,
      });
    }

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

    if (tkVideo && tkVideo.length > 0) {
      // Group by date because tiktok table has one row per video per day
      const tkByDate = tkVideo.reduce((acc: any, row: any) => {
        if (!acc[row.date]) {
          acc[row.date] = { views: 0, likes: 0, comments: 0, shares: 0 };
        }
        acc[row.date].views += row.views || 0;
        acc[row.date].likes += row.likes || 0;
        acc[row.date].comments += row.comments || 0;
        acc[row.date].shares += row.shares || 0;
        return acc;
      }, {});

      const series: MetricPoint[] = dates.map((date) => {
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
          followers: tiktokFollowers, // Static for now as we don't track historical tiktok followers
          views,
          likes,
          comments,
          shares,
          engagement_rate,
        };
      });

      const totalViews = series.reduce((acc, p) => acc + p.views, 0);
      const totalLikes = series.reduce((acc, p) => acc + p.likes, 0);
      const totalComments = series.reduce((acc, p) => acc + p.comments, 0);
      const totalShares = series.reduce((acc, p) => acc + p.shares, 0);
      const avgEng = totalViews > 0 ? Number((((totalLikes + totalComments + totalShares) / totalViews) * 100).toFixed(2)) : 0;

      snapshots.push({
        id: "tiktok",
        followers: tiktokFollowers,
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

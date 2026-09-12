import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Authentication
    const clientId = Deno.env.get("YOUTUBE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("YOUTUBE_OAUTH_CLIENT_SECRET");
    const refreshToken = Deno.env.get("YOUTUBE_OAUTH_REFRESH_TOKEN");
    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    const channelId = Deno.env.get("YOUTUBE_CHANNEL_ID");

    if (!clientId || !clientSecret || !refreshToken || !apiKey || !channelId) {
      throw new Error("Missing YouTube API credentials in environment variables");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      await supabase.from("sync_logs").insert({
        platform_id: "youtube",
        status: "error",
        message: `Refresh token failed: ${JSON.stringify(tokenData)}`,
        run_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ error: "Falha na autenticação do YouTube" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const accessToken = tokenData.access_token;

    // 2. Discover current subscribers
    const channelResponse = await fetch(
      `https://youtube.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`
    );
    const channelData = await channelResponse.json();

    if (!channelResponse.ok || !channelData.items || channelData.items.length === 0) {
      throw new Error("Channel not found or API error: " + JSON.stringify(channelData));
    }

    const currentSubscribers = Number(channelData.items[0].statistics.subscriberCount || 0);
    const currentTotalViews = Number(channelData.items[0].statistics.viewCount || 0);

    // Snapshot the channel's lifetime view count (Data API, near-real-time, no
    // Analytics processing lag) every run. Two snapshots straddling a gap in
    // Analytics data let us estimate "views today" below instead of showing 0.
    await supabase.from("youtube_channel_view_snapshots").insert({
      captured_at: new Date().toISOString(),
      total_views: currentTotalViews,
    });

    // 3. YouTube Analytics API for the last 14 days
    const dailyData: Record<string, any> = {};
    const today = new Date();
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(today.getDate() - 14);

    const startDateStr = fourteenDaysAgo.toISOString().split("T")[0];
    const endDateStr = today.toISOString().split("T")[0];

    // --- Attempt with estimatedRevenue (requires yt-analytics-monetary.readonly scope) ---
    // NOTE: Impressions and thumbnail CTR are NOT available in the YouTube Analytics API.
    //       Those metrics only exist in YouTube Studio and are not exposed via any public API.
    const baseMetrics = "views,likes,comments,shares,subscribersGained,subscribersLost,estimatedMinutesWatched,averageViewDuration";
    let metricsToRequest = baseMetrics + ",estimatedRevenue";
    let revenueAvailable = true;

    const buildAnalyticsUrl = (metrics: string) => {
      const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
      url.searchParams.append("ids", "channel==MINE");
      url.searchParams.append("startDate", startDateStr);
      url.searchParams.append("endDate", endDateStr);
      url.searchParams.append("metrics", metrics);
      url.searchParams.append("dimensions", "day");
      return url;
    };

    let analyticsUrl = buildAnalyticsUrl(metricsToRequest);

    let analyticsResponse = await fetch(analyticsUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    let analyticsResult = await analyticsResponse.json();

    // If revenue request failed (403 = not monetized / missing scope), retry without it
    if (!analyticsResponse.ok) {
      if (analyticsResponse.status === 403 || analyticsResponse.status === 400) {
        console.warn("Revenue metrics unavailable, retrying without estimatedRevenue");
        revenueAvailable = false;
        metricsToRequest = baseMetrics;
        analyticsUrl = buildAnalyticsUrl(metricsToRequest);
        analyticsResponse = await fetch(analyticsUrl.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });
        analyticsResult = await analyticsResponse.json();
        if (!analyticsResponse.ok) {
          throw new Error(`Analytics API error: ${JSON.stringify(analyticsResult)}`);
        }
        await supabase.from("sync_logs").insert({
          platform_id: "youtube",
          status: "warning",
          message: "estimatedRevenue not available (channel not monetized or missing scope). Synced other metrics normally.",
          run_at: new Date().toISOString(),
        });
      } else {
        throw new Error(`Analytics API error: ${JSON.stringify(analyticsResult)}`);
      }
    }

    if (analyticsResult.rows) {
      for (const row of analyticsResult.rows) {
        // row: [day, views, likes, comments, shares, subscribersGained, subscribersLost, estimatedMinutesWatched, averageViewDuration, (estimatedRevenue if available)]
        const day = row[0];
        dailyData[day] = {
          views: row[1] || 0,
          likes: row[2] || 0,
          comments: row[3] || 0,
          shares: row[4] || 0,
          subscribersGained: row[5] || 0,
          subscribersLost: row[6] || 0,
          estimatedMinutesWatched: row[7] || 0,
          averageViewDuration: row[8] || 0,
          estimatedRevenue: revenueAvailable ? (row[9] ?? null) : null,
          raw: row,
        };
      }
    }

    // 4. Reconstruct backward (only for the last 14 days)
    const allDates: string[] = [];
    let currentDate = new Date();
    const endDate = new Date(startDateStr);
    
    while (currentDate >= endDate) {
      allDates.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() - 1);
    }

    const metricsToUpsert = [];
    let runningSubscribers = currentSubscribers;

    // YouTube Analytics has a well-known ~24-72h processing lag: the most recent
    // 1-3 days in `allDates` (ordered today-first, going backward) often simply
    // have no row in `dailyData` yet. This used to be "filled" by copying the
    // last day that DID have data (views, watch time, everything) into every
    // unprocessed day after it — so the chart showed identical numbers, looking
    // like a real (flat) trend instead of "not synced yet".
    //
    // For TODAY specifically, when it's part of that unprocessed gap, we can do
    // better than a bare 0: the Data API's channel view count (statistics.viewCount,
    // no Analytics lag) already reflects views from videos published hours ago.
    // Comparing it against a snapshot taken before the gap started gives an
    // estimated "views today" — flagged via views_estimated so it's visibly
    // provisional and gets overwritten with the real value once Analytics catches up.
    // Earlier gap days (if the lag spans more than one day) and every other metric
    // (watch time, AVD, likes — Analytics-only, no Data API equivalent) stay at 0;
    // there's no near-real-time source to estimate those from.
    let firstRealIndex = allDates.length;
    for (let i = 0; i < allDates.length; i++) {
      if (dailyData[allDates[i]]) {
        firstRealIndex = i;
        break;
      }
    }
    const todayStr = allDates[0];
    let estimatedViewsForToday: number | null = null;
    if (firstRealIndex > 0 && !dailyData[todayStr]) {
      const lastRealDate = firstRealIndex < allDates.length ? allDates[firstRealIndex] : startDateStr;
      const { data: baselineRows } = await supabase
        .from("youtube_channel_view_snapshots")
        .select("total_views, captured_at")
        .lte("captured_at", `${lastRealDate}T23:59:59.999Z`)
        .order("captured_at", { ascending: false })
        .limit(1);
      const baseline = baselineRows?.[0];
      if (baseline) {
        const delta = currentTotalViews - Number(baseline.total_views);
        if (delta > 0) estimatedViewsForToday = delta;
      }
    }

    for (const date of allDates) {
      const dataForDay = dailyData[date] ?? null;
      const isEstimatedToday = date === todayStr && !dataForDay && estimatedViewsForToday !== null;

      const views = dataForDay?.views ?? (isEstimatedToday ? estimatedViewsForToday! : 0);
      const likes = dataForDay?.likes ?? 0;
      const comments = dataForDay?.comments ?? 0;
      const shares = dataForDay?.shares ?? 0;
      const subscribersGained = dataForDay?.subscribersGained ?? 0;
      const subscribersLost = dataForDay?.subscribersLost ?? 0;
      const estimatedMinutesWatched = dataForDay?.estimatedMinutesWatched ?? 0;
      const averageViewDuration = dataForDay?.averageViewDuration ?? 0;
      const estimatedRevenue = dataForDay ? dataForDay.estimatedRevenue : null;

      const engagement_rate = views > 0 ? Number(((likes / views) * 100).toFixed(2)) : 0;
      const watchTimeHours = Number((estimatedMinutesWatched / 60).toFixed(2));

      metricsToUpsert.push({
        platform_id: "youtube",
        date: date,
        followers: runningSubscribers,
        views: views,
        likes: likes,
        engagement_rate: engagement_rate,
        watch_time_hours: watchTimeHours,
        avd_seconds: averageViewDuration,
        subs_gained: subscribersGained,
        subs_lost: subscribersLost,
        estimated_revenue: estimatedRevenue,
        comments: comments,
        shares: shares,
        views_estimated: isEstimatedToday,
        raw_data: dataForDay?.raw ? { analytics_row: dataForDay.raw } : null,
        synced_at: new Date().toISOString(),
      });

      runningSubscribers = runningSubscribers - subscribersGained + subscribersLost;
      if (runningSubscribers < 0) runningSubscribers = 0;
    }

    // 5. Upsert
    const { error } = await supabase
      .from("metrics_daily")
      .upsert(metricsToUpsert, { onConflict: "platform_id,date" });
      
    if (error) {
      throw new Error(`Failed to upsert metrics: ${error.message}`);
    }
    
    await supabase.from("sync_logs").insert({
        platform_id: "youtube",
        status: "success",
        message: `Processed ${metricsToUpsert.length} days`,
        run_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, processed: metricsToUpsert.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Sync error:", error);
    
    try {
        await supabase.from("sync_logs").insert({
            platform_id: "youtube",
            status: "error",
            message: error instanceof Error ? error.message : String(error),
            run_at: new Date().toISOString(),
        });
    } catch(e) {
        console.error("Failed to log error to sync_logs", e);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

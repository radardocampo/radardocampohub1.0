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
        platform_id: "youtube-sync",
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

    // 3. YouTube Analytics API for the last 14 days
    const dailyData: Record<string, any> = {};
    const today = new Date();
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(today.getDate() - 14);

    const startDateStr = fourteenDaysAgo.toISOString().split("T")[0];
    const endDateStr = today.toISOString().split("T")[0];

    const analyticsUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    analyticsUrl.searchParams.append("ids", "channel==MINE");
    analyticsUrl.searchParams.append("startDate", startDateStr);
    analyticsUrl.searchParams.append("endDate", endDateStr);
    analyticsUrl.searchParams.append("metrics", "views,likes,comments,shares,subscribersGained,subscribersLost,estimatedMinutesWatched,averageViewDuration");
    analyticsUrl.searchParams.append("dimensions", "day");

    const analyticsResponse = await fetch(analyticsUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const analyticsResult = await analyticsResponse.json();

    if (!analyticsResponse.ok) {
      throw new Error(`Analytics API error: ${JSON.stringify(analyticsResult)}`);
    }

    if (analyticsResult.rows) {
      for (const row of analyticsResult.rows) {
        // row: [day, views, likes, comments, shares, subscribersGained, subscribersLost, estimatedMinutesWatched, averageViewDuration]
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
          estimatedRevenue: 0,
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

    let lastKnownData = { views: 0, likes: 0, comments: 0, shares: 0, subscribersGained: 0, subscribersLost: 0, estimatedMinutesWatched: 0, averageViewDuration: 0, estimatedRevenue: 0, raw: null };
    
    // Find most recent day with data
    for (const date of allDates) {
      if (dailyData[date]) {
        lastKnownData = dailyData[date];
        break;
      }
    }

    for (const date of allDates) {
      let dataForDay = dailyData[date];
      if (!dataForDay) {
        dataForDay = {
          ...lastKnownData,
          subscribersGained: 0,
          subscribersLost: 0,
          raw: null
        };
      } else {
        lastKnownData = dataForDay;
      }
      
      const views = dataForDay.views;
      const likes = dataForDay.likes;
      const engagement_rate = views > 0 ? Number(((likes / views) * 100).toFixed(2)) : 0;
      const watchTimeHours = Number((dataForDay.estimatedMinutesWatched / 60).toFixed(2));
      
      metricsToUpsert.push({
        platform_id: "youtube",
        date: date,
        followers: runningSubscribers,
        views: views,
        likes: likes,
        engagement_rate: engagement_rate,
        watch_time_hours: watchTimeHours,
        avd_seconds: dataForDay.averageViewDuration,
        subs_gained: dataForDay.subscribersGained,
        subs_lost: dataForDay.subscribersLost,
        estimated_revenue: dataForDay.estimatedRevenue,
        comments: dataForDay.comments,
        shares: dataForDay.shares,
        raw_data: dataForDay.raw ? { analytics_row: dataForDay.raw } : null,
        synced_at: new Date().toISOString(),
      });

      runningSubscribers = runningSubscribers - dataForDay.subscribersGained + dataForDay.subscribersLost;
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
        platform_id: "youtube-sync",
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
            platform_id: "youtube-sync",
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

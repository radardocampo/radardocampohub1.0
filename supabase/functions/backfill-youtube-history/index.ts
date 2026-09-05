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
        platform_id: "youtube-backfill",
        status: "error",
        error_message: `Refresh token failed: ${JSON.stringify(tokenData)}`,
        created_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ error: "Falha na autenticação do YouTube" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const accessToken = tokenData.access_token;

    // 2. Discover channel creation date & current subscribers
    const channelResponse = await fetch(
      `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
    );
    const channelData = await channelResponse.json();

    if (!channelResponse.ok || !channelData.items || channelData.items.length === 0) {
      throw new Error("Channel not found or API error: " + JSON.stringify(channelData));
    }

    const publishedAtStr = channelData.items[0].snippet.publishedAt;
    const currentSubscribers = Number(channelData.items[0].statistics.subscriberCount || 0);
    const creationDate = new Date(publishedAtStr);
    const startYear = creationDate.getFullYear();
    const currentYear = new Date().getFullYear();

    // 3. YouTube Analytics API chunked by year
    const dailyData: Record<string, any> = {};

    for (let year = startYear; year <= currentYear; year++) {
      let startDateStr = `${year}-01-01`;
      let endDateStr = `${year}-12-31`;

      if (year === startYear) {
        startDateStr = creationDate.toISOString().split("T")[0];
      }
      if (year === currentYear) {
        endDateStr = new Date().toISOString().split("T")[0];
      }

      if (new Date(startDateStr) > new Date(endDateStr)) {
        continue;
      }

      const analyticsUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
      analyticsUrl.searchParams.append("ids", "channel==MINE");
      analyticsUrl.searchParams.append("startDate", startDateStr);
      analyticsUrl.searchParams.append("endDate", endDateStr);
      analyticsUrl.searchParams.append("metrics", "views,likes,subscribersGained,subscribersLost");
      analyticsUrl.searchParams.append("dimensions", "day");

      const analyticsResponse = await fetch(analyticsUrl.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      const analyticsResult = await analyticsResponse.json();

      if (!analyticsResponse.ok) {
        throw new Error(`Analytics API error for year ${year}: ${JSON.stringify(analyticsResult)}`);
      }

      if (analyticsResult.rows) {
        for (const row of analyticsResult.rows) {
          // row: [day, views, likes, subscribersGained, subscribersLost]
          const day = row[0];
          dailyData[day] = {
            views: row[1] || 0,
            likes: row[2] || 0,
            subscribersGained: row[3] || 0,
            subscribersLost: row[4] || 0,
            raw: row,
          };
        }
      }
    }

    // 4. Reconstruct backward and 5. Handle gaps
    const todayStr = new Date().toISOString().split("T")[0];
    const creationDateStr = creationDate.toISOString().split("T")[0];
    
    const allDates: string[] = [];
    let currentDate = new Date();
    const endDate = new Date(creationDateStr);
    
    while (currentDate >= endDate) {
      allDates.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() - 1);
    }

    const metricsToUpsert = [];
    let runningSubscribers = currentSubscribers;

    for (const date of allDates) {
      const dataForDay = dailyData[date] || { views: 0, likes: 0, subscribersGained: 0, subscribersLost: 0, raw: null };
      
      const views = dataForDay.views;
      const likes = dataForDay.likes;
      const engagement_rate = views > 0 ? Number(((likes / views) * 100).toFixed(2)) : 0;
      
      metricsToUpsert.push({
        platform_id: "youtube",
        date: date,
        followers: runningSubscribers,
        views: views,
        likes: likes,
        engagement_rate: engagement_rate,
        raw_data: dataForDay.raw ? { analytics_row: dataForDay.raw } : null,
        synced_at: new Date().toISOString(),
      });

      // previous_day = current_day - gained + lost
      runningSubscribers = runningSubscribers - dataForDay.subscribersGained + dataForDay.subscribersLost;
      if (runningSubscribers < 0) runningSubscribers = 0;
    }

    // 6. Upsert in metrics_daily
    const chunkSize = 1000;
    for (let i = 0; i < metricsToUpsert.length; i += chunkSize) {
      const chunk = metricsToUpsert.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("metrics_daily")
        .upsert(chunk, { onConflict: "platform_id,date" });
        
      if (error) {
        throw new Error(`Failed to upsert metrics chunk: ${error.message}`);
      }
    }
    
    await supabase.from("sync_logs").insert({
        platform_id: "youtube-backfill",
        status: "success",
        records_processed: metricsToUpsert.length,
        created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, processed: metricsToUpsert.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Backfill error:", error);
    
    try {
        await supabase.from("sync_logs").insert({
            platform_id: "youtube-backfill",
            status: "error",
            error_message: error instanceof Error ? error.message : String(error),
            created_at: new Date().toISOString(),
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

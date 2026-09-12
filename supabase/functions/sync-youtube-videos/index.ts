import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Parse ISO 8601 duration (PT#H#M#S) to seconds.
 * Example: "PT1H2M30S" → 3750, "PT45S" → 45
 */
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0", 10);
  const m = parseInt(match[2] || "0", 10);
  const s = parseInt(match[3] || "0", 10);
  return h * 3600 + m * 60 + s;
}

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
        message: `[videos] Refresh token failed: ${JSON.stringify(tokenData)}`,
        run_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ error: "Falha na autenticação do YouTube" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const accessToken = tokenData.access_token;

    // 2. Get uploads playlist ID
    const channelRes = await fetch(
      `https://youtube.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
    );
    const channelData = await channelRes.json();
    if (!channelRes.ok || !channelData.items?.length) {
      throw new Error("Channel not found: " + JSON.stringify(channelData));
    }
    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // 3. List EVERY video ever uploaded to the channel (no date cutoff) — earlier
    //    versions stopped after 90 days / 50 videos, which meant a channel with more
    //    history than that (e.g. 134 videos here) only ever had its most recent slice
    //    synced, and anything computed from "all videos" (like Melhor Horário) was
    //    silently working off a subset. MAX_VIDEOS here is just a runaway-safety cap,
    //    not a deliberate recency window.
    const videoIds: string[] = [];
    let pageToken: string | undefined;
    let totalFetched = 0;
    const MAX_VIDEOS = 2000;

    while (totalFetched < MAX_VIDEOS) {
      const plUrl = new URL("https://youtube.googleapis.com/youtube/v3/playlistItems");
      plUrl.searchParams.append("part", "contentDetails");
      plUrl.searchParams.append("playlistId", uploadsPlaylistId);
      plUrl.searchParams.append("maxResults", "50");
      plUrl.searchParams.append("key", apiKey);
      if (pageToken) plUrl.searchParams.append("pageToken", pageToken);

      const plRes = await fetch(plUrl.toString());
      const plData = await plRes.json();
      if (!plRes.ok) {
        throw new Error("playlistItems.list error: " + JSON.stringify(plData));
      }

      for (const item of plData.items || []) {
        videoIds.push(item.contentDetails.videoId);
        totalFetched++;
        if (totalFetched >= MAX_VIDEOS) break;
      }

      if (!plData.nextPageToken || totalFetched >= MAX_VIDEOS) break;
      pageToken = plData.nextPageToken;
    }

    if (videoIds.length === 0) {
      await supabase.from("sync_logs").insert({
        platform_id: "youtube",
        status: "success",
        message: "[videos] No videos found on the channel",
        run_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch video metadata (snippet + contentDetails + lifetime statistics) in
    //    batches of 50. statistics.viewCount is the channel-lifetime view count for
    //    that video, independent of any date window — this is what Melhor Horário
    //    uses so old and new videos are compared on equal footing.
    const videoMeta: Record<string, { title: string; thumbnail_url: string; published_at: string; duration_seconds: number; lifetime_views: number; lifetime_likes: number; lifetime_comment_count: number }> = {};

    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const vUrl = new URL("https://youtube.googleapis.com/youtube/v3/videos");
      vUrl.searchParams.append("part", "snippet,contentDetails,statistics");
      vUrl.searchParams.append("id", batch.join(","));
      vUrl.searchParams.append("key", apiKey);

      const vRes = await fetch(vUrl.toString());
      const vData = await vRes.json();
      if (!vRes.ok) {
        console.error("videos.list error:", JSON.stringify(vData));
        continue;
      }

      for (const item of vData.items || []) {
        videoMeta[item.id] = {
          title: item.snippet.title,
          thumbnail_url: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
          published_at: item.snippet.publishedAt,
          duration_seconds: parseDuration(item.contentDetails.duration || "PT0S"),
          lifetime_views: Number(item.statistics?.viewCount ?? 0),
          lifetime_likes: Number(item.statistics?.likeCount ?? 0),
          lifetime_comment_count: Number(item.statistics?.commentCount ?? 0),
        };
      }
    }

    // 5. Upsert video metadata into youtube_videos
    const videoRows = Object.entries(videoMeta).map(([vid, meta]) => ({
      video_id: vid,
      title: meta.title,
      thumbnail_url: meta.thumbnail_url,
      published_at: meta.published_at,
      duration_seconds: meta.duration_seconds,
      lifetime_views: meta.lifetime_views,
      lifetime_likes: meta.lifetime_likes,
      lifetime_comment_count: meta.lifetime_comment_count,
      updated_at: new Date().toISOString(),
    }));

    if (videoRows.length > 0) {
      const chunk = <T,>(arr: T[], size: number) =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
      for (const c of chunk(videoRows, 500)) {
        const { error } = await supabase.from("youtube_videos").upsert(c, { onConflict: "video_id" });
        if (error) console.error("youtube_videos upsert error:", error.message);
      }
    }

    // 6. Fetch per-video DAILY analytics for the last 90 days only (dimensions=day
    //    per-video calls don't support a longer window efficiently, and the Vídeos
    //    tab's own period filter only ever offers up to 90 days / "todo período" of
    //    whatever's been synced this way — lifetime totals for older videos come
    //    from statistics.viewCount above, not from this table).
    //
    //    The window starts at the channel's oldest synced video instead of a
    //    fixed 90 days back — this channel only has ~8 months of history, so
    //    fetching the whole thing costs the same 1 Analytics API call per video
    //    (dimensions=day returns every matching day in one response either
    //    way), it just asks for more days per call. That's what makes watch
    //    time/AVD real for older videos too, instead of only the trailing
    //    90-day slice.
    const today = new Date();
    const publishedDates = Object.values(videoMeta)
      .map((m) => m.published_at)
      .filter((d): d is string => !!d);
    const oldestPublished = publishedDates.length > 0
      ? publishedDates.reduce((min, d) => (d < min ? d : min))
      : null;
    const fallbackNinetyDaysAgo = new Date();
    fallbackNinetyDaysAgo.setDate(today.getDate() - 90);
    const startDate = oldestPublished
      ? oldestPublished.split("T")[0]
      : fallbackNinetyDaysAgo.toISOString().split("T")[0];
    const endDate = today.toISOString().split("T")[0];

    let metricsUpserted = 0;

    // Process in chunks to avoid overwhelming the Analytics API
    for (let i = 0; i < videoIds.length; i += 5) {
      const chunk = videoIds.slice(i, i + 5);
      const promises = chunk.map(async (videoId) => {
        const analyticsUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
        analyticsUrl.searchParams.append("ids", "channel==MINE");
        analyticsUrl.searchParams.append("startDate", startDate);
        analyticsUrl.searchParams.append("endDate", endDate);
        analyticsUrl.searchParams.append("metrics", "views,likes,comments,estimatedMinutesWatched,averageViewDuration");
        analyticsUrl.searchParams.append("dimensions", "day");
        analyticsUrl.searchParams.append("filters", `video==${videoId}`);

        const analyticsRes = await fetch(analyticsUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });
        const analyticsData = await analyticsRes.json();

        if (analyticsRes.ok && analyticsData.rows) {
          const metricsRows = analyticsData.rows.map((row: any) => ({
            video_id: videoId,
            date: row[0],
            views: row[1] || 0,
            likes: row[2] || 0,
            comments: row[3] || 0,
            watch_time_hours: Number(((row[4] || 0) / 60).toFixed(2)),
            avg_view_duration_seconds: row[5] || 0,
            synced_at: new Date().toISOString(),
          }));

          if (metricsRows.length > 0) {
            const { error } = await supabase
              .from("youtube_video_metrics_daily")
              .upsert(metricsRows, { onConflict: "video_id,date" });
            if (error) console.error(`video_metrics upsert error for ${videoId}:`, error.message);
            else return metricsRows.length;
          }
        } else if (!analyticsRes.ok) {
          console.warn(`Video analytics error for ${videoId}:`, JSON.stringify(analyticsData));
        }
        return 0;
      });

      const results = await Promise.all(promises);
      metricsUpserted += results.reduce((acc, curr) => acc + curr, 0);
    }

    // 7. Log success
    await supabase.from("sync_logs").insert({
      platform_id: "youtube",
      status: "success",
      message: `[videos] metadata=${videoRows.length}, analytics=${metricsUpserted}`,
      run_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, videos: videoRows.length, metrics: metricsUpserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error: unknown) {
    console.error("Video sync error:", error);

    try {
      await supabase.from("sync_logs").insert({
        platform_id: "youtube",
        status: "error",
        message: `[videos] ${error instanceof Error ? error.message : String(error)}`,
        run_at: new Date().toISOString(),
      });
    } catch (e) {
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

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
        platform_id: "youtube-sync",
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

    // 3. List recent videos (last 90 days, max 50 per execution)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const videoIds: string[] = [];
    let pageToken: string | undefined;
    let totalFetched = 0;
    const MAX_VIDEOS = 50;

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

      let reachedOlder = false;
      for (const item of plData.items || []) {
        const publishedAt = new Date(item.contentDetails.videoPublishedAt);
        if (publishedAt < ninetyDaysAgo) {
          reachedOlder = true;
          break;
        }
        videoIds.push(item.contentDetails.videoId);
        totalFetched++;
        if (totalFetched >= MAX_VIDEOS) break;
      }

      if (reachedOlder || !plData.nextPageToken || totalFetched >= MAX_VIDEOS) break;
      pageToken = plData.nextPageToken;
    }

    if (videoIds.length === 0) {
      await supabase.from("sync_logs").insert({
        platform_id: "youtube-sync",
        status: "success",
        message: "[videos] No recent videos found in the last 90 days",
        run_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch video metadata (snippet + contentDetails) in batches of 50
    const videoMeta: Record<string, { title: string; thumbnail_url: string; published_at: string; duration_seconds: number }> = {};

    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const vUrl = new URL("https://youtube.googleapis.com/youtube/v3/videos");
      vUrl.searchParams.append("part", "snippet,contentDetails");
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
      updated_at: new Date().toISOString(),
    }));

    if (videoRows.length > 0) {
      const { error } = await supabase
        .from("youtube_videos")
        .upsert(videoRows, { onConflict: "video_id" });
      if (error) console.error("youtube_videos upsert error:", error.message);
    }

    // 6. Fetch per-video analytics using dimensions=video (batch via Analytics API)
    //    This is more efficient than one call per video.
    const today = new Date();
    const startDate = ninetyDaysAgo.toISOString().split("T")[0];
    const endDate = today.toISOString().split("T")[0];

    const analyticsUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    analyticsUrl.searchParams.append("ids", "channel==MINE");
    analyticsUrl.searchParams.append("startDate", startDate);
    analyticsUrl.searchParams.append("endDate", endDate);
    analyticsUrl.searchParams.append("metrics", "views,likes,comments,estimatedMinutesWatched,averageViewDuration");
    analyticsUrl.searchParams.append("dimensions", "video,day");
    if (videoIds.length > 0) {
      analyticsUrl.searchParams.append("filters", `video==${videoIds.join(",")}`);
    }

    const analyticsRes = await fetch(analyticsUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const analyticsData = await analyticsRes.json();

    let metricsUpserted = 0;
    if (analyticsRes.ok && analyticsData.rows) {
      const metricsRows = [];
      for (const row of analyticsData.rows) {
        // row: [videoId, day, views, likes, comments, estimatedMinutesWatched, averageViewDuration]
        const videoId = row[0];
        const day = row[1];
        // Only upsert metrics for videos we know about
        if (!videoMeta[videoId] && !videoIds.includes(videoId)) continue;

        metricsRows.push({
          video_id: videoId,
          date: day,
          views: row[2] || 0,
          likes: row[3] || 0,
          comments: row[4] || 0,
          watch_time_hours: Number(((row[5] || 0) / 60).toFixed(2)),
          avg_view_duration_seconds: row[6] || 0,
          synced_at: new Date().toISOString(),
        });
      }

      if (metricsRows.length > 0) {
        // Ensure all video_ids exist in youtube_videos before inserting metrics
        // (some analytics results may be for videos not in our recent list)
        const missingVideoIds = metricsRows
          .filter((r) => !videoMeta[r.video_id])
          .map((r) => r.video_id);

        if (missingVideoIds.length > 0) {
          // Fetch metadata for these videos
          const mUrl = new URL("https://youtube.googleapis.com/youtube/v3/videos");
          mUrl.searchParams.append("part", "snippet,contentDetails");
          mUrl.searchParams.append("id", missingVideoIds.join(","));
          mUrl.searchParams.append("key", apiKey);
          const mRes = await fetch(mUrl.toString());
          const mData = await mRes.json();
          if (mRes.ok && mData.items) {
            const extraRows = mData.items.map((item: any) => ({
              video_id: item.id,
              title: item.snippet.title,
              thumbnail_url: item.snippet.thumbnails?.medium?.url || "",
              published_at: item.snippet.publishedAt,
              duration_seconds: parseDuration(item.contentDetails.duration || "PT0S"),
              updated_at: new Date().toISOString(),
            }));
            if (extraRows.length > 0) {
              await supabase.from("youtube_videos").upsert(extraRows, { onConflict: "video_id" });
            }
          }
        }

        const { error } = await supabase
          .from("youtube_video_metrics_daily")
          .upsert(metricsRows, { onConflict: "video_id,date" });
        if (error) console.error("video_metrics upsert error:", error.message);
        else metricsUpserted = metricsRows.length;
      }
    } else if (!analyticsRes.ok) {
      console.warn("Video analytics error:", JSON.stringify(analyticsData));
    }

    // 7. Log success
    await supabase.from("sync_logs").insert({
      platform_id: "youtube-sync",
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
        platform_id: "youtube-sync",
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

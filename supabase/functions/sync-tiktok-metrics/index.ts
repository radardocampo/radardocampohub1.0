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
    // 1. Get TikTok credentials
    const { data: creds, error: credsError } = await supabase
      .from("platform_credentials")
      .select("*")
      .eq("platform_id", "tiktok")
      .single();

    if (credsError || !creds) {
      throw new Error("No TikTok credentials found");
    }

    let { access_token, refresh_token, token_expires_at } = creds;

    // 2. Check if token needs refresh
    const now = new Date();
    const expiresAt = new Date(token_expires_at);
    
    if (now >= expiresAt) {
      const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
      const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
      
      const refreshRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: clientKey || "",
          client_secret: clientSecret || "",
          refresh_token: refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshRes.json();
      
      if (!refreshRes.ok) {
        throw new Error(`Failed to refresh TikTok token: ${JSON.stringify(refreshData)}`);
      }

      access_token = refreshData.access_token;
      refresh_token = refreshData.refresh_token;
      
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + refreshData.expires_in);

      await supabase
        .from("platform_credentials")
        .update({
          access_token,
          refresh_token,
          token_expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("platform_id", "tiktok");
    }

    // 3. Fetch Videos and Metrics from TikTok API
    let hasMore = true;
    let cursor = 0;
    const allVideos = [];
    const fields = "id,title,video_description,duration,cover_image_url,embed_link,like_count,comment_count,share_count,view_count,create_time";

    while (hasMore) {
      const url = `https://open.tiktokapis.com/v2/video/list/?fields=${fields}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          max_count: 20,
          cursor: cursor,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`TikTok API error: ${JSON.stringify(data)}`);
      }

      if (data.data && data.data.videos) {
        allVideos.push(...data.data.videos);
      }

      hasMore = data.data?.has_more || false;
      cursor = data.data?.cursor || cursor;
    }

    // 4. Upsert Videos and Daily Metrics
    const today = new Date().toISOString().split("T")[0];
    const videosToUpsert = [];
    const metricsToUpsert = [];

    for (const video of allVideos) {
      videosToUpsert.push({
        video_id: video.id,
        title: video.title || video.video_description,
        cover_image_url: video.cover_image_url,
        share_url: video.embed_link, // or fallback to construction
        create_time: new Date(video.create_time * 1000).toISOString(),
        duration: video.duration,
        updated_at: new Date().toISOString(),
      });

      metricsToUpsert.push({
        video_id: video.id,
        date: today,
        views: video.view_count || 0,
        likes: video.like_count || 0,
        comments: video.comment_count || 0,
        shares: video.share_count || 0,
        updated_at: new Date().toISOString(),
      });
    }

    if (videosToUpsert.length > 0) {
      const { error: videosError } = await supabase
        .from("tiktok_videos")
        .upsert(videosToUpsert, { onConflict: "video_id" });
        
      if (videosError) throw new Error(`Videos upsert error: ${videosError.message}`);
    }

    if (metricsToUpsert.length > 0) {
      const { error: metricsError } = await supabase
        .from("tiktok_video_metrics_daily")
        .upsert(metricsToUpsert, { onConflict: "video_id,date" });
        
      if (metricsError) throw new Error(`Metrics upsert error: ${metricsError.message}`);
    }

    await supabase.from("sync_logs").insert({
      platform_id: "tiktok",
      status: "success",
      message: `Processed ${allVideos.length} videos`,
      run_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, videos: allVideos.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("TikTok sync error:", error);
    
    try {
      await supabase.from("sync_logs").insert({
        platform_id: "tiktok",
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

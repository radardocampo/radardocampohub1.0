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
    // 1. Authentication (same pattern as sync-youtube-metrics)
    const clientId = Deno.env.get("YOUTUBE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("YOUTUBE_OAUTH_CLIENT_SECRET");
    const refreshToken = Deno.env.get("YOUTUBE_OAUTH_REFRESH_TOKEN");

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Missing YouTube OAuth credentials in environment variables");
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
        message: `[audience] Refresh token failed: ${JSON.stringify(tokenData)}`,
        run_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ error: "Falha na autenticação do YouTube" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const accessToken = tokenData.access_token;

    // Date range: last 90 days
    const today = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(today.getDate() - 90);
    const startDate = ninetyDaysAgo.toISOString().split("T")[0];
    const endDate = today.toISOString().split("T")[0];

    const results = { audience: 0, geography: 0, traffic: 0 };

    // -----------------------------------------------------------------------
    // 2. Demographics: ageGroup × gender → youtube_audience_daily
    //    The API may return empty data for small channels or short periods.
    // -----------------------------------------------------------------------
    try {
      const demoUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
      demoUrl.searchParams.append("ids", "channel==MINE");
      demoUrl.searchParams.append("startDate", startDate);
      demoUrl.searchParams.append("endDate", endDate);
      demoUrl.searchParams.append("metrics", "viewerPercentage");
      demoUrl.searchParams.append("dimensions", "ageGroup,gender");

      const demoRes = await fetch(demoUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      const demoData = await demoRes.json();

      if (demoRes.ok && demoData.rows && demoData.rows.length > 0) {
        const rows = demoData.rows.map((row: any[]) => ({
          date: endDate,
          age_group: row[0],       // e.g. "age18-24"
          gender: row[1],          // e.g. "male", "female"
          viewer_percentage: row[2] || 0,
          synced_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from("youtube_audience_daily")
          .upsert(rows, { onConflict: "date,age_group,gender" });

        if (error) console.error("Audience upsert error:", error.message);
        else results.audience = rows.length;
      } else if (!demoRes.ok) {
        console.warn("Demographics API returned error:", JSON.stringify(demoData));
      } else {
        console.log("Demographics: no data returned (channel may be too small)");
      }
    } catch (e) {
      console.error("Demographics sync failed:", e);
    }

    // -----------------------------------------------------------------------
    // 3. Geography: country → youtube_geography_daily (top 20 by views)
    // -----------------------------------------------------------------------
    try {
      const geoUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
      geoUrl.searchParams.append("ids", "channel==MINE");
      geoUrl.searchParams.append("startDate", startDate);
      geoUrl.searchParams.append("endDate", endDate);
      geoUrl.searchParams.append("metrics", "views,estimatedMinutesWatched");
      geoUrl.searchParams.append("dimensions", "country");
      geoUrl.searchParams.append("sort", "-views");
      geoUrl.searchParams.append("maxResults", "20");

      const geoRes = await fetch(geoUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      const geoData = await geoRes.json();

      if (geoRes.ok && geoData.rows && geoData.rows.length > 0) {
        const rows = geoData.rows.map((row: any[]) => ({
          date: endDate,
          country_code: row[0],
          views: row[1] || 0,
          watch_time_minutes: row[2] || 0,
          synced_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from("youtube_geography_daily")
          .upsert(rows, { onConflict: "date,country_code" });

        if (error) console.error("Geography upsert error:", error.message);
        else results.geography = rows.length;
      } else if (!geoRes.ok) {
        console.warn("Geography API returned error:", JSON.stringify(geoData));
      }
    } catch (e) {
      console.error("Geography sync failed:", e);
    }

    // -----------------------------------------------------------------------
    // 4. Traffic Sources: insightTrafficSourceType → youtube_traffic_sources_daily
    // -----------------------------------------------------------------------
    try {
      const trafficUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
      trafficUrl.searchParams.append("ids", "channel==MINE");
      trafficUrl.searchParams.append("startDate", startDate);
      trafficUrl.searchParams.append("endDate", endDate);
      trafficUrl.searchParams.append("metrics", "views");
      trafficUrl.searchParams.append("dimensions", "insightTrafficSourceType");

      const trafficRes = await fetch(trafficUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      const trafficData = await trafficRes.json();

      if (trafficRes.ok && trafficData.rows && trafficData.rows.length > 0) {
        const rows = trafficData.rows.map((row: any[]) => ({
          date: endDate,
          traffic_source_type: row[0],
          views: row[1] || 0,
          synced_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from("youtube_traffic_sources_daily")
          .upsert(rows, { onConflict: "date,traffic_source_type" });

        if (error) console.error("Traffic upsert error:", error.message);
        else results.traffic = rows.length;
      } else if (!trafficRes.ok) {
        console.warn("Traffic API returned error:", JSON.stringify(trafficData));
      }
    } catch (e) {
      console.error("Traffic sync failed:", e);
    }

    // 5. Log success
    await supabase.from("sync_logs").insert({
      platform_id: "youtube-sync",
      status: "success",
      message: `[audience] demographics=${results.audience}, geography=${results.geography}, traffic=${results.traffic}`,
      run_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Audience sync error:", error);

    try {
      await supabase.from("sync_logs").insert({
        platform_id: "youtube-sync",
        status: "error",
        message: `[audience] ${error instanceof Error ? error.message : String(error)}`,
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

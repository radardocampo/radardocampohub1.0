import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_STATUSES = new Set(["published", "heldForReview", "rejected"]);

// Sets a comment's moderation status: "published" (approve), "heldForReview"
// (hold for later review), or "rejected" (YouTube's modern equivalent of
// "mark as spam" — the old comments.markAsSpam endpoint is deprecated in
// favor of this). This changes visibility, it does not delete the comment;
// per CLAUDE.md this codebase never calls a delete endpoint on YouTube
// content, so there is intentionally no delete action here.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const commentId = typeof body.comment_id === "string" ? body.comment_id.trim() : "";
    const moderationStatus = typeof body.moderation_status === "string" ? body.moderation_status : "";

    if (!commentId || !VALID_STATUSES.has(moderationStatus)) {
      return new Response(
        JSON.stringify({ error: "comment_id e moderation_status (published|heldForReview|rejected) são obrigatórios" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

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
      return new Response(JSON.stringify({ error: "Falha na autenticação do YouTube" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const accessToken = tokenData.access_token;

    const modUrl = new URL("https://www.googleapis.com/youtube/v3/comments/setModerationStatus");
    modUrl.searchParams.set("id", commentId);
    modUrl.searchParams.set("moderationStatus", moderationStatus);

    const modRes = await fetch(modUrl.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!modRes.ok) {
      const errBody = await modRes.text();
      await supabase.from("sync_logs").insert({
        platform_id: "youtube",
        status: "error",
        message: `[comments-moderate] setModerationStatus(${moderationStatus}) error: ${errBody}`,
        run_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ error: `Falha ao moderar: ${errBody}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: modRes.status,
      });
    }

    // setModerationStatus returns 204 No Content on success.
    const { error: updateError } = await supabase
      .from("youtube_comments")
      .update({ moderation_status: moderationStatus })
      .eq("comment_id", commentId);
    if (updateError) console.error("Failed to update local moderation_status:", updateError.message);

    await supabase.from("sync_logs").insert({
      platform_id: "youtube",
      status: "success",
      message: `[comments-moderate] ${commentId} -> ${moderationStatus}`,
      run_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, comment_id: commentId, moderation_status: moderationStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Moderate comment error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

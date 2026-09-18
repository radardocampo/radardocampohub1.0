import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_REPLY_LENGTH = 10000; // YouTube's own comment length ceiling

// Posts a reply to an existing top-level comment (comments.insert with a
// parentId). This is the ONLY YouTube-write path in the comments panel — it
// only ever creates a reply. Per project policy (see CLAUDE.md) nothing in
// this codebase may delete, hide, or moderate-remove YouTube content, so this
// function intentionally has no delete/moderate branch.
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
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!commentId || !text) {
      return new Response(JSON.stringify({ error: "comment_id e text são obrigatórios" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    if (text.length > MAX_REPLY_LENGTH) {
      return new Response(JSON.stringify({ error: `Resposta excede ${MAX_REPLY_LENGTH} caracteres` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const clientId = Deno.env.get("YOUTUBE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("YOUTUBE_OAUTH_CLIENT_SECRET");
    const refreshToken = Deno.env.get("YOUTUBE_OAUTH_REFRESH_TOKEN");
    const channelId = Deno.env.get("YOUTUBE_CHANNEL_ID");

    if (!clientId || !clientSecret || !refreshToken || !channelId) {
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

    const insertRes = await fetch(
      "https://www.googleapis.com/youtube/v3/comments?part=snippet",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            parentId: commentId,
            textOriginal: text,
          },
        }),
      },
    );
    const insertData = await insertRes.json();
    if (!insertRes.ok) {
      await supabase.from("sync_logs").insert({
        platform_id: "youtube",
        status: "error",
        message: `[comments-reply] comments.insert error: ${JSON.stringify(insertData)}`,
        run_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ error: `Falha ao responder: ${JSON.stringify(insertData)}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: insertRes.status,
      });
    }

    const replySnippet = insertData.snippet;
    const replyRow = {
      reply_id: insertData.id as string,
      parent_comment_id: commentId,
      author_display_name: replySnippet?.authorDisplayName ?? null,
      author_channel_id: replySnippet?.authorChannelId?.value ?? channelId,
      text_display: replySnippet?.textDisplay ?? text,
      is_owner: true,
      published_at: replySnippet?.publishedAt ?? new Date().toISOString(),
      synced_at: new Date().toISOString(),
    };

    const { error: replyInsertError } = await supabase
      .from("youtube_comment_replies")
      .upsert(replyRow, { onConflict: "reply_id" });
    if (replyInsertError) console.error("Failed to store reply row:", replyInsertError.message);

    const { error: updateError } = await supabase
      .from("youtube_comments")
      .update({ has_owner_reply: true })
      .eq("comment_id", commentId);
    if (updateError) console.error("Failed to flag has_owner_reply:", updateError.message);

    await supabase.from("sync_logs").insert({
      platform_id: "youtube",
      status: "success",
      message: `[comments-reply] replied to ${commentId}`,
      run_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, reply: replyRow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Reply error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

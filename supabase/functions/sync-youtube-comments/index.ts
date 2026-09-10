import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PAGES = 10; // up to ~1000 threads per moderation status, per sync

// Reads (never writes/deletes) comment threads across the whole channel and
// stores them so the Comentários panel can list and filter them without
// hitting the YouTube API on every page load. Writing (replying, or changing
// moderation status) happens in separate edge functions.
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
      await supabase.from("sync_logs").insert({
        platform_id: "youtube",
        status: "error",
        message: `[comments] Refresh token failed: ${JSON.stringify(tokenData)}`,
        run_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ error: "Falha na autenticação do YouTube" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const accessToken = tokenData.access_token;

    // 2. Page through commentThreads for the whole channel, once per moderation
    //    status. "heldForReview" is a completely separate queue that the default
    //    (published) listing never includes — it's what lets the panel show
    //    comments still awaiting the creator's approval.
    const commentRows: Array<Record<string, unknown>> = [];
    const replyRows: Array<Record<string, unknown>> = [];

    const fetchThreads = async (moderationStatus: "published" | "heldForReview") => {
      let pageToken: string | undefined;
      let pagesFetched = 0;

      do {
        const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
        url.searchParams.set("part", "snippet,replies");
        url.searchParams.set("allThreadsRelatedToChannelId", channelId);
        url.searchParams.set("maxResults", "100");
        url.searchParams.set("order", "time");
        url.searchParams.set("textFormat", "plainText");
        url.searchParams.set("moderationStatus", moderationStatus);
        if (pageToken) url.searchParams.set("pageToken", pageToken);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });
        const body = await res.json();

        if (!res.ok) {
          // Comments can be disabled channel-wide or per-video; that's not a hard failure.
          if (res.status === 403) {
            console.warn(`commentThreads.list (${moderationStatus}) 403 (comments may be disabled):`, JSON.stringify(body));
            break;
          }
          throw new Error(`commentThreads.list (${moderationStatus}) error: ${JSON.stringify(body)}`);
        }

        for (const item of body.items ?? []) {
          const top = item.snippet?.topLevelComment?.snippet;
          if (!top) continue;
          const commentId = item.snippet.topLevelComment.id as string;

          const inlineReplies = item.replies?.comments ?? [];
          const hasOwnerReply = inlineReplies.some(
            (r: any) => r.snippet?.authorChannelId?.value === channelId,
          );

          commentRows.push({
            comment_id: commentId,
            video_id: item.snippet.videoId,
            author_display_name: top.authorDisplayName ?? null,
            author_profile_image_url: top.authorProfileImageUrl ?? null,
            author_channel_id: top.authorChannelId?.value ?? null,
            text_display: top.textDisplay ?? "",
            like_count: top.likeCount ?? 0,
            total_reply_count: item.snippet.totalReplyCount ?? 0,
            has_owner_reply: hasOwnerReply,
            can_reply: item.snippet.canReply ?? true,
            moderation_status: moderationStatus,
            published_at: top.publishedAt ?? null,
            synced_at: new Date().toISOString(),
          });

          for (const r of inlineReplies) {
            const rSnippet = r.snippet;
            if (!rSnippet) continue;
            replyRows.push({
              reply_id: r.id,
              parent_comment_id: commentId,
              author_display_name: rSnippet.authorDisplayName ?? null,
              author_channel_id: rSnippet.authorChannelId?.value ?? null,
              text_display: rSnippet.textDisplay ?? "",
              is_owner: rSnippet.authorChannelId?.value === channelId,
              published_at: rSnippet.publishedAt ?? null,
              synced_at: new Date().toISOString(),
            });
          }
        }

        pageToken = body.nextPageToken;
        pagesFetched++;
      } while (pageToken && pagesFetched < MAX_PAGES);
    };

    await fetchThreads("published");
    await fetchThreads("heldForReview");

    // 3. Upsert (chunked to stay well under request size limits)
    const chunk = <T,>(arr: T[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

    for (const c of chunk(commentRows, 500)) {
      const { error } = await supabase.from("youtube_comments").upsert(c, { onConflict: "comment_id" });
      if (error) throw new Error(`Failed to upsert comments chunk: ${error.message}`);
    }
    for (const c of chunk(replyRows, 500)) {
      const { error } = await supabase.from("youtube_comment_replies").upsert(c, { onConflict: "reply_id" });
      if (error) throw new Error(`Failed to upsert replies chunk: ${error.message}`);
    }

    const heldCount = commentRows.filter((c) => c.moderation_status === "heldForReview").length;
    await supabase.from("sync_logs").insert({
      platform_id: "youtube",
      status: "success",
      message: `[comments] threads=${commentRows.length} (held=${heldCount}), replies=${replyRows.length}`,
      run_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, threads: commentRows.length, held: heldCount, replies: replyRows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Comments sync error:", error);

    try {
      await supabase.from("sync_logs").insert({
        platform_id: "youtube",
        status: "error",
        message: `[comments] ${error instanceof Error ? error.message : String(error)}`,
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

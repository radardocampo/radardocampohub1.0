import { createServerFn } from "@tanstack/react-start";

export type YoutubeDailyRow = {
  date: string;
  followers: number;
  views: number;
  likes: number;
  engagement_rate: number;
};

/** Lê as métricas diárias reais do YouTube já salvas no banco. */
export const getYoutubeMetrics = createServerFn({ method: "GET" })
  .inputValidator((data: { days: number }) => ({
    days: Math.min(365, Math.max(1, Math.floor(data.days))),
  }))
  .handler(async ({ data }): Promise<YoutubeDailyRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = new Date();
    from.setDate(from.getDate() - data.days);
    const { data: rows, error } = await supabaseAdmin
      .from("metrics_daily")
      .select("date, followers, views, likes, engagement_rate")
      .eq("platform_id", "youtube")
      .gte("date", from.toISOString().slice(0, 10))
      .order("date", { ascending: true });

    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      date: r.date,
      followers: Number(r.followers),
      views: Number(r.views),
      likes: Number(r.likes),
      engagement_rate: Number(r.engagement_rate),
    }));
  });

/** Busca dados na API do YouTube e grava o snapshot de hoje. */
export const syncYoutubeMetrics = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const apiKey = process.env["YOUTUBE_API_KEY"];
  const channelId = process.env["YOUTUBE_CHANNEL_ID"];

  const fail = async (message: string) => {
    await supabaseAdmin
      .from("sync_logs")
      .insert({ platform_id: "youtube", status: "error", message });
    throw new Error(message);
  };

  if (!apiKey || !channelId) {
    return fail("Credenciais do YouTube (YOUTUBE_API_KEY / YOUTUBE_CHANNEL_ID) não configuradas.");
  }

  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${channelId}&key=${apiKey}`,
  );
  if (!channelRes.ok) return fail("Falha ao buscar dados do canal no YouTube.");
  const channelData = (await channelRes.json()) as {
    items?: Array<{
      statistics?: { subscriberCount?: string; viewCount?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  };

  const channel = channelData.items?.[0];
  if (!channel) return fail("Canal não encontrado no YouTube.");

  const subscribers = Number(channel.statistics?.subscriberCount ?? 0);
  const channelViews = Number(channel.statistics?.viewCount ?? 0);
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return fail("Playlist de uploads não encontrada no canal.");

  const playlistRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=10&key=${apiKey}`,
  );
  if (!playlistRes.ok) return fail("Falha ao buscar vídeos recentes do YouTube.");
  const playlistData = (await playlistRes.json()) as {
    items?: Array<{ contentDetails?: { videoId?: string } }>;
  };
  const videoIds = (playlistData.items ?? [])
    .map((i) => i.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));

  let likes = 0;
  let comments = 0;
  let recentViews = 0;
  if (videoIds.length > 0) {
    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(",")}&key=${apiKey}`,
    );
    if (!videosRes.ok) return fail("Falha ao buscar estatísticas dos vídeos recentes.");
    const videosData = (await videosRes.json()) as {
      items?: Array<{
        statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
      }>;
    };
    for (const video of videosData.items ?? []) {
      recentViews += Number(video.statistics?.viewCount ?? 0);
      likes += Number(video.statistics?.likeCount ?? 0);
      comments += Number(video.statistics?.commentCount ?? 0);
    }
  }

  const engagementRate =
    recentViews > 0 ? Number((((likes + comments) / recentViews) * 100).toFixed(3)) : 0;
  const today = new Date().toISOString().slice(0, 10);

  // Sem constraint única em (platform_id, date): substitui o registro do dia.
  await supabaseAdmin.from("metrics_daily").delete().eq("platform_id", "youtube").eq("date", today);

  const { error: insertError } = await supabaseAdmin.from("metrics_daily").insert({
    platform_id: "youtube",
    date: today,
    followers: subscribers,
    views: channelViews,
    likes,
    engagement_rate: engagementRate,
    raw_data: channelData as never,
    synced_at: new Date().toISOString(),
  });
  if (insertError) return fail("Falha ao salvar métricas do YouTube no banco de dados.");

  await supabaseAdmin.from("sync_logs").insert({
    platform_id: "youtube",
    status: "success",
    message: "Métricas sincronizadas com sucesso.",
  });

  return { success: true, followers: subscribers, views: channelViews, likes, engagementRate };
});

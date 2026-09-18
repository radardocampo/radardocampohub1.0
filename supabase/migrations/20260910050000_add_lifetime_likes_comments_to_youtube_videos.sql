-- =============================================================================
-- Migration: lifetime like/comment counts per video.
--
-- Same rationale as lifetime_views (20260910040000): the "Vídeos" tab's "Todo
-- período" filter was still silently bounded by youtube_video_metrics_daily,
-- which only has rows for videos that had measurable views within whatever
-- ~90-day window was last synced — a video with zero recent views (even a
-- perfectly fine older upload) simply never appeared, and the oldest video
-- ever shown in the table wasn't the channel's actual oldest. Pulling
-- likeCount/commentCount from videos.list statistics alongside viewCount lets
-- "Todo período" be built directly from youtube_videos (every synced video),
-- instead of from the day-windowed metrics table.
-- =============================================================================

ALTER TABLE public.youtube_videos
ADD COLUMN IF NOT EXISTS lifetime_likes BIGINT,
ADD COLUMN IF NOT EXISTS lifetime_comment_count BIGINT;

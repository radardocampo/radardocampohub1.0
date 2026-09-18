-- =============================================================================
-- Migration:
-- 1. youtube_videos.lifetime_views — channel-lifetime view count per video
--    (from videos.list statistics.viewCount), independent of any date window.
--    sync-youtube-videos previously only ever listed videos published in the
--    last 90 days (max 50), so anything computed from "all videos" (Melhor
--    Horário) was silently working off a subset of the channel's real history.
--    Now that the sync lists every video on the channel, per-video performance
--    needs a metric that isn't itself bounded to a recent window — lifetime
--    view count from the Data API is exactly that.
-- 2. youtube_comments.moderation_status gains 'likelySpam' — a distinct
--    category YouTube's own systems auto-hide (separate from the smaller
--    'heldForReview' queue), which is what most creators mean by "comments
--    hidden automatically".
-- =============================================================================

ALTER TABLE public.youtube_videos
ADD COLUMN IF NOT EXISTS lifetime_views BIGINT;

ALTER TABLE public.youtube_comments
DROP CONSTRAINT IF EXISTS youtube_comments_moderation_status_check;

ALTER TABLE public.youtube_comments
ADD CONSTRAINT youtube_comments_moderation_status_check
  CHECK (moderation_status IN ('published', 'heldForReview', 'likelySpam', 'rejected'));

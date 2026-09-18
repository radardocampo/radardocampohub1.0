-- =============================================================================
-- Migration: YouTube comments panel (read + reply)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. youtube_comments — top-level comment threads across the whole channel
-- ---------------------------------------------------------------------------
CREATE TABLE public.youtube_comments (
  comment_id TEXT PRIMARY KEY,              -- YouTube's top-level comment id (== thread id)
  video_id TEXT NOT NULL,
  author_display_name TEXT,
  author_profile_image_url TEXT,
  author_channel_id TEXT,
  text_display TEXT,
  like_count BIGINT NOT NULL DEFAULT 0,
  total_reply_count INTEGER NOT NULL DEFAULT 0,
  has_owner_reply BOOLEAN NOT NULL DEFAULT false,
  can_reply BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_comments TO authenticated;
GRANT ALL ON public.youtube_comments TO service_role;
ALTER TABLE public.youtube_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "youtube_comments_auth_all"
  ON public.youtube_comments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX youtube_comments_video_id_idx ON public.youtube_comments (video_id);
CREATE INDEX youtube_comments_published_at_idx ON public.youtube_comments (published_at DESC);

-- ---------------------------------------------------------------------------
-- 2. youtube_comment_replies — replies to a thread (ours and others'), so the
--    panel can show existing replies inline without a live YouTube API call.
-- ---------------------------------------------------------------------------
CREATE TABLE public.youtube_comment_replies (
  reply_id TEXT PRIMARY KEY,
  parent_comment_id TEXT NOT NULL REFERENCES public.youtube_comments(comment_id) ON DELETE CASCADE,
  author_display_name TEXT,
  author_channel_id TEXT,
  text_display TEXT,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_comment_replies TO authenticated;
GRANT ALL ON public.youtube_comment_replies TO service_role;
ALTER TABLE public.youtube_comment_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "youtube_comment_replies_auth_all"
  ON public.youtube_comment_replies FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE INDEX youtube_comment_replies_parent_idx ON public.youtube_comment_replies (parent_comment_id);

-- =============================================================================
-- Migration: comment moderation status (approve / hold for review / reject-spam)
--
-- Mirrors the YouTube Data API v3 comments.setModerationStatus values exactly:
-- 'published' (approved/visible), 'heldForReview' (awaiting the creator's
-- decision — a separate queue the default comment listing never includes),
-- 'rejected' (the modern equivalent of "mark as spam"; the old
-- comments.markAsSpam endpoint is deprecated in favor of this status).
-- This only changes visibility on YouTube's side — it is never a delete.
-- =============================================================================

ALTER TABLE public.youtube_comments
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'published'
  CHECK (moderation_status IN ('published', 'heldForReview', 'rejected'));

CREATE INDEX IF NOT EXISTS youtube_comments_moderation_status_idx
  ON public.youtube_comments (moderation_status);

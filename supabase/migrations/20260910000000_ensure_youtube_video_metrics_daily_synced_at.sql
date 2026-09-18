-- =============================================================================
-- Migration: Ensure youtube_video_metrics_daily has the synced_at column.
--
-- The table was defined with `synced_at TIMESTAMPTZ NOT NULL DEFAULT now()` in
-- 20260906040000_update_youtube_daily.sql, and the sync-youtube-videos edge
-- function writes to that column on every upsert. The checked-in generated
-- Supabase types (src/integrations/supabase/types.ts) were out of sync and
-- described this table with created_at/updated_at instead — this migration
-- is a safe, idempotent guard so the column exists regardless of which state
-- the live database was actually in.
-- =============================================================================

ALTER TABLE public.youtube_video_metrics_daily
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT now();

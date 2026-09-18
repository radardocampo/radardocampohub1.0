-- =============================================================================
-- Migration: Add missing updated_at column to metrics_daily.
--
-- Live sync failures ("Could not find the 'updated_at' column of
-- 'metrics_daily' in the schema cache") show that something in the live
-- Supabase project — most likely a generic "set updated_at on write" trigger
-- attached outside of this migrations folder (e.g. via the Supabase/Lovable
-- dashboard) — expects every row write to populate an `updated_at` column
-- that was never added to `metrics_daily` by our hand-written migrations
-- (this table only ever defined `synced_at`). This is the same class of
-- schema drift already found on youtube_video_metrics_daily
-- (20260910000000_ensure_youtube_video_metrics_daily_synced_at.sql).
--
-- Adding the column is a safe, idempotent guard regardless of the exact
-- trigger involved.
-- =============================================================================

ALTER TABLE public.metrics_daily
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Same drift is plausible on every other table the YouTube sync pipeline writes
-- to (they were all created with a `synced_at` convention instead of
-- `updated_at`), so add the same safety net everywhere proactively instead of
-- fixing them one failure at a time.
ALTER TABLE public.sync_logs
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.youtube_audience_daily
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.youtube_geography_daily
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.youtube_traffic_sources_daily
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.youtube_videos
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.financial_entries
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

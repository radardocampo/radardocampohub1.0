-- =============================================================================
-- Migration: Expand YouTube integration with audience, geography, traffic
--            source, video metadata, and per-video metrics tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. youtube_audience_daily — demographic snapshots (age × gender)
-- ---------------------------------------------------------------------------
CREATE TABLE public.youtube_audience_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  age_group TEXT NOT NULL,          -- e.g. "age13-17", "age18-24", "age25-34", "age35-44", "age45-54", "age55-64", "age65-"
  gender TEXT NOT NULL,             -- e.g. "male", "female", "user_specified"
  viewer_percentage NUMERIC(6,3) NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, age_group, gender)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_audience_daily TO authenticated;
GRANT ALL ON public.youtube_audience_daily TO service_role;
ALTER TABLE public.youtube_audience_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "youtube_audience_daily_auth_all"
  ON public.youtube_audience_daily FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. youtube_geography_daily — views & watch time by country
-- ---------------------------------------------------------------------------
CREATE TABLE public.youtube_geography_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  country_code TEXT NOT NULL,       -- ISO 3166-1 alpha-2 (e.g. "BR", "US")
  views BIGINT NOT NULL DEFAULT 0,
  watch_time_minutes NUMERIC NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, country_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_geography_daily TO authenticated;
GRANT ALL ON public.youtube_geography_daily TO service_role;
ALTER TABLE public.youtube_geography_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "youtube_geography_daily_auth_all"
  ON public.youtube_geography_daily FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. youtube_traffic_sources_daily — views by traffic source type
-- ---------------------------------------------------------------------------
CREATE TABLE public.youtube_traffic_sources_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  traffic_source_type TEXT NOT NULL, -- e.g. "YT_SEARCH", "SUGGESTED_VIDEO", "EXTERNAL", etc.
  views BIGINT NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, traffic_source_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_traffic_sources_daily TO authenticated;
GRANT ALL ON public.youtube_traffic_sources_daily TO service_role;
ALTER TABLE public.youtube_traffic_sources_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "youtube_traffic_sources_daily_auth_all"
  ON public.youtube_traffic_sources_daily FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. youtube_videos — video metadata (from Data API v3)
-- ---------------------------------------------------------------------------
CREATE TABLE public.youtube_videos (
  video_id TEXT PRIMARY KEY,
  title TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  duration_seconds INTEGER,         -- from contentDetails.duration (ISO 8601 → seconds)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_videos TO authenticated;
GRANT ALL ON public.youtube_videos TO service_role;
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "youtube_videos_auth_all"
  ON public.youtube_videos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. youtube_video_metrics_period — per-video analytics for a date range
-- ---------------------------------------------------------------------------
CREATE TABLE public.youtube_video_metrics_period (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL REFERENCES public.youtube_videos(video_id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  watch_time_hours NUMERIC NOT NULL DEFAULT 0,
  avg_view_duration_seconds NUMERIC NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id, period_start, period_end)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_video_metrics_period TO authenticated;
GRANT ALL ON public.youtube_video_metrics_period TO service_role;
ALTER TABLE public.youtube_video_metrics_period ENABLE ROW LEVEL SECURITY;
CREATE POLICY "youtube_video_metrics_period_auth_all"
  ON public.youtube_video_metrics_period FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

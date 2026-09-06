-- =============================================================================
-- Migration: Youtube Video Metrics Daily and Auto-Sync Revenue
-- =============================================================================

-- 1. Drop old table
DROP TABLE IF EXISTS public.youtube_video_metrics_period CASCADE;

-- 2. Create new daily metrics table
CREATE TABLE IF NOT EXISTS public.youtube_video_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL REFERENCES public.youtube_videos(video_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  watch_time_hours NUMERIC NOT NULL DEFAULT 0,
  avg_view_duration_seconds NUMERIC NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_video_metrics_daily TO authenticated;
GRANT ALL ON public.youtube_video_metrics_daily TO service_role;
ALTER TABLE public.youtube_video_metrics_daily ENABLE ROW LEVEL SECURITY;
-- Ignore if policy exists
DO $$ BEGIN
  CREATE POLICY "youtube_video_metrics_daily_auth_all"
    ON public.youtube_video_metrics_daily FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Add UNIQUE constraint to financial_entries
-- Delete duplicate entries if any exist to prevent constraint creation from failing
DELETE FROM public.financial_entries a USING (
  SELECT MIN(id::text)::uuid as id, platform_id, date, source_type
  FROM public.financial_entries 
  GROUP BY platform_id, date, source_type HAVING COUNT(*) > 1
) b WHERE a.platform_id = b.platform_id AND a.date = b.date AND a.source_type = b.source_type AND a.id <> b.id;

DO $$ BEGIN
  ALTER TABLE public.financial_entries 
    ADD CONSTRAINT financial_entries_platform_id_date_source_type_key 
    UNIQUE (platform_id, date, source_type);
EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_alias THEN NULL; END $$;

-- 4. Create trigger to auto-upsert YouTube revenue to financial_entries
CREATE OR REPLACE FUNCTION sync_youtube_revenue_to_financial_entries()
RETURNS TRIGGER AS $func$
BEGIN
  IF NEW.platform_id = 'youtube' AND NEW.estimated_revenue IS NOT NULL THEN
    INSERT INTO public.financial_entries (platform_id, date, amount, currency, source_type, synced_at)
    VALUES ('youtube', NEW.date, NEW.estimated_revenue, 'USD', 'youtube_ads_auto', now())
    ON CONFLICT (platform_id, date, source_type)
    DO UPDATE SET 
      amount = EXCLUDED.amount,
      synced_at = EXCLUDED.synced_at;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_youtube_revenue ON public.metrics_daily;
CREATE TRIGGER trigger_sync_youtube_revenue
  AFTER INSERT OR UPDATE ON public.metrics_daily
  FOR EACH ROW
  EXECUTE FUNCTION sync_youtube_revenue_to_financial_entries();

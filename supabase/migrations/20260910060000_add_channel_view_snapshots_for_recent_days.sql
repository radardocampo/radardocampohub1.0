-- =============================================================================
-- YouTube Analytics has a well-known ~24-72h processing lag: the most recent
-- 1-3 days never have a `dimensions=day` row yet when sync-youtube-metrics
-- runs. Those days used to either get fabricated (copy of the last real day,
-- fixed in a previous migration/commit) or plain zeroed out — accurate, but
-- unhelpful when the Data API's near-real-time channel view count already
-- shows a video published hours ago picking up views.
--
-- This table snapshots the channel's lifetime view count (channels.list
-- statistics.viewCount, Data API — not Analytics, so no processing lag) every
-- time sync-youtube-metrics runs. With two snapshots straddling the
-- unprocessed gap, the edge function can compute a delta and use it as a
-- same-day ESTIMATE for "views today" instead of a bare 0, while everything
-- else (watch time, AVD — Analytics-only metrics with no Data API
-- equivalent) still waits for the real processed value.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.youtube_channel_view_snapshots (
  id BIGSERIAL PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_views BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_youtube_channel_view_snapshots_captured_at
  ON public.youtube_channel_view_snapshots (captured_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_channel_view_snapshots TO authenticated;
GRANT ALL ON public.youtube_channel_view_snapshots TO service_role;
ALTER TABLE public.youtube_channel_view_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "youtube_channel_view_snapshots_auth_all" ON public.youtube_channel_view_snapshots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Marks a metrics_daily row's `views` as a same-day estimate (derived from the
-- snapshot delta above) rather than a real YouTube Analytics value. A later
-- sync's upsert overwrites both the value and this flag once Analytics
-- finishes processing that day.
ALTER TABLE public.metrics_daily
ADD COLUMN IF NOT EXISTS views_estimated BOOLEAN NOT NULL DEFAULT false;

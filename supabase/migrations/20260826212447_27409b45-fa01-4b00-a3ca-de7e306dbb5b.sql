CREATE TABLE public.platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monetized BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT ON public.platforms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platforms TO authenticated;
GRANT ALL ON public.platforms TO service_role;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platforms_public_read" ON public.platforms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "platforms_auth_write" ON public.platforms FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id TEXT NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  followers INTEGER NOT NULL DEFAULT 0,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  raw_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metrics_daily TO authenticated;
GRANT ALL ON public.metrics_daily TO service_role;
ALTER TABLE public.metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metrics_daily_auth_all" ON public.metrics_daily FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id TEXT NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  source_type TEXT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_entries TO authenticated;
GRANT ALL ON public.financial_entries TO service_role;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_entries_auth_all" ON public.financial_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.routine_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  day_of_week INTEGER[] NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_tasks TO authenticated;
GRANT ALL ON public.routine_tasks TO service_role;
ALTER TABLE public.routine_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine_tasks_auth_all" ON public.routine_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.content_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  platform_id TEXT REFERENCES public.platforms(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ideia',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_ideas TO authenticated;
GRANT ALL ON public.content_ideas TO service_role;
ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_ideas_auth_all" ON public.content_ideas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id TEXT REFERENCES public.platforms(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  message TEXT,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_logs TO authenticated;
GRANT ALL ON public.sync_logs TO service_role;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_logs_auth_all" ON public.sync_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.platforms (id, name, monetized) VALUES
  ('youtube', 'YouTube', true),
  ('tiktok', 'TikTok', true),
  ('shopee', 'Shopee', true),
  ('instagram', 'Instagram', false),
  ('pinterest', 'Pinterest', false),
  ('threads', 'Threads', false),
  ('facebook', 'Facebook', false),
  ('kwai', 'Kwai', false);
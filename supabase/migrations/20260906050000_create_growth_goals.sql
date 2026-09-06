-- =============================================================================
-- Migration: Create Growth Goals Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.growth_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  target_value BIGINT NOT NULL,
  period TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform_id, metric, period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_goals TO authenticated;
GRANT ALL ON public.growth_goals TO service_role;
ALTER TABLE public.growth_goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "growth_goals_auth_all"
    ON public.growth_goals FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

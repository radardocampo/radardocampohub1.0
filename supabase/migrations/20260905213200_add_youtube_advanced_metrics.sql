-- Migration for expanding metrics_daily table with advanced YouTube metrics.

ALTER TABLE public.metrics_daily
ADD COLUMN IF NOT EXISTS watch_time_hours numeric,
ADD COLUMN IF NOT EXISTS avd_seconds numeric,
ADD COLUMN IF NOT EXISTS subs_gained integer,
ADD COLUMN IF NOT EXISTS subs_lost integer,
ADD COLUMN IF NOT EXISTS estimated_revenue numeric;

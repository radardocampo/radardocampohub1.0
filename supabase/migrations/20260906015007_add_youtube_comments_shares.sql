ALTER TABLE metrics_daily
ADD COLUMN IF NOT EXISTS comments bigint,
ADD COLUMN IF NOT EXISTS shares bigint;

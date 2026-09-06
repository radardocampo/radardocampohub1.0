CREATE TABLE IF NOT EXISTS platform_credentials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id text NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Trigger to update updated_at automatically, if it exists in the schema usually
-- But let's just make sure it's valid SQL.

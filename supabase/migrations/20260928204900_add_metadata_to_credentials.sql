-- Add metadata column to store extended profile info (display_name, avatar, bio, etc.)
ALTER TABLE "public"."platform_credentials" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;

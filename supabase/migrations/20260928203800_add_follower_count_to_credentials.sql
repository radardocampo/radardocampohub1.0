-- Add follower_count column to platform_credentials for storing latest follower snapshot
ALTER TABLE "public"."platform_credentials" ADD COLUMN IF NOT EXISTS "follower_count" bigint DEFAULT 0;

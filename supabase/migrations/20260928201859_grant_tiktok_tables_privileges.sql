-- Grant privileges to the service_role so edge functions can write to these tables
GRANT ALL PRIVILEGES ON TABLE "public"."tiktok_videos" TO "service_role";
GRANT ALL PRIVILEGES ON TABLE "public"."tiktok_video_metrics_daily" TO "service_role";
GRANT ALL PRIVILEGES ON TABLE "public"."sync_logs" TO "service_role";

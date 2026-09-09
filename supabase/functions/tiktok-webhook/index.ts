import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { HmacSha256 } from "https://deno.land/std@0.160.0/hash/sha256.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, tiktok-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("tiktok-signature");

    if (!signatureHeader) {
      return new Response("Missing signature", { status: 400 });
    }

    // signature format: "t=timestamp,s=hash"
    const match = signatureHeader.match(/t=(\d+),v1=([a-f0-9]+)/) || signatureHeader.match(/t=(\d+),s=([a-f0-9]+)/);
    if (!match) {
      console.error("Invalid signature format:", signatureHeader);
      return new Response("Invalid signature format", { status: 400 });
    }

    const [, timestamp, hash] = match;
    const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
    
    if (!clientSecret) {
      throw new Error("Missing TIKTOK_CLIENT_SECRET");
    }

    // calculate HMAC
    const hmac = new HmacSha256(clientSecret);
    hmac.update(timestamp + "." + rawBody);
    const calculatedHash = hmac.hex();

    if (calculatedHash !== hash) {
      console.error("Signature mismatch:", { expected: hash, calculated: calculatedHash });
      return new Response("Signature mismatch", { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    
    // Grab the event type
    const eventType = payload.event_type || payload.type || "unknown";

    // Log the event to database
    await supabase.from("tiktok_webhook_events").insert({
      event_type: eventType,
      payload: payload,
    });

    // Handle specific events
    if (eventType === "deauthorization" || eventType === "app_deauthorized") {
      const openId = payload.open_id; // Check actual payload structure based on TikTok docs
      if (openId) {
         // Assuming you can find the record by external_id or similar, but typically the platform_credentials stores auth.
         // Let's clear any credentials that match this openId or some identifier.
         await supabase
          .from("platform_credentials")
          .delete()
          .match({ platform_id: "tiktok", platform_user_id: openId });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    // TikTok requires 200 even on some errors, but let's return 200 to avoid retries if it's a parsing issue, or 500 if unexpected.
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

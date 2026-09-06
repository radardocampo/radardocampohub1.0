import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')

    if (!code) {
      return new Response(
        JSON.stringify({ error: "No code provided" }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY') || ''
    const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET') || ''
    const redirectUri = Deno.env.get('TIKTOK_REDIRECT_URI') || 'https://ziyuhenuuzetaedcneyb.supabase.co/functions/v1/auth-tiktok-callback'

    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })

    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache'
      },
      body: body.toString()
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('TikTok token error:', errorData)
      return new Response(
        JSON.stringify({ error: "Failed to get token from TikTok", details: errorData }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const tokenData = await tokenResponse.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const expiresIn = tokenData.expires_in || 86400
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    const { error: dbError } = await supabase
      .from('platform_credentials')
      .upsert({
        platform_id: 'tiktok',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'platform_id' })

    if (dbError) {
      console.error('DB Error:', dbError)
      return new Response(
        JSON.stringify({ error: "Failed to save tokens", details: dbError }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ message: "Autenticação com o TikTok concluída com sucesso! Os tokens foram salvos de forma segura." }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

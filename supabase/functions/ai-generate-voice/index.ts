import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { scene, sampleContext, voiceName, text } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "O campo text é obrigatório" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("Chave da API do Gemini não configurada.");
    }

    // Build the parts for the prompt
    const parts = [];
    if (scene) {
      parts.push({ text: `Scene: ${scene}` });
    }
    if (sampleContext) {
      parts.push({ text: `Context/Instructions: ${sampleContext}` });
    }
    parts.push({ text: `Text to read:\n${text}` });

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: parts,
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName || "Puck",
                },
              },
            },
          },
        }),
      },
    );

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Erro do Gemini:", geminiData);
      throw new Error(geminiData.error?.message || "Erro na API do Gemini");
    }

    // Extract audio base64
    const audioPart = geminiData.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { mimeType?: string; data?: string } }) =>
        p.inlineData && p.inlineData.mimeType?.startsWith("audio/"),
    );

    if (!audioPart || !audioPart.inlineData || !audioPart.inlineData.data) {
      console.error("Não foi retornado áudio na resposta:", geminiData);
      throw new Error("A API não retornou áudio.");
    }

    const audioBase64 = audioPart.inlineData.data;
    const mimeType = audioPart.inlineData.mimeType || "audio/wav";

    return new Response(JSON.stringify({ audioBase64, mimeType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Erro na função ai-generate-voice:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

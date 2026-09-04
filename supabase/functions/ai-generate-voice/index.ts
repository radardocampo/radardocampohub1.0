import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode, encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

function createWavHeader(
  dataLength: number,
  sampleRate: number,
  numChannels = 1,
  bitsPerSample = 16,
): Uint8Array {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  return new Uint8Array(buffer);
}

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiApiKey}`,
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

    const rawBase64 = audioPart.inlineData.data;
    const rawMimeType = audioPart.inlineData.mimeType || "";

    // Extract sample rate from mime type, eg: audio/L16;codec=pcm;rate=24000
    let sampleRate = 24000;
    const rateMatch = rawMimeType.match(/rate=(\d+)/);
    if (rateMatch && rateMatch[1]) {
      sampleRate = parseInt(rateMatch[1], 10);
    }

    // Decode base64 PCM data to Uint8Array
    const pcmData = decode(rawBase64);

    // Generate WAV header
    const wavHeader = createWavHeader(pcmData.length, sampleRate);

    // Combine header and PCM data
    const wavBuffer = new Uint8Array(wavHeader.length + pcmData.length);
    wavBuffer.set(wavHeader, 0);
    wavBuffer.set(pcmData, wavHeader.length);

    // Encode back to base64
    const audioBase64 = encode(wavBuffer);
    const mimeType = "audio/wav";

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

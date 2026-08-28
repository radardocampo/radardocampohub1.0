import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { description, platform } = await req.json();

    if (!description || !platform) {
      return new Response(
        JSON.stringify({ error: "Os campos description e platform são obrigatórios" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: topMetrics, error: metricsError } = await supabase
      .from("metrics_daily")
      .select("platform_id, engagement_rate, date, views")
      .order("engagement_rate", { ascending: false })
      .limit(10);

    if (metricsError) {
      console.error("Erro ao buscar métricas de referência:", metricsError);
      throw new Error("Falha ao buscar dados de referência.");
    }

    const referenceContext = topMetrics
      .map(
        (m) =>
          `- Plataforma: ${m.platform_id}, Taxa de Engajamento: ${m.engagement_rate}%, Views: ${m.views}`,
      )
      .join("\n");

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("Chave da API do Gemini não configurada.");
    }

    const promptText = `
Você é um especialista em marketing de conteúdo e SEO. Eu preciso de ideias de títulos e tags para um novo conteúdo.
Plataforma alvo: ${platform}
Descrição do conteúdo: ${description}

Aqui estão algumas métricas de conteúdos com alto engajamento no passado para servir de inspiração sobre o que funciona:
${referenceContext}

Gere exatamente:
1. 5 sugestões de títulos curtos, chamativos e otimizados para a plataforma especificada.
2. Uma lista de 10 a 15 tags/hashtags relevantes ao tema e à plataforma.

Responda em português. Formate a resposta de maneira limpa, separando os títulos das tags. Não inclua texto introdutório.
`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: promptText,
                },
              ],
            },
          ],
        }),
      },
    );

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Erro do Gemini:", geminiData);
      throw new Error("Erro na API do Gemini");
    }

    const aiResponseText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar sugestões.";

    const { error: insertError } = await supabase.from("ai_conversations").insert({
      mode: "titulos",
      user_message: `Plataforma: ${platform}\nDescrição: ${description}`,
      ai_response: aiResponseText,
    });

    if (insertError) {
      console.error("Erro ao salvar conversa:", insertError);
    }

    return new Response(JSON.stringify({ response: aiResponseText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

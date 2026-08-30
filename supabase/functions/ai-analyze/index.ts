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
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "O campo prompt é obrigatório" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateString = thirtyDaysAgo.toISOString().split("T")[0];

    const { data: metricsData, error: metricsError } = await supabase
      .from("metrics_daily")
      .select("platform_id, views, likes, engagement_rate, followers, date")
      .gte("date", dateString);

    if (metricsError) {
      console.error("Erro ao buscar métricas:", metricsError);
      throw new Error("Falha ao buscar dados de métricas.");
    }

    const { data: financeData, error: financeError } = await supabase
      .from("financial_entries")
      .select("platform_id, amount, date")
      .gte("date", dateString);

    if (financeError) {
      console.error("Erro ao buscar dados financeiros:", financeError);
      throw new Error("Falha ao buscar dados financeiros.");
    }

    // Processamento básico para o contexto
    let totalViews = 0;
    let totalLikes = 0;
    let totalRevenue = 0;

    metricsData.forEach((m) => {
      totalViews += Number(m.views) || 0;
      totalLikes += Number(m.likes) || 0;
    });

    financeData.forEach((f) => {
      totalRevenue += Number(f.amount) || 0;
    });

    const contextText = `
Dados dos últimos 30 dias:
- Visualizações Totais: ${totalViews}
- Curtidas Totais: ${totalLikes}
- Receita Total: R$ ${totalRevenue.toFixed(2)}
    `;

    const { data: promptSetting, error: promptError } = await supabase
      .from("ai_prompt_settings")
      .select("instruction")
      .eq("mode", "analise")
      .single();

    let systemPrompt =
      "Você é um assistente IA focado em análise de dados para um criador de conteúdo. Baseado apenas no seguinte contexto de dados de engajamento e financeiro dos últimos 30 dias, responda de forma objetiva, em português, à pergunta do usuário.";
    if (!promptError && promptSetting) {
      systemPrompt = promptSetting.instruction;
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("Chave da API do Gemini não configurada.");
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`,
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
                  text: `${systemPrompt}\n\nContexto dos dados:\n${contextText}\n\nPergunta do usuário: ${prompt}`,
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
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Não foi possível gerar uma resposta.";

    const { error: insertError } = await supabase.from("ai_conversations").insert({
      mode: "analise",
      user_message: prompt,
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

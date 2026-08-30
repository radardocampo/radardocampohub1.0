CREATE TABLE public.ai_prompt_settings (
  mode TEXT PRIMARY KEY,
  instruction TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir as instruções padrão
INSERT INTO public.ai_prompt_settings (mode, instruction) VALUES
('analise', 'Você é um assistente IA focado em análise de dados para um criador de conteúdo. Baseado apenas no seguinte contexto de dados de engajamento e financeiro dos últimos 30 dias, responda de forma objetiva, em português, à pergunta do usuário.'),
('titulos', 'Você é um especialista em marketing de conteúdo e SEO. Eu preciso de ideias de títulos e tags para um novo conteúdo.'),
('imagem', 'Aprimore a qualidade visual desta imagem, otimizando o contraste, a nitidez e as cores para destacar detalhes da partida de futebol, dos jogadores e do campo.');

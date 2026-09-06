import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Radar do Campo Hub" },
      {
        name: "description",
        content:
          "Política de privacidade do Radar do Campo Hub: uso interno de métricas de redes sociais e proteção de dados pessoais.",
      },
      { property: "og:title", content: "Política de Privacidade — Radar do Campo Hub" },
      {
        property: "og:description",
        content:
          "Política de privacidade do Radar do Campo Hub: uso interno de métricas de redes sociais e proteção de dados pessoais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <AppShell title="Política de Privacidade">
      <div className="prose prose-sm max-w-none text-foreground">
        <p className="text-muted-foreground">Última atualização: 4 de setembro de 2026.</p>

        <h2 className="mt-6 text-lg font-semibold">1. Dados coletados</h2>
        <p>
          O Radar do Campo Hub coleta métricas públicas das redes sociais conectadas (YouTube,
          TikTok, Instagram e outras), como número de seguidores, visualizações, curtidas,
          comentários e taxas de engajamento. Esses dados são obtidos por meio das APIs oficiais das
          plataformas e armazenados apenas para uso interno de gestão de conteúdo.
        </p>

        <h2 className="mt-6 text-lg font-semibold">2. Uso das informações</h2>
        <p>
          As métricas coletadas são utilizadas exclusivamente para análise de desempenho,
          planejamento editorial e acompanhamento de crescimento dos canais vinculados ao Radar do
          Campo. Não utilizamos esses dados para finalidades comerciais externas nem para
          perfilamento de usuários.
        </p>

        <h2 className="mt-6 text-lg font-semibold">3. Dados pessoais de terceiros</h2>
        <p>
          Não coletamos, processamos nem compartilhamos dados pessoais de terceiros (espectadores,
          seguidores ou comentaristas) fora do estritamente necessário para exibição das métricas
          agregadas disponibilizadas pelas próprias plataformas. Não vendemos dados a terceiros.
        </p>

        <h2 className="mt-6 text-lg font-semibold">4. Segurança</h2>
        <p>
          Adotamos medidas de segurança razoáveis para proteger as informações armazenadas contra
          acesso não autorizado, alteração ou exclusão. O acesso ao painel é restrito às pessoas
          autorizadas da equipe de gestão de conteúdo.
        </p>

        <h2 className="mt-6 text-lg font-semibold">5. Alterações nesta política</h2>
        <p>
          Podemos atualizar esta política periodicamente. Recomendamos revisar esta página
          ocasionalmente para estar ciente de eventuais mudanças.
        </p>

        <h2 className="mt-6 text-lg font-semibold">6. Contato</h2>
        <p>
          Em caso de dúvidas sobre esta política de privacidade ou sobre o tratamento de dados no
          Radar do Campo Hub, entre em contato pelo e-mail:{" "}
          <a
            href="mailto:radardocampo10@gmail.com"
            className="text-primary underline hover:text-primary/80"
          >
            radardocampo10@gmail.com
          </a>
          .
        </p>
      </div>
    </AppShell>
  );
}

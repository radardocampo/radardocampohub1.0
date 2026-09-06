import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Serviço — Radar do Campo Hub" },
      {
        name: "description",
        content: "Termos de Serviço do Radar do Campo Hub.",
      },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <AppShell title="Termos de Serviço">
      <div className="prose prose-sm max-w-none text-foreground">
        <h2 className="text-lg font-semibold mb-4">Termos de Serviço - Radar do Campo HUB</h2>
        <p>
          Estes Termos de Serviço regulam o uso do painel interno Radar do Campo HUB. O acesso a este sistema é estritamente restrito aos administradores e à equipe do canal.
        </p>
        <p className="mt-4">
          Os dados e métricas coletados por meio de APIs de plataformas parceiras (como YouTube e TikTok) são utilizados exclusivamente para fins de análise estatística interna e otimização de conteúdo. Garantimos que nenhuma informação sensível ou dado capturado será comercializado, exposto publicamente ou distribuído a terceiros sob nenhuma circunstância.
        </p>
      </div>
    </AppShell>
  );
}

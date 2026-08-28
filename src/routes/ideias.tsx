import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IDEA_STATUSES, MOCK_IDEAS, STATUS_LABEL, type IdeaStatus } from "@/lib/mock-data";
import { getPlatform } from "@/lib/platforms";

const STATUS_STYLE: Record<IdeaStatus, string> = {
  ideia: "bg-secondary text-muted-foreground",
  roteirizado: "bg-chart-2/15 text-chart-2",
  gravado: "bg-warning/15 text-warning",
  publicado: "bg-success/15 text-success",
};

export const Route = createFileRoute("/ideias")({
  head: () => ({
    meta: [
      { title: "Banco de Ideias — Radar do Campo Hub" },
      {
        name: "description",
        content:
          "Pipeline de ideias de conteúdo por status (ideia, roteirizado, gravado, publicado) e plataforma de destino.",
      },
      { property: "og:title", content: "Banco de Ideias — Radar do Campo Hub" },
      {
        property: "og:description",
        content:
          "Do insight à publicação: acompanhe cada ideia de conteúdo e sua plataforma de destino.",
      },
    ],
  }),
  component: IdeasPage,
});

function IdeasPage() {
  const [filter, setFilter] = useState<IdeaStatus | "todos">("todos");
  const ideas = filter === "todos" ? MOCK_IDEAS : MOCK_IDEAS.filter((i) => i.status === filter);

  return (
    <AppShell
      title="Banco de Ideias"
      subtitle="Pipeline de conteúdo, da ideia até a publicação."
      actions={
        <Badge className="bg-secondary text-secondary-foreground">{MOCK_IDEAS.length} ideias</Badge>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filter === "todos" ? "default" : "secondary"}
          onClick={() => setFilter("todos")}
        >
          Todos
        </Button>
        {IDEA_STATUSES.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={filter === status ? "default" : "secondary"}
            onClick={() => setFilter(status)}
          >
            {STATUS_LABEL[status]} ({MOCK_IDEAS.filter((i) => i.status === status).length})
          </Button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ideas.map((idea) => {
          const meta = getPlatform(idea.platform_id);
          const Icon = meta.icon;
          return (
            <article key={idea.id} className="panel flex flex-col p-5">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${meta.bgClass} ${meta.textClass}`}
                >
                  <Icon className="size-3.5" />
                  {meta.name}
                </span>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_STYLE[idea.status]}`}
                >
                  {STATUS_LABEL[idea.status]}
                </span>
              </div>
              <h2 className="mt-4 text-base font-semibold">{idea.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{idea.description}</p>
              <p className="mt-4 text-xs text-muted-foreground">
                Criada em {new Date(idea.created_at).toLocaleDateString("pt-BR")}
              </p>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}

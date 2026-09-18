import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { IDEA_STATUSES, MOCK_IDEAS, STATUS_LABEL, type IdeaStatus } from "@/lib/mock-data";
import { getPlatform } from "@/lib/platforms";

/**
 * O status é uma etapa do funil, então ele é lido como uma trilha: um ponto
 * colorido e o nome. Quatro pílulas preenchidas de cores diferentes fariam
 * cada card gritar mais alto que o título da ideia.
 */
const STATUS_DOT: Record<IdeaStatus, string> = {
  ideia: "bg-subtle",
  roteirizado: "bg-chart-2",
  gravado: "bg-warning",
  publicado: "bg-success",
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

  const filters: { value: IdeaStatus | "todos"; label: string; count: number }[] = [
    { value: "todos", label: "Todas", count: MOCK_IDEAS.length },
    ...IDEA_STATUSES.map((status) => ({
      value: status,
      label: STATUS_LABEL[status],
      count: MOCK_IDEAS.filter((i) => i.status === status).length,
    })),
  ];

  return (
    <AppShell
      title="Banco de Ideias"
      subtitle="Pipeline de conteúdo, da ideia até a publicação."
      actions={
        <span className="hidden text-sm tabular-nums text-muted-foreground sm:inline">
          {MOCK_IDEAS.length} ideias
        </span>
      }
    >
      <div
        role="group"
        aria-label="Filtrar por etapa"
        className="inline-flex flex-wrap gap-0.5 rounded-md border border-border bg-surface p-0.5"
      >
        {filters.map((item) => {
          const active = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              aria-pressed={active}
              className={`rounded-[0.3rem] px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
              <span className="ml-1.5 text-xs tabular-nums text-subtle">{item.count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ideas.map((idea) => {
          const meta = getPlatform(idea.platform_id);
          const Icon = meta.icon;
          return (
            <article key={idea.id} className="panel flex flex-col p-4">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="size-3.5" style={{ color: meta.color }} aria-hidden />
                  {meta.name}
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className={`size-1.5 rounded-full ${STATUS_DOT[idea.status]}`}
                    aria-hidden
                  />
                  {STATUS_LABEL[idea.status]}
                </span>
              </div>
              <h2 className="mt-3 text-sm font-semibold leading-snug">{idea.title}</h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                {idea.description}
              </p>
              <p className="mt-4 text-xs text-subtle">
                {new Date(idea.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </article>
          );
        })}
      </div>

      {ideas.length === 0 && (
        <p className="panel mt-6 px-5 py-10 text-center text-sm text-muted-foreground">
          Nenhuma ideia nessa etapa ainda.
        </p>
      )}
    </AppShell>
  );
}

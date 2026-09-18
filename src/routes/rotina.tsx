import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Repeat } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Checkbox } from "@/components/ui/checkbox";
import { MOCK_TASKS, type RoutineTask } from "@/lib/mock-data";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const Route = createFileRoute("/rotina")({
  head: () => ({
    meta: [
      { title: "Rotina diária — Radar do Campo Hub" },
      {
        name: "description",
        content:
          "Checklist diário de produção de conteúdo com tarefas recorrentes e marcação de concluído.",
      },
      { property: "og:title", content: "Rotina diária — Radar do Campo Hub" },
      {
        property: "og:description",
        content:
          "Organize gravações, publicações e conferência de métricas em um checklist recorrente.",
      },
    ],
  }),
  component: RoutinePage,
});

function RoutinePage() {
  const [tasks, setTasks] = useState<RoutineTask[]>(MOCK_TASKS);
  const done = tasks.filter((t) => t.completed).length;
  const pct = Math.round((done / tasks.length) * 100);

  const toggle = (id: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <AppShell title="Rotina" subtitle="Checklist do dia para manter o ritmo de publicação.">
      {/* Checklist é texto: largura de leitura em vez de esticar no monitor todo. */}
      <div className="max-w-3xl">
        <div className="panel p-5">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="stat text-3xl">
                {done}
                <span className="text-xl text-subtle">/{tasks.length}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pending.length === 0
                  ? "Tudo concluído por hoje."
                  : `${pending.length} ${pending.length === 1 ? "tarefa" : "tarefas"} em aberto.`}
              </p>
            </div>
            <p className="stat text-sm tabular-nums text-muted-foreground">{pct}%</p>
          </div>
          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso do dia"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {[
          { title: "Em aberto", items: pending },
          { title: "Concluídas", items: completed },
        ]
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <section key={group.title} className="mt-8">
              <h2 className="mb-2 text-sm font-medium text-subtle">
                {group.title} · {group.items.length}
              </h2>
              <ul className="panel divide-y divide-border">
                {group.items.map((task) => (
                  <li key={task.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-accent/40">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={() => toggle(task.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm leading-snug ${
                            task.completed ? "text-subtle line-through" : "text-foreground"
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                          {task.is_recurring ? (
                            <span className="inline-flex items-center gap-1">
                              <Repeat className="size-3" aria-hidden /> Recorrente
                            </span>
                          ) : (
                            <span>Pontual</span>
                          )}
                          {task.day_of_week.length > 0 && (
                            <span className="tabular-nums">
                              {task.day_of_week.length === 7
                                ? "Todos os dias"
                                : task.day_of_week.map((d) => WEEKDAYS[d]).join(" · ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </AppShell>
  );
}

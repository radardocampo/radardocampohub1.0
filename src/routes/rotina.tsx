import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Repeat } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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

  return (
    <AppShell
      title="Rotina"
      subtitle="Checklist do dia para manter o ritmo de publicação."
      actions={
        <Badge className="bg-secondary text-secondary-foreground">
          {done} de {tasks.length} concluídas
        </Badge>
      }
    >
      <div className="panel p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Progresso do dia
            </p>
            <p className="mt-2 font-display text-3xl font-semibold">{pct}%</p>
          </div>
          <p className="text-sm text-muted-foreground">{tasks.length - done} tarefas restantes</p>
        </div>
        <Progress value={pct} className="mt-4 h-2" />
      </div>

      <ul className="mt-6 space-y-3">
        {tasks.map((task) => (
          <li key={task.id} className="panel flex items-start gap-4 p-4">
            <Checkbox
              checked={task.completed}
              onCheckedChange={() => toggle(task.id)}
              className="mt-0.5"
              aria-label={task.title}
            />
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${task.completed ? "text-muted-foreground line-through" : ""}`}
              >
                {task.title}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {task.is_recurring ? (
                  <span className="flex items-center gap-1 rounded-md bg-primary/12 px-2 py-1 text-xs text-primary">
                    <Repeat className="size-3" /> Recorrente
                  </span>
                ) : (
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
                    Pontual
                  </span>
                )}
                {task.day_of_week.map((day) => (
                  <span
                    key={day}
                    className="rounded-md bg-surface-2 px-2 py-1 text-xs text-muted-foreground"
                  >
                    {WEEKDAYS[day]}
                  </span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

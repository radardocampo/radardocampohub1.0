import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  ListChecks,
  Lightbulb,
  Radar,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/metricas", label: "Métricas", icon: BarChart3 },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/rotina", label: "Rotina", icon: ListChecks },
  { to: "/ideias", label: "Banco de Ideias", icon: Lightbulb },
  { to: "/assistente", label: "Assistente IA", icon: Sparkles },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--sidebar-width)] flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Radar className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold text-sidebar-foreground">
              Radar do Campo
            </p>
            <p className="text-xs text-muted-foreground">Hub de conteúdo</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="px-5 py-5 text-xs text-muted-foreground">
          Dados demonstrativos — sincronização das APIs em breve.
        </p>
      </aside>

      <div className="md:ml-[var(--sidebar-width)]">
        <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 md:px-8">
            <div>
              <h1 className="text-2xl font-semibold">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            {actions}
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground"
                activeProps={{ className: "bg-secondary text-primary" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="px-5 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

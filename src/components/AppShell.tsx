import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  ListChecks,
  Lightbulb,
  Sparkles,
  LogOut,
  MessageCircle,
  Menu,
  X,
  Info,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

type NavItem = { to: string; label: string; icon: LucideIcon };

/**
 * Agrupado por intenção do dia: primeiro o que se acompanha, depois o que se
 * produz. Sete links soltos numa lista só não dizem nada sobre o fluxo.
 */
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Acompanhar",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/metricas", label: "Métricas", icon: BarChart3 },
      { to: "/financeiro", label: "Financeiro", icon: Wallet },
    ],
  },
  {
    title: "Produzir",
    items: [
      { to: "/rotina", label: "Rotina", icon: ListChecks },
      { to: "/ideias", label: "Banco de Ideias", icon: Lightbulb },
      { to: "/assistente", label: "Assistente IA", icon: Sparkles },
    ],
  },
  {
    title: "Comunidade",
    items: [{ to: "/comentarios", label: "Comentários", icon: MessageCircle }],
  },
];

const navLinkClass =
  "group relative flex items-center gap-3 rounded-md py-2 pl-3 pr-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

/** Marcador vertical à esquerda em vez de pílula preenchida: mais sóbrio. */
const navLinkActiveClass =
  "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-full before:bg-primary";

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.png" alt="" className="size-8 rounded-md object-contain" />
      <div className="leading-none">
        <p className="font-display text-sm font-semibold tracking-tight text-sidebar-foreground">
          Radar do Campo
        </p>
        <p className="mt-1 text-xs text-subtle">Hub de conteúdo</p>
      </div>
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  hideDemoWarning,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  hideDemoWarning?: boolean;
}) {
  const { session, user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate({ to: "/login" });
    }
  }, [session, isLoading, navigate]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          role="status"
          aria-label="Carregando"
          className="size-6 animate-spin rounded-full border-2 border-border border-t-primary"
        />
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const navList = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-2 text-[0.6875rem] font-medium tracking-[0.08em] text-subtle uppercase">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5 pl-3">
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                activeOptions={{ exact: item.to === "/" }}
                className={navLinkClass}
                activeProps={{ className: navLinkActiveClass }}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const accountFooter = (
    <div className="border-t border-sidebar-border pt-3">
      {!hideDemoWarning && (
        <p className="mb-3 flex items-start gap-2 px-1 text-xs leading-relaxed text-subtle">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Parte dos números ainda é demonstrativa — sincronização com as APIs em andamento.
        </p>
      )}
      <div className="flex items-center gap-2.5 px-1">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
          {(user?.email ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={user?.email}>
          {user?.email ?? "Conta"}
        </span>
        <button
          onClick={handleLogout}
          aria-label="Sair da conta"
          title="Sair da conta"
          className="rounded-md p-2 text-subtle transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--sidebar-width)] flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <div className="px-2 pb-7">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">{navList()}</div>
        {accountFooter}
      </aside>

      {/* Menu móvel: gaveta completa em vez de uma fila de links cortada. */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <div className="relative flex h-full w-[17rem] max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar px-3 py-5">
            <div className="flex items-center justify-between px-2 pb-7">
              <Brand />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar menu"
                className="rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{navList(() => setMenuOpen(false))}</div>
            {accountFooter}
          </div>
        </div>
      )}

      <div className="md:ml-[var(--sidebar-width)]">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 md:px-8 md:py-5">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              className="-ml-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 flex-1 basis-48">
              <h1 className="truncate text-xl font-semibold md:text-2xl">{title}</h1>
              {subtitle ? (
                <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">{subtitle}</p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
            ) : null}
          </div>
        </header>
        <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

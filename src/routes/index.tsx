import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CloudRain,
  Droplets,
  Leaf,
  Sprout,
  Sun,
  Thermometer,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wind,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radar do Campo — Painel de monitoramento agrícola" },
      {
        name: "description",
        content:
          "Acompanhe clima, umidade do solo, saúde das lavouras e preços de commodities dos seus talhões em um único painel.",
      },
      { property: "og:title", content: "Radar do Campo — Painel de monitoramento agrícola" },
      {
        property: "og:description",
        content:
          "Clima, umidade do solo, saúde das lavouras e cotações reunidos em um painel feito para a fazenda.",
      },
    ],
  }),
  component: Index,
});

const chuvaSolo = [
  { dia: "Seg", chuva: 4, umidade: 52 },
  { dia: "Ter", chuva: 12, umidade: 58 },
  { dia: "Qua", chuva: 0, umidade: 54 },
  { dia: "Qui", chuva: 22, umidade: 66 },
  { dia: "Sex", chuva: 8, umidade: 63 },
  { dia: "Sáb", chuva: 1, umidade: 59 },
  { dia: "Dom", chuva: 0, umidade: 55 },
];

const ndvi = [
  { mes: "Mar", indice: 0.42 },
  { mes: "Abr", indice: 0.51 },
  { mes: "Mai", indice: 0.63 },
  { mes: "Jun", indice: 0.71 },
  { mes: "Jul", indice: 0.78 },
  { mes: "Ago", indice: 0.74 },
];

const produtividade = [
  { talhao: "T-01", sacas: 62 },
  { talhao: "T-02", sacas: 58 },
  { talhao: "T-03", sacas: 71 },
  { talhao: "T-04", sacas: 49 },
  { talhao: "T-05", sacas: 66 },
];

const talhoes = [
  { nome: "Talhão T-01", cultura: "Soja", area: "184 ha", saude: 88, status: "Ideal" as const },
  { nome: "Talhão T-02", cultura: "Milho", area: "142 ha", saude: 74, status: "Atenção" as const },
  { nome: "Talhão T-03", cultura: "Soja", area: "210 ha", saude: 93, status: "Ideal" as const },
  { nome: "Talhão T-04", cultura: "Café", area: "96 ha", saude: 51, status: "Crítico" as const },
  { nome: "Talhão T-05", cultura: "Milho", area: "128 ha", saude: 81, status: "Ideal" as const },
];

const cotacoes = [
  { produto: "Soja (saca 60kg)", valor: "R$ 138,40", variacao: 1.8 },
  { produto: "Milho (saca 60kg)", valor: "R$ 72,10", variacao: -0.6 },
  { produto: "Café arábica (saca)", valor: "R$ 1.284,00", variacao: 3.2 },
  { produto: "Boi gordo (arroba)", valor: "R$ 318,50", variacao: 0.4 },
];

const alertas = [
  {
    titulo: "Janela de pulverização",
    detalhe: "Vento acima de 12 km/h previsto para amanhã no T-03.",
    nivel: "Atenção",
  },
  {
    titulo: "Déficit hídrico",
    detalhe: "Umidade do solo do T-04 abaixo de 35% há 3 dias.",
    nivel: "Crítico",
  },
  {
    titulo: "Geada improvável",
    detalhe: "Mínimas acima de 14 °C nos próximos 7 dias.",
    nivel: "Ok",
  },
];

const statusTone: Record<string, string> = {
  Ideal: "bg-success/15 text-success border-success/30",
  Atenção: "bg-warning/20 text-warning-foreground border-warning/40",
  Crítico: "bg-destructive/15 text-destructive border-destructive/30",
  Ok: "bg-success/15 text-success border-success/30",
};

function Metric({
  icon: Icon,
  rotulo,
  valor,
  nota,
  tendencia,
}: {
  icon: typeof Sun;
  rotulo: string;
  valor: string;
  nota: string;
  tendencia?: number;
}) {
  return (
    <Card className="shadow-soft transition-shadow hover:shadow-lift">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-xl bg-secondary p-2.5 text-primary">
            <Icon className="size-5" />
          </div>
          {typeof tendencia === "number" && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                tendencia >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {tendencia >= 0 ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {Math.abs(tendencia)}%
            </span>
          )}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{rotulo}</p>
        <p className="font-display text-3xl font-semibold tracking-tight">{valor}</p>
        <p className="mt-1 text-xs text-muted-foreground">{nota}</p>
      </CardContent>
    </Card>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="surface-field text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="rounded-xl bg-accent p-2 text-accent-foreground">
                  <Sprout className="size-5" />
                </span>
                <span className="font-display text-sm font-semibold uppercase tracking-[0.22em] opacity-90">
                  Radar do Campo
                </span>
              </div>
              <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-tight">
                Fazenda Santa Clara em tempo real
              </h1>
              <p className="mt-2 max-w-lg text-sm opacity-80">
                760 hectares monitorados · Última sincronização há 12 minutos
              </p>
            </div>
            <div className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-5 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-widest opacity-75">Agora na sede</p>
              <div className="mt-2 flex items-center gap-3">
                <Sun className="size-9 text-accent" />
                <span className="font-display text-4xl font-semibold">27°C</span>
              </div>
              <div className="mt-3 flex gap-4 text-xs opacity-85">
                <span className="inline-flex items-center gap-1.5">
                  <Droplets className="size-3.5" /> 61% UR
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Wind className="size-3.5" /> 9 km/h
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CloudRain className="size-3.5" /> 20%
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={Droplets}
            rotulo="Umidade média do solo"
            valor="58%"
            nota="Faixa ideal: 55–70%"
            tendencia={4.2}
          />
          <Metric
            icon={CloudRain}
            rotulo="Chuva acumulada (7d)"
            valor="47 mm"
            nota="Média histórica: 39 mm"
            tendencia={12.5}
          />
          <Metric
            icon={Leaf}
            rotulo="Índice de vigor (NDVI)"
            valor="0,74"
            nota="Queda leve no T-04"
            tendencia={-2.1}
          />
          <Metric
            icon={Thermometer}
            rotulo="Graus-dia acumulados"
            valor="1.284"
            nota="Colheita estimada: 22/out"
            tendencia={1.4}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="shadow-soft lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-display text-base">
                Chuva e umidade do solo · últimos 7 dias
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chuvaSolo} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gradChuva" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="gradSolo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="dia"
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      color: "var(--color-popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="umidade"
                    name="Umidade do solo (%)"
                    stroke="var(--color-chart-1)"
                    fill="url(#gradSolo)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="chuva"
                    name="Chuva (mm)"
                    stroke="var(--color-chart-3)"
                    fill="url(#gradChuva)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-base">Alertas do dia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alertas.map((a) => (
                <div key={a.titulo} className="rounded-xl border bg-muted/40 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{a.titulo}</p>
                    <Badge variant="outline" className={statusTone[a.nivel]}>
                      {a.nivel}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{a.detalhe}</p>
                </div>
              ))}
              <Separator />
              <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <TriangleAlert className="size-3.5 text-warning" />
                Alertas recalculados a cada 30 minutos.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-base">Vigor da lavoura (NDVI)</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ndvi} margin={{ left: -22, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="mes"
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                  />
                  <YAxis
                    domain={[0.3, 0.9]}
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="indice"
                    name="NDVI"
                    stroke="var(--color-chart-5)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-base">
                Produtividade estimada (sacas/ha)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={produtividade} margin={{ left: -22, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="talhao"
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="sacas" name="Sacas/ha" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-base">Cotações de hoje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {cotacoes.map((c) => (
                <div key={c.produto} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{c.produto}</p>
                    <p className="font-display text-lg font-semibold">{c.valor}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                      c.variacao >= 0
                        ? "bg-success/15 text-success"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {c.variacao >= 0 ? (
                      <TrendingUp className="size-3.5" />
                    ) : (
                      <TrendingDown className="size-3.5" />
                    )}
                    {Math.abs(c.variacao).toFixed(1)}%
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-base">Talhões monitorados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {talhoes.map((t) => (
                <div
                  key={t.nome}
                  className="grid items-center gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[1.3fr_1fr_1.4fr_auto]"
                >
                  <div>
                    <p className="text-sm font-semibold">{t.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.cultura} · {t.area}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">Saúde da cultura</p>
                  <div className="flex items-center gap-3">
                    <Progress value={t.saude} className="h-2" />
                    <span className="w-10 text-right text-sm font-semibold">{t.saude}%</span>
                  </div>
                  <Badge variant="outline" className={`justify-self-start ${statusTone[t.status]}`}>
                    {t.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-7xl px-6 py-6 text-xs text-muted-foreground">
          Radar do Campo · dados de demonstração para a Fazenda Santa Clara.
        </div>
      </footer>
    </div>
  );
}

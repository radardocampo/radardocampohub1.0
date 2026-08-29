import { CONTENT_PLATFORMS, MONETIZED_PLATFORMS, type PlatformId } from "./platforms";

/**
 * Dados fictícios determinísticos (sem Math.random) apenas para visualizar o layout.
 * A sincronização real com as APIs das plataformas será feita depois.
 */

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const hash = (text: string) =>
  text.split("").reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 100000, 7);

export type MetricPoint = {
  date: string;
  label: string;
  followers: number;
  views: number;
  likes: number;
  engagement_rate: number;
};

const BASE: Record<PlatformId, { followers: number; views: number; er: number }> = {
  youtube: { followers: 48200, views: 132000, er: 6.4 },
  tiktok: { followers: 96400, views: 410000, er: 9.1 },
  instagram: { followers: 31800, views: 88000, er: 5.2 },
  pinterest: { followers: 12400, views: 54000, er: 3.1 },
  threads: { followers: 8600, views: 21000, er: 4.4 },
  facebook: { followers: 22900, views: 61000, er: 2.8 },
  kwai: { followers: 15700, views: 73000, er: 7.3 },
  shopee: { followers: 0, views: 0, er: 0 },
};

export function buildMetricSeries(platformId: PlatformId, days: number): MetricPoint[] {
  const rand = seeded(hash(platformId) + days);
  const base = BASE[platformId];
  const today = new Date();
  const points: MetricPoint[] = [];
  let followers = Math.round(base.followers * (1 - days * 0.0022));

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const wave = 1 + Math.sin(i / 3) * 0.12;
    followers += Math.round(base.followers * 0.0022 * (0.6 + rand()));
    const views = Math.round((base.views / 30) * wave * (0.75 + rand() * 0.6));
    points.push({
      date: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      followers,
      views,
      likes: Math.round(views * (0.05 + rand() * 0.05)),
      engagement_rate: Number((base.er * (0.85 + rand() * 0.3)).toFixed(2)),
    });
  }
  return points;
}

export type PlatformSnapshot = {
  id: PlatformId;
  followers: number;
  followersDelta: number;
  views: number;
  likes: number;
  engagement_rate: number;
  series: MetricPoint[];
};

export function buildSnapshots(days = 30): PlatformSnapshot[] {
  return CONTENT_PLATFORMS.map((p) => {
    const series = buildMetricSeries(p.id, days);
    const first = series[0]!;
    const last = series[series.length - 1]!;
    return {
      id: p.id,
      followers: last.followers,
      followersDelta: Number(
        (((last.followers - first.followers) / first.followers) * 100).toFixed(1),
      ),
      views: series.reduce((sum, s) => sum + s.views, 0),
      likes: series.reduce((sum, s) => sum + s.likes, 0),
      engagement_rate: Number(
        (series.reduce((s, p2) => s + p2.engagement_rate, 0) / series.length).toFixed(2),
      ),
      series,
    };
  });
}

export type EarningRow = {
  date: string;
  label: string;
  platform_id: PlatformId;
  amount: number;
  source_type: string;
};

const EARN_BASE: Record<string, { avg: number; source: string }> = {
  youtube: { avg: 92, source: "AdSense" },
  tiktok: { avg: 48, source: "Creator Rewards" },
  shopee: { avg: 137, source: "Afiliados" },
};

export function buildEarnings(days = 14): EarningRow[] {
  const today = new Date();
  const rows: EarningRow[] = [];
  for (const p of MONETIZED_PLATFORMS) {
    const rand = seeded(hash(p.id) * 3 + days);
    const cfg = EARN_BASE[p.id]!;
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      rows.push({
        date: day.toISOString().slice(0, 10),
        label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        platform_id: p.id,
        amount: Number((cfg.avg * (0.5 + rand() * 1.1)).toFixed(2)),
        source_type: cfg.source,
      });
    }
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function earningsByDay(rows: EarningRow[]) {
  const map = new Map<string, Record<string, number | string>>();
  for (const row of rows) {
    const current = map.get(row.date) ?? { date: row.date, label: row.label };
    current[row.platform_id] = Number(
      ((current[row.platform_id] as number | undefined) ?? 0) + row.amount,
    );
    map.set(row.date, current);
  }
  return [...map.values()].sort((a, b) => ((a["date"] as string) > (b["date"] as string) ? 1 : -1));
}

export type RoutineTask = {
  id: string;
  title: string;
  is_recurring: boolean;
  day_of_week: number[];
  completed: boolean;
};

export const MOCK_TASKS: RoutineTask[] = [
  {
    id: "t1",
    title: "Conferir métricas do dia nas 7 plataformas",
    is_recurring: true,
    day_of_week: [1, 2, 3, 4, 5, 6, 0],
    completed: true,
  },
  {
    id: "t2",
    title: "Gravar 3 cortes verticais",
    is_recurring: true,
    day_of_week: [1, 3, 5],
    completed: true,
  },
  {
    id: "t3",
    title: "Publicar Short no YouTube",
    is_recurring: true,
    day_of_week: [1, 2, 3, 4, 5],
    completed: false,
  },
  {
    id: "t4",
    title: "Responder comentários fixados",
    is_recurring: true,
    day_of_week: [2, 4],
    completed: false,
  },
  {
    id: "t5",
    title: "Atualizar vitrine de afiliados da Shopee",
    is_recurring: true,
    day_of_week: [6],
    completed: false,
  },
  {
    id: "t6",
    title: "Roteirizar vídeo longo sobre plantio de soja",
    is_recurring: false,
    day_of_week: [],
    completed: false,
  },
];

export type IdeaStatus = "ideia" | "roteirizado" | "gravado" | "publicado";

export type ContentIdea = {
  id: string;
  title: string;
  description: string;
  platform_id: PlatformId;
  status: IdeaStatus;
  created_at: string;
};

export const MOCK_IDEAS: ContentIdea[] = [
  {
    id: "i1",
    title: "5 erros na calagem do solo",
    description: "Vídeo longo com agrônomo convidado e imagens de drone.",
    platform_id: "youtube",
    status: "roteirizado",
    created_at: "2026-08-18",
  },
  {
    id: "i2",
    title: "Trator antigo vs. trator novo",
    description: "Corte comparativo com áudio em alta na plataforma.",
    platform_id: "tiktok",
    status: "gravado",
    created_at: "2026-08-20",
  },
  {
    id: "i3",
    title: "Carrossel: preço da arroba semana a semana",
    description: "Dados de mercado em 6 cards.",
    platform_id: "instagram",
    status: "publicado",
    created_at: "2026-08-12",
  },
  {
    id: "i4",
    title: "Guia visual de irrigação por gotejamento",
    description: "Pins verticais com infográficos.",
    platform_id: "pinterest",
    status: "ideia",
    created_at: "2026-08-24",
  },
  {
    id: "i5",
    title: "Enquete sobre safra 2027",
    description: "Thread curta puxando debate.",
    platform_id: "threads",
    status: "ideia",
    created_at: "2026-08-25",
  },
  {
    id: "i6",
    title: "Live: dúvidas sobre financiamento rural",
    description: "Transmissão com recorte para Reels depois.",
    platform_id: "facebook",
    status: "roteirizado",
    created_at: "2026-08-22",
  },
  {
    id: "i7",
    title: "Bastidores da colheita às 5h",
    description: "Formato cru, vertical, sem edição pesada.",
    platform_id: "kwai",
    status: "gravado",
    created_at: "2026-08-23",
  },
  {
    id: "i8",
    title: "Review de botina de campo",
    description: "Vídeo com link de afiliado.",
    platform_id: "youtube",
    status: "ideia",
    created_at: "2026-08-26",
  },
];

export const IDEA_STATUSES: IdeaStatus[] = ["ideia", "roteirizado", "gravado", "publicado"];

export const STATUS_LABEL: Record<IdeaStatus, string> = {
  ideia: "Ideia",
  roteirizado: "Roteirizado",
  gravado: "Gravado",
  publicado: "Publicado",
};

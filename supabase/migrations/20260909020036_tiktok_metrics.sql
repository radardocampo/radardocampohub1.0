CREATE TABLE IF NOT EXISTS public.tiktok_videos (
    video_id TEXT PRIMARY KEY,
    title TEXT,
    cover_image_url TEXT,
    share_url TEXT,
    create_time TIMESTAMPTZ,
    duration INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tiktok_video_metrics_daily (
    video_id TEXT NOT NULL,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (video_id, date),
    CONSTRAINT fk_tiktok_video
      FOREIGN KEY(video_id) 
      REFERENCES tiktok_videos(video_id)
      ON DELETE CASCADE
);

-- Habilitar RLS
ALTER TABLE public.tiktok_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_video_metrics_daily ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Leitura para todos, escrita para service_role)
CREATE POLICY "Permitir leitura anon/autenticada em tiktok_videos"
ON public.tiktok_videos
FOR SELECT
USING (true);

CREATE POLICY "Permitir leitura anon/autenticada em tiktok_video_metrics_daily"
ON public.tiktok_video_metrics_daily
FOR SELECT
USING (true);

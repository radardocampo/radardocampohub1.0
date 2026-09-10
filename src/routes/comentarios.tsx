import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/platforms";
import { supabase } from "@/integrations/supabase/client";
import { getYoutubeComments, getLatestSyncLog } from "@/lib/youtube.functions";

export const Route = createFileRoute("/comentarios")({
  head: () => ({
    meta: [
      { title: "Comentários — Radar do Campo Hub" },
      {
        name: "description",
        content: "Veja e responda os comentários do seu canal do YouTube em um só lugar.",
      },
    ],
  }),
  component: CommentsPage,
});

function CommentsPage() {
  const [commentFilter, setCommentFilter] = useState<"all" | "unanswered">("unanswered");
  const [openReplyFor, setOpenReplyFor] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const fetchComments = useServerFn(getYoutubeComments);
  const fetchLatestSync = useServerFn(getLatestSyncLog);

  const commentsQuery = useQuery({
    queryKey: ["youtube-comments", commentFilter],
    queryFn: () => fetchComments({ data: { filter: commentFilter } }),
  });

  const syncLogQuery = useQuery({
    queryKey: ["sync-log", "youtube"],
    queryFn: () => fetchLatestSync({ data: { platform_id: "youtube" } }),
  });

  // --- Sync mutation: só comentários (leitura). A única ação de escrita no
  //     YouTube nesta página é a resposta (replyMutation), abaixo. ---
  const syncCommentsMutation = useMutation({
    mutationFn: async () => {
      const { error, data } = await supabase.functions.invoke("sync-youtube-comments", { method: "POST" });
      if (error) {
        let detail = error.message;
        const response = (error as { context?: Response }).context;
        if (response && typeof response.json === "function") {
          try { const body = await response.clone().json(); if (body?.error) detail = String(body.error); } catch {}
        }
        throw new Error(detail);
      }
      if (data && typeof data === "object" && "error" in data && data.error) {
        throw new Error(String((data as { error: unknown }).error));
      }
      return data;
    },
    onMutate: () => {
      toast.info("Sincronizando comentários...", { id: "sync-comments" });
    },
    onSuccess: async () => {
      toast.success("Comentários sincronizados!", { id: "sync-comments" });
      await queryClient.invalidateQueries({ queryKey: ["youtube-comments"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-log"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Falha ao sincronizar: ${message}`, { id: "sync-comments", duration: 8000 });
    },
  });

  // --- Reply mutation: posts a reply to a top-level comment (the only YouTube-write
  //     action here — see CLAUDE.md for why there's no delete/moderate/like action). ---
  const replyMutation = useMutation({
    mutationFn: async ({ commentId, text }: { commentId: string; text: string }) => {
      const { error, data } = await supabase.functions.invoke("reply-youtube-comment", {
        method: "POST",
        body: { comment_id: commentId, text },
      });
      if (error) {
        let detail = error.message;
        const response = (error as { context?: Response }).context;
        if (response && typeof response.json === "function") {
          try { const body = await response.clone().json(); if (body?.error) detail = String(body.error); } catch {}
        }
        throw new Error(detail);
      }
      if (data && typeof data === "object" && "error" in data && data.error) {
        throw new Error(String((data as { error: unknown }).error));
      }
      return { commentId, data };
    },
    onMutate: () => {
      toast.info("Publicando resposta...", { id: "reply-comment" });
    },
    onSuccess: async ({ commentId }) => {
      toast.success("Resposta publicada!", { id: "reply-comment" });
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
      setOpenReplyFor(null);
      await queryClient.invalidateQueries({ queryKey: ["youtube-comments"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Falha ao responder: ${message}`, { id: "reply-comment", duration: 8000 });
    },
  });

  return (
    <AppShell
      title="Comentários"
      subtitle="Comentários do seu canal do YouTube, em um só lugar."
      hideDemoWarning
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => syncCommentsMutation.mutate()}
                  disabled={syncCommentsMutation.isPending}
                  className="h-9 px-3 text-sm font-medium"
                >
                  <RefreshCw className={`mr-2 size-4 ${syncCommentsMutation.isPending ? "animate-spin" : ""}`} />
                  Sincronizar Comentários
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Busca os comentários mais recentes de todos os vídeos do canal (até 1000 por vez).
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
          {syncLogQuery.data && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">
              Última sync do canal: há {
                (() => {
                  const mins = Math.floor((new Date().getTime() - new Date(syncLogQuery.data.run_at).getTime()) / 60000);
                  if (mins < 60) return `${mins}m`;
                  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
                  return `${Math.floor(mins / 1440)}d`;
                })()
              }
              <span className={`flex items-center gap-1 font-medium ${
                syncLogQuery.data.status === 'success' ? 'text-success'
                : syncLogQuery.data.status === 'warning' ? 'text-warning'
                : 'text-destructive'
              }`}>
                · {syncLogQuery.data.status === 'success' ? 'sucesso' : syncLogQuery.data.status === 'warning' ? 'aviso' : 'erro'}
              </span>
            </div>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {(["unanswered", "all"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={commentFilter === f ? "default" : "ghost"}
              onClick={() => setCommentFilter(f)}
              className="px-4 text-sm font-medium"
            >
              {f === "unanswered" ? "Não respondidos" : "Todos"}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {commentsQuery.data
            ? `${commentsQuery.data.unansweredCount} sem resposta de ${commentsQuery.data.totalCount} no total`
            : "…"}
        </p>
      </div>

      {commentsQuery.isLoading ? (
        <div className="space-y-4 mt-8">
          <Skeleton className="h-[120px] w-full" />
          <Skeleton className="h-[120px] w-full" />
          <Skeleton className="h-[120px] w-full" />
        </div>
      ) : (commentsQuery.data?.comments.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-xl border-border bg-surface-1/50 my-8">
          <MessageCircle className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-semibold mb-2">
            {commentFilter === "unanswered" ? "Nenhum comentário pendente" : "Nenhum comentário encontrado"}
          </h3>
          <p className="text-muted-foreground max-w-sm">
            Clique em "Sincronizar Comentários" para buscar os comentários mais recentes do canal.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {commentsQuery.data!.comments.map((c) => {
            const isReplying = openReplyFor === c.comment_id;
            const draft = replyDrafts[c.comment_id] ?? "";
            return (
              <article key={c.comment_id} className="panel p-5">
                <div className="flex items-start gap-3">
                  <Avatar className="size-9 flex-shrink-0">
                    <AvatarImage src={c.author_profile_image_url} alt="" />
                    <AvatarFallback>{(c.author_display_name || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.author_display_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.published_at ? new Date(c.published_at).toLocaleDateString("pt-BR") : ""}
                      </span>
                      {c.has_owner_reply && (
                        <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">
                          Respondido
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm truncate max-w-[280px] text-muted-foreground" title={c.video_title}>
                      em: {c.video_title}
                    </p>
                    <p className="mt-2 text-base whitespace-pre-wrap break-words">{c.text_display}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatNumber(c.like_count)} curtidas</p>

                    {c.replies.length > 0 && (
                      <div className="mt-3 space-y-2 border-l-2 border-border/50 pl-4">
                        {c.replies.map((r) => (
                          <div key={r.reply_id}>
                            <span className="text-sm font-medium">
                              {r.author_display_name}{" "}
                              {r.is_owner && <span className="text-xs text-primary">(você)</span>}
                            </span>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                              {r.text_display}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {c.can_reply &&
                      (isReplying ? (
                        <div className="mt-3 flex flex-col gap-2">
                          <Textarea
                            value={draft}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({ ...prev, [c.comment_id]: e.target.value }))
                            }
                            placeholder="Escreva sua resposta..."
                            className="text-sm"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={!draft.trim() || replyMutation.isPending}
                              onClick={() =>
                                replyMutation.mutate({ commentId: c.comment_id, text: draft.trim() })
                              }
                            >
                              <Send className="mr-2 size-3.5" />
                              Enviar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setOpenReplyFor(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          onClick={() => setOpenReplyFor(c.comment_id)}
                        >
                          Responder
                        </Button>
                      ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

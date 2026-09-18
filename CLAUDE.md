# Regras do projeto — Radar do Campo HUB

## YouTube: escopos OAuth ampliados (desde 10/09/2026)

O `YOUTUBE_OAUTH_REFRESH_TOKEN` deste projeto foi gerado com escopos amplos da
conta dona do canal, incluindo (entre outros) `youtube.upload`,
`youtube.force-ssl`, `youtube.readonly`, `yt-analytics.readonly` e
`yt-analytics-monetary.readonly`. Isso significa que o backend TEM permissão
técnica para escrever/alterar dados do canal, não só ler métricas.

**Permitido:** usar essas APIs para construir funcionalidades de leitura
avançada de métricas, um painel para ler/responder comentários, e sistemas de
upload/agendamento de vídeos.

**PROIBIDO PERMANENTEMENTE, sem exceção:** nunca criar nenhuma Edge Function,
rota de API no Supabase, query/trigger no banco de dados ou botão/ação no
frontend que execute a **exclusão (delete)** de vídeos, playlists ou do
próprio canal do YouTube (ex.: chamadas aos endpoints `videos.delete`,
`playlists.delete`, `playlistItems.delete` para remover itens, ou qualquer
ação que apague o canal ou suas seções). Essa capacidade está vetada do
código deste projeto — mesmo que a credencial tenha o escopo técnico para
isso, o código nunca deve usá-la para excluir conteúdo do YouTube.

Se uma tarefa pedida algum dia esbarrar nessa regra (por exemplo, "limpar
vídeos antigos automaticamente"), pare e avise o usuário em vez de
implementar — não contorne a regra reinterpretando o pedido.

## 2024-05-15 - Melhoria de Acessibilidade em Botões de Alternância
**Learning:** Botões que servem como filtros ou abas (como a seleção de plataforma em src/routes/metricas.tsx) muitas vezes carecem de indicações claras de estado para leitores de tela. Adicionar `aria-pressed` dinâmico comunica imediatamente qual opção está ativa.
**Action:** Sempre que implementar um grupo de botões que funcionam como abas ou seletores (toggles), adicionar `aria-pressed={isActive}` e um `aria-label` descritivo se o conteúdo visual não for autoexplicativo.

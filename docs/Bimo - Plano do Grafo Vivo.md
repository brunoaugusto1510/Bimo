# Bimo — Plano do Grafo Vivo

Leva para o app o design do canvas "Bimo — grafo vivo"
(https://claude.ai/artifact/4uMiYuCvFuYdXD6e9EkhG5): o grafo vira um cérebro na aba Bimo
e mostra, enquanto o agente trabalha, por onde ele passa nas notas. Andamento e decisões
ficam aqui, não no CLAUDE.md. Branch: `feat/grafo-vivo`.

## Decisões (21/10/2026)

- **Duas formas, uma simulação.** A física continua sendo a de hoje (o "globo", aba Notas).
  O cérebro é um alvo calculado a partir dessas posições: cada nó vai para a vaga livre mais
  perto dentro da silhueta, então vizinhos continuam perto. Trocar de aba só interpola a
  posição desenhada; a simulação não muda e o layout não embaralha.
- **A silhueta é a da marca** (cérebro de perfil, virado para a esquerda: lobo frontal, sulco
  lateral, lobo temporal, cerebelo e tronco). No cérebro as ligações reais recuam e o
  contorno, os sulcos e a malha dos lobos assumem — são só desenho, não entram em
  `relacoes` nem no índice de ligações.
- **O rastro é ao vivo.** `/api/chat` passa a mandar os passos do agente conforme acontecem
  (NDJSON, quando o cliente pede `Accept: application/x-ndjson`); a resposta JSON de hoje
  continua para quem não pede. Cada passo leva os ids das notas tocadas: busca → notas
  encontradas, leitura → a nota lida, escrita → a nota criada/editada. Os ids são só para a
  interface: nunca voltam para o modelo.
- **A nota nova nasce onde ela realmente fica.** O nó só existe depois que a lista de notas
  atualiza; o nascimento (ondas, crescimento, ligações acendendo) toca quando o nó aparece,
  na posição dele, com as ligações reais.
- **Uma cor de ação.** Todos os estados do rastro usam o azul; mudam tamanho, anel, brilho e
  opacidade. O brilho usa `--destaque-texto` (mais claro no tema escuro). Movimento reduzido:
  troca de forma instantânea, sem pulsar, girar nem faísca.

## Fases

1. **Forma do cérebro** — `src/lib/forma-do-cerebro.ts`, puro e testado: silhueta, vagas
   (contorno, sulcos, miolo), atribuição nó → vaga, arestas do desenho, atraso da varredura.
   Funciona de 1 a 800 nós.
2. **Rastro do agente** — `src/lib/rastro-do-agente.ts`, puro e testado: eventos (busca,
   leitura, escrita, fim) → estado de cada nota num instante (candidata, vista, lendo, lida,
   escrevendo, citada, nova), segmentos do caminho e escurecimento do resto.
3. **Servidor** — `SaidaFerramenta.ids` (só UI), `responder(..., aoPasso)`, `/api/chat` em
   NDJSON sob pedido. Testes da rota nos dois formatos.
4. **Cliente do chat** — `Chat` lê o fluxo, mostra o passo atual no `BimoPensando` e repassa
   os eventos; `PaginaPrincipal` guarda o rastro da conversa atual.
5. **Desenho** — `GrafoDeFundo` interpola globo ↔ cérebro e passa o rastro;
   `desenhar-grafo` desenha contorno/sulcos/malha, brilho, anéis, faísca, ondas e rótulos.
   Cliques no modo fundo acertam a posição desenhada.

## Andamento

- [x] Fase 1 — `forma-do-cerebro.ts` (40 testes). Cerca de 120 ms para 800 nós, só quando o
  layout é refeito. Arestas da malha nunca cruzam a silhueta (mais estrito que o protótipo).
- [x] Fase 2 — `rastro-do-agente.ts` (44 testes). O escurecimento começa no primeiro passo;
  uma busca posterior não rebaixa uma nota já lida ou escrita.
- [x] Fase 3 — `ferramentas.ts` (`ids` só para a UI), `responder(..., { aoPasso })`, `/api/chat`
  em NDJSON sob `Accept: application/x-ndjson`. Erros antes do fluxo continuam JSON com status.
  Se o cliente desconecta, o agente termina a volta e os passos restantes são descartados.
- [x] Fase 4 — `fluxo-do-chat.ts` (leitura do NDJSON e passo → evento do rastro), `Chat` mostra o
  passo atual no `BimoPensando`, `PaginaPrincipal` guarda o rastro da pergunta atual.
- [x] Fase 5 — `GrafoDeFundo` interpola globo ↔ cérebro (câmera acompanha a troca nos dois
  sentidos) e desenha o rastro (`desenhar-rastro.ts`). Peças puras e testadas:
  `morfose-do-grafo`, `cerebro-do-layout` (reaproveita a forma quando o layout não mudou e só
  recalcula ao voltar para a aba Bimo), `caminho-memoizado` (caminhos e o quadro final em cache),
  `criacoes-do-rastro`, `geometria-dos-nos`, `cores-do-canvas`. O clique acerta a posição
  desenhada (com a respiração). A nota nova nasce quando o nó aparece no layout.
- [x] Revisões — ECC (`code-reviewer`, `react-reviewer`) e Codex nas fases 1–4 e na 5: nenhum
  achado crítico; os altos e médios foram corrigidos (câmera ao entrar em Notas, movimento
  reduzido, nascimento, clique, caminho com nota apagada, custo por quadro, escrita avisada já
  no passo do agente).
- [x] Tela principal do protótipo (21/10/2026) — na aba Bimo a conversa fica embaixo e o
  cérebro é enquadrado na parte de cima (`reservaInferior` no `GrafoDeFundo`). A vez do Bimo
  mostra a marca, os passos como pílulas (ao vivo, com o BimoPensando), a resposta e, embaixo,
  "Abrir" para cada nota escrita e as "Fontes" (notas lidas), que acendem a nota no cérebro
  (`realce-no-grafo.ts`). A barra lateral marca as notas do rastro e a aba Notas mostra o
  resumo do último rastro (`rastro-na-interface.ts`). Se o fluxo cai depois de uma escrita, a
  conversa guarda os passos e o "Abrir". Revisões ECC e Codex: nenhum achado alto; os médios
  foram corrigidos.
- [x] Conferência visual no app: pergunta real com 383 notas — pílulas, fonte, bolinha na
  lista, rótulo no cérebro e resumo na aba Notas conferidos.

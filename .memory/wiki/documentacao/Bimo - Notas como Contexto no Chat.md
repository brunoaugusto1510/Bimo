# Bimo — Notas como contexto no chat

Implementação local em 12/11/2026, sem commit ou publicação. **Atualização às 16h15: migração 0014 aplicada no Supabase real após autorização explícita do usuário.** Os ensaios isolados abaixo precedem essa aplicação.

## Experiência escolhida

Pílulas acima do campo de mensagem, com título, pasta, abertura por ID e remoção individual. O seletor permite buscar título/pasta sem acentos e conteúdo pela busca existente; mostra notas abertas primeiro, seleção múltipla e contador até dez. Não carrega itens da lixeira na lista. Em telas pequenas as pílulas quebram linha e sua área pode rolar.

```text
Contexto desta conversa
[Planejamento · Projeto ×] [Ideias ×] [+ Adicionar notas]
[Compare as ideias com o planejamento…                 Enviar]
As notas permanecem até você removê-las.
```

- A seleção permanece após enviar e é restaurada ao abrir a conversa, inclusive remoções feitas depois do último pedido. Anexar antes da primeira mensagem já cria uma conversa chamada “Nova conversa”; a primeira pergunta define seu título.
- “Perguntar ao Bimo” na nota/grafo anexa sem duplicar e foca o campo, preservando o rascunho, sem enviar nem escrever uma pergunta automática.
- Novo chat limpa seleção/rascunho. Bimo e Notas mantêm a árvore estável de Chat/GrafoDeFundo.
- Seleção bloqueada durante resposta ou abertura de histórico. Notas indisponíveis bloqueiam envio até remover/restaurar; o servidor reconfere cada pedido.
- Apenas a última versão salva participa. Remover afeta os próximos pedidos; mensagens antigas continuam disponíveis.

## Contratos e persistência

- `POST /api/chat` aceita `notasDeContexto?: IdDeNota[]`. IDs opacos, máximo dez; sem a propriedade mantém o contrato anterior. Entrada inválida retorna 400, indisponível 409 (com `indisponiveis`), contexto acima de 60.000 caracteres JSON retorna 413. Nenhuma nota é truncada ou ignorada silenciosamente.
- `carregarContextoDeNotas` usa o repositório autorizado para ler cada ID. Serializa título/caminho, conteúdo integral e revisão. Esse material entra em mensagem de referência antes da pergunta atual, separado das instruções do sistema. O agente prioriza anexos e pode complementar com outras notas.
- Não preencher o mapa de revisões de escrita com anexos: substituir por `editar_nota` continua exigindo `ler_nota` no mesmo `responder`.
- NDJSON emite `{ tipo: "contexto", anexos }` antes de ferramentas/modelo e repete o recibo no resultado final; JSON inclui `anexos` no resultado. Cada recibo guarda ID, título, pasta e revisão, sem conteúdo.
- O cliente só persiste os anexos do pedido após receber o recibo do servidor. Une-os às fontes da resposta por ID e ao rastro do grafo. O histórico mostra os títulos/revisões que acompanharam a pergunta.
- `PATCH /api/conversas/[id]` recebe `{ notasDeContexto: IdDeNota[] }`, cria a conversa se necessário e responde 204. `GET` devolve a seleção; clientes antigos assumem vazio quando ausente.
- Migração aditiva `drizzle/0014_notas_de_contexto.sql`: `conversas.notas_de_contexto` JSONB com padrão `[]` não nulo e `mensagens_de_conversa.anexos` JSONB nullable. Snapshot/journal gerados com Drizzle, URL fictícia local, sem conectar ao banco.
- Repositórios de memória e banco cumprem o mesmo contrato. Cada leitura/atualização filtra o dono; RLS existente permanece habilitada. Novas escritas exigem sessão, mesma origem, JSON limitado e Zod.
- A fila serializa seleção e mensagens. Mensagens pendentes ficam na memória até a confirmação e são repetidas na ordem, usando os mesmos IDs; falhar a pergunta não permite guardar sua resposta antes dela. O botão de repetir mantém a idempotência.
- Recusa do contexto devolve texto/anexos ao campo. Falha posterior preserva o recibo e ações já concluídas; não repetir automaticamente ações do agente. Avisos de gravação não desaparecem só porque uma gravação posterior deu certo.

## Verificação

- Regressão offline: 188 arquivos / 2.230 testes; 2.228 passaram na rodada completa. Duas falhas vieram da presença de um alerta vazio de organização de notas, em alteração simultânea no componente pai. O papel do alerta passou a existir apenas com erro fora do diálogo; repetição das três suítes envolvidas: 15/15.
- Rodada focada: 14 arquivos / 171 testes aprovados, incluindo componentes, rotas, agente, parser e persistência.
- Após refinar a fila e acrescentar a regressão de pergunta/resposta: cinco arquivos / 36 testes aprovados. Validada também a atualização de conteúdo e revisão entre pedidos.
- Migração 0012 seguida da 0014 aplicada em Postgres PGlite em memória. Validada conversa anterior à migração, seleção vazia, gravação de recibos, remoção posterior, título da primeira pergunta e isolamento de donos. Nenhum teste usou o Supabase real.
- Tipagem global e lint de src/scripts passaram; verificações finais dos arquivos alterados também. Avisos conhecidos de act/NaN de jsdom aparecem em suítes antigas.
- Revisão no Chrome de cópia temporária sem arquivos .env, com sete notas fictícias, repositórios em memória e credenciais descartáveis. Desktop 1440×1024 e mobile 390×844, temas claro/escuro; seleção múltipla, pasta em títulos iguais, gravação real da seleção nas rotas locais e preservação do pedido diante de 503 por ausência deliberada de chave.
- Em 390 px: largura da página 390 px, campo dentro da tela e ações de remoção com 40×40 px. Nenhum erro no console antes do ensaio deliberado de 503. Provedor OpenAI real não foi chamado.

## Publicação e limites

**Migração 0014 aplicada em 12/11/2026 às 16h15 no banco Bimo (`gibqmmbukwtucylxpuag`).** Pré-verificação: 15 registros Drizzle, última 0013 com hash esperado e colunas novas ausentes. Aplicação pelo conector Supabase, em bloco atômico com bloqueio do histórico e conferência de pré-condições; registro do hash `92d3bb8b8f903c2d2a0d049cf0963534ea9b326c294aa2254edcbc39319b5fef` e timestamp `1794509197779` no histórico Drizzle, agora com 16 registros. Apenas a 0014 foi executada; nenhuma migração antiga reaplicada.

Pós-verificação por SELECT: `conversas.notas_de_contexto` JSONB NOT NULL com padrão `[]`, `mensagens_de_conversa.anexos` JSONB nullable; RLS ativa nas duas tabelas. Todas as seleções existentes vazias e recibos nulos após a aplicação. Nenhuma nota ou mensagem criada/editada/apagada para validar; nenhum deploy realizado.

As seleções salvas sobrevivem a recarga via histórico; não há recuperação offline durável adicional. A confirmação de uso é o recibo das versões fornecidas ao modelo, não uma garantia de que cada trecho foi citado na resposta. O teto global de contexto do agente continua valendo.

Fora desta versão: `@`, arrastar para o chat, pastas inteiras, trechos selecionados e “usar somente estas notas”.

Conferência final das rotas e do filtro por dono: 49/49 testes em dois arquivos aprovados após os últimos ajustes. Servidor temporário de QA encerrado; servidor original preservado.

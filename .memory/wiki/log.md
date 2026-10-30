# Work Log

*Append-only changelog. Agents must append a timestamped summary of their work here at the end of each session.*

## Initial Setup
- Project memory initialized via MemWiki.

## 2026-10-26T13:44:37-03:00 — Migração da documentação para a MemWiki

- Escopo confirmado: todos os documentos da pasta `docs/`.
- Migrados 25 arquivos para `.memory/wiki/documentacao/`, preservando nomes, conteúdo e subpastas.
- Ajustadas 40 referências locais após a mudança, incluindo README e CLAUDE, e corrigida a referência antiga de `extracao.ts` para a fachada `extracao/index.ts`.
- Índice com acesso direto aos 25 documentos, contexto inicial atualizado e decisão da migração registrada. As datas e os limites de verificação dos relatórios foram preservados.
- Verificação documental: contagem dos arquivos, conteúdo preservado com alterações restritas aos caminhos, resolução dos links locais e checagem de espaços do diff. Sem nova avaliação do aplicativo ou de produção nesta migração.

## 2026-10-26T14:11:30-03:00 — memwiki-ingest e memwiki-lint

- Inventariadas as árvores próprias do repositório e lidos contratos/módulos representativos de notas, autenticação, agente, ingestão, Wiki Viva, interface, grafo, mobile e testes, além de manifestos e configurações.
- Preenchidas stack, padrões, decisões e problemas; criadas cinco páginas de domínio, sem modificar o código do aplicativo.
- Atualizados índice e contexto inicial. Os 25 documentos migrados permaneceram preservados, com seus contextos e datas.
- Lint verificou links, páginas vazias, alcance a partir do índice e contexto. Exemplos em trechos de código são excluídos da checagem de wikilinks.
- Registrada divergência entre os limites do chat descritos no README e os observados no agente. A correção documental permanece proposta; não houve mudança dos limites nesta execução.
- Resultado e limites em `verificacoes/2026-10-26-ingest-lint.md`. Sem acesso a produção, leitura de valores de `.env`, modelos, testes do aplicativo, migrações, commit ou push.

## 2026-10-26T16:30:00-03:00 — Telas da Wiki Viva fiéis ao design

- Comparadas as telas implementadas (cérebro, diário, neurônio aberto e o desenho dos neurônios no grafo) com as pranchetas do artifact "Bimo — Wiki Viva: conceitos e telas", inclusive tema escuro e celular.
- Reescritas `PainelDaWiki` (agora só busca dados e delega), `CerebroDaWiki`, `DiarioDaWiki`, `NeuronioAberto`, `GlifoDoNeuronio`, `estilos.ts` e `filtro-do-cerebro.ts`; ajustada a ligação em `PaginaPrincipal`. Um subagente refez o glifo e os estados dos neurônios no canvas (`desenhar-neuronio.ts`) e acrescentou `neuroniosVisiveis` ao `GrafoDeFundo`.
- Removido o modo `comPainelWiki` do grafo; a câmera enquadra o resultado de cada filtro do cérebro.
- Verificação: suíte offline com 172 arquivos e 2.079 testes passando, `tsc --noEmit` e `eslint src` sem erros, conferência visual no navegador embutido com dados reais (claro, escuro, 375 px). Sem commit.
- Revisão independente (ECC react-reviewer) e correções: seleção escondida pelo filtro deixa de focar o grafo (teste `cerebro-na-pagina.test.tsx`), primeiro neurônio descoberto com o cérebro aberto, "Ver origens" só sem filtro, pílula da fila estática no lugar de `BimoPensando`, folhas do celular com altura máxima e rolagem, foco devolvido à citação e região `aria-live` na folha da sinapse, foco correto ao trocar Cérebro/Diário, chips Cérebro/Diário alternam, aviso para filtro sem resultado, câmera sem reenquadrar na consulta de 30 s, página anterior do diário mantida ao paginar. Suíte offline: 173 arquivos, 2.081 testes passando; `tsc` e `eslint src` limpos.

## 2026-10-26T17:37:18-03:00 — Auditoria da estrutura da Wiki Viva vs LLM Wiki (lint)

- **Escopo:** auditoria somente de leitura, na branch `fix/revisao-geral-wiki-viva`, HEAD `e90ee94`.
- **Checklist:** C1–C16, extraído da referência LLM Wiki. O gist do Karpathy foi conferido para fontes imutáveis, retorno de respostas, itens do lint, índice e prefixo do log.
- **Camada A** (funcionalidade do app):
  - `code-explorer` mapeou a feature e `database-reviewer` revisou o esquema.
  - As linhas centrais foram relidas no código.
- **Camada B** (MemWiki):
  - Lint por script: 39 páginas, 256 links locais, 0 quebrados, 0 órfãs, todas com link direto no índice.
  - `git log` e `git show` apontaram hot desatualizado e o commit `623f121` sem hot e log.
- **Julgamento** (`architect`): nenhum CRITICAL; um HIGH na camada A, nota do chat como raiz sem autoria; contradição sobre a 0011 entre o Plano de Notas no Banco e a revisão geral.
- **Gravado:**
  - Relatório em `documentacao/Bimo - Auditoria da Estrutura da Wiki Viva vs LLM Wiki - 2026-10-26.md`.
  - Link no índice.
  - Hot com o estado atual acrescentado e as linhas antigas anotadas, sem apagar conteúdo.
- **Não houve:**
  - alteração em `src/`, testes, migrações ou configuração;
  - leitura de `.env`, execução de testes, acesso a produção ou implementação das recomendações.
- **Pendente:** um `bash.exe.stackdump` criado por esta sessão em `.memory/`, ignorado pelo git. A remoção não foi autorizada.

## 2026-10-26T20:25:00-03:00 — Wiki Viva em rede (política `rede-v5`)

- **Decisão do usuário:** aceitar o HIGH da auditoria (nota do chat como raiz) e implementar as recomendações sem conservadorismo, perto do LLM Wiki. Registrada em `decisions.md`.
- **TDD:** `src/lib/wiki/rede.test.ts` escrito antes do código (11 falhas pelo motivo certo). Hoje tem 19 testes.
- **Código**, na branch `feat/wiki-viva-em-rede`:
  - política e prompt;
  - esquema da proposta com `resumo` e `proposta:N`;
  - ligação recíproca entre irmãs;
  - `conceitos()` com resumo e ligações;
  - índice com resumo e vizinhos na recuperação;
  - consulta com `relacionados` e a ferramenta `indice_da_wiki`;
  - lint `isolado` com releitura limitada;
  - teto de saída da descoberta.
  - Sem migração.
- **Testes antigos ajustados:**
  - versão `rede-v5`;
  - tetos de 16 ligações, 250 entradas e 8 candidatas;
  - seis ferramentas;
  - consulta que exclui neurônio sem raízes;
  - jornada passo 8, que agora verifica "nada apagado ou trocado".
- **Revisões independentes** (`code-reviewer` do ECC e Codex), com achados aplicados:
  - teto de 4.096 tokens de saída insuficiente;
  - marca de releitura perdida na republicação;
  - reciprocidade com vaga nas duas pontas;
  - raízes conferidas no índice e nos relacionados;
  - termos de 3 letras;
  - republicação sem efeito;
  - corte do contexto.
- **Verificação:** `tsc` e `eslint src scripts` limpos; 2.100 testes offline (174 arquivos), excluindo `repositorio-de-notas/banco.test.ts` e `tests/busca-textual.integration.test.ts`.
  - Uma execução anterior incluiu `src/lib/tests` inteiro e pode ter rodado a suíte de integração contra o Supabase (ela usa usuários efêmeros).
  - Sem modelo real, produção, commit ou push.

## 2026-10-27 — Commit da Wiki Viva em rede

- A pedido do usuário, a branch `feat/wiki-viva-em-rede` foi commitada com código, testes e MemWiki da política `rede-v5`.
- O ponteiro `.claude/worktrees/login-multiusuario` ficou fora do commit.
- Sem push, PR, modelo real ou produção.

## [2026-10-27] ingest | LLM Wiki (texto do padrão)

- Fonte: `.memory/.raw/llm-wiki.md` (11.985 bytes), primeira fonte bruta da MemWiki. Lida, não alterada.
- Criada [fonte: LLM Wiki](fontes/llm-wiki-karpathy.md): resumo, conferência com a referência de 23/10 e o checklist C1–C16 da auditoria (sem contradições), e seis pontos da fonte não cobertos antes (F1–F6).
- Atualizados `index.md` (seção "Fontes brutas ingeridas"), `dominios/wiki-viva.md` e `hot.md`.
- Esta é a primeira entrada com o prefixo `## [data] operação | título` sugerido pela fonte; as anteriores ficam como estão.
- Sem código, testes, commit ou push. `.raw/` segue fora do git.

## [2026-10-27] desenho | Tensão entre neurônios (lacuna 8)

- A pedido do usuário, desenho antes de codar: [documentação](documentacao/Bimo%20-%20Desenho%20da%20Tensao%20entre%20Neuronios.md).
- Lido no código: divergência hoje só existe dentro de um neurônio (`automacao.ts:381-413`); o chat não recebe divergências (`consulta.ts`).
- Proposta: `estrutura.tensoes` no neurônio que registra, outro lado derivado na leitura, sem escrever no outro neurônio e sem migração; tensão implica ligação; política `rede-v6`; chat passa a receber divergências e tensões.
- Decisões pedidas ao usuário: guardar só de um lado; detectar só na descoberta (sem lint pago); ligação automática; política `rede-v6`.
- Sem código, testes ou commit.

## [2026-10-27T10:28:57-03:00] planejamento | Sistema de memória do aplicativo com ECC

- Criado o [plano completo do sistema de memória](documentacao/Bimo%20-%20Plano%20do%20Sistema%20de%20Memoria.md), revisão 1, proposto sobre `feat/wiki-viva-em-rede`, HEAD `e5d6394`.
- Aplicados os critérios do ECC `intent-driven-development`, alternativas arquiteturais, migrações do ECC `database-migrations` e autoavaliação do documento. Consultadas novamente referências oficiais da OpenAI e de RLS do Supabase, sem operar os serviços.
- Plano: quatro camadas funcionais, dados e contratos, turnos idempotentes e recibos transacionais, recuperação progressiva, extração/consolidação, correção/expiração/esquecimento, retenção, orçamento, segurança, interface, fases F0–F8, AC-001–030 e decisões abertas D-01–D-08.
- Recomenda manter Responses API e dados no banco do Bimo, integrados ao conhecimento da Wiki Viva `rede-v5`. Primeira entrega utilizável com histórico e memória explícita; captura automática e compactação em etapas posteriores. Nenhuma recomendação foi registrada como aprovação de implementação.
- Atualizados índice, hot, decisões e domínio de agente. Preservados registros anteriores e a tarefa estacionada de tensões.
- Verificação documental: contagem de critérios/fases/decisões, links locais, whitespace e `git diff --check`; nenhuma falha na primeira passagem (111 links em cinco páginas, antes de acrescentar esta entrada).
- Sem alterações em código, dependências, migrações ou `.raw/`; sem leitura de `.env`, testes de software, modelo pago, banco remoto, commit ou push. O ponteiro preexistente `.claude/worktrees/login-multiusuario` permanece fora do escopo.

## [2026-10-27] brainstorm | Modos de consolidação e energia vs LLM Wiki

- A pedido do usuário, comparados os seis perfis do [documento de modos](documentacao/Bimo%20-%20Modos%20de%20Consolidacao%20e%20Energia.md) com o texto do padrão em `.raw/` (ingestão, lint, consulta). Os perfis misturam três eixos: quando, escopo e estado.
- Decisões do usuário: padrão contínuo; o lint divide o orçamento diário com chat e ingestão; autonomia ("publicar direto" ou "propor antes de publicar") como configuração da pessoa, com publicação direta por padrão.
- Registrado no documento de modos (nova seção), em `decisions.md`, no índice e no hot. Ordem de prioridade dentro do orçamento e gatilho do lint ficaram como sugestões não aceitas.
- Só MemWiki; sem código, testes, modelo pago, banco remoto, commit ou push. Leitura do estado atual (Cron, 90 s, 200 mil tokens) vem da documentação, sem verificação de produção.

## [2026-10-29T09:17:28-03:00] diagnóstico | Leitura de neurônios pelo agente do chat

- Pergunta do usuário: se o agente está lendo neurônios. Conferidos agente, instruções, ferramentas e consulta da Wiki em `main`, HEAD `9a50857`.
- Confirmados os caminhos: contexto automático da Wiki ao executar `buscar_notas` (até quatro neurônios e seis vizinhos), navegação com `indice_da_wiki` e leitura completa com `ler_nota`. Síntese na busca limitada a 4.000 caracteres e condicionada ao estado atualizado.
- O laço não força consulta antes da resposta; o recibo visível de busca não discrimina o contexto adicional da Wiki. Sem evidência de uma conversa específica ou produção.
- Atualizados hot e domínio do agente. Sem alteração de código, teste de software, `.env`, banco remoto, modelo pago, commit ou push. Preservado o ponteiro preexistente `.claude/worktrees/login-multiusuario`.

## [2026-10-29] análise | Consulta LLM Wiki no exemplo blockchain/tokenização

- Lido o print do usuário e o texto local imutável `.memory/.raw/llm-wiki.md`; consultados o gist primário e a documentação PostgreSQL sobre `websearch_to_tsquery`.
- O padrão descreve consulta começando pelo índice e leitura das páginas relevantes; sugerida adaptação priorizando os neurônios e usando as origens para evidências/detalhes. Nenhuma implementação autorizada ou realizada.
- Busca normal exige os termos juntos (AND), possível explicação para o zero do print. Ausência de passo de índice confirmada apenas no print; contexto adicional da Wiki e estado real dos neurônios não verificados.
- Atualizados hot e domínio. Sem testes, banco remoto, chamada de modelo, mudança no aplicativo, commit ou push.

## [2026-10-29T10:46:07-03:00] implementação | Busca do chat por assuntos e índice de neurônios

- Autorização direta do usuário após discutir o zero da consulta composta e a prioridade da Wiki. Mantido o contrato dos repositórios; mudanças concentradas nas ferramentas do agente, novo módulo de busca e instruções.
- Consultas adicionais limitadas a quatro, ampliação limitada de buscas simples vazias, resultados deduplicados/intercalados e transparência sobre correspondência parcial. Índice relevante acompanha a busca mesmo com zero notas; filtro inclui aliases e recibo informa neurônios.
- RED: 14 falhas e 5 testes passando em dois arquivos, antes de mudar produção. GREEN: 137 testes passaram em oito arquivos. Cobertura do novo módulo: 100% de linhas, instruções, funções e branches. Typecheck e lint dos arquivos alterados passaram.
- Criada [evidência de TDD](verificacoes/2026-10-29-busca-do-chat.tdd.md), ligada no índice; atualizados hot e domínio. Sem leitura de `.env`, banco/modelo real, migração, commit, push ou deploy. Preservados o worktree de login e as alterações anteriores desta conversa.

## [2026-10-30T08:52:56-03:00] revisão | Neurônios de blockchain/economia vs LLM Wiki

- Pedido de leitura dos neurônios já criados. Consultado o Supabase Bimo somente com SELECT; lidos sete neurônios atuais, oito origens e dois apontadores de slides. Sem leitura de PPTX ou inferência paga.
- Comparados com o texto integral local do padrão LLM Wiki: conformidade parcial. Confirmada duplicata 4872/4873; demais temas têm separação defensável. Síntese e contexto temporal limitados, referências cruzadas a melhorar; ausência de divergências registradas não foi tratada como prova de contradição omitida.
- Conferidas 25 citações em 23 afirmações: correspondência literal e revisões corretas; oito origens não gerenciadas. Contadas apenas revisões atuais para evitar duplicar o snapshot de Criptoeconomia.
- Criada [avaliação](verificacoes/2026-10-30-neuronios-blockchain-economia.md), ligados índice, hot e domínio. Nenhum neurônio, código ou dado remoto alterado; sem `.env`, teste de software, processamento, migração, commit ou push. Preservadas alterações preexistentes.

## [2026-10-30T09:09:32-03:00] manutenção | Consolidação autorizada de blockchain/economia

- Após “pode fazer”, enriquecidos seis temas no Supabase Bimo. A duplicata 4873 virou registro histórico que aponta a 4872, com proteção/pausa e caminho preservado. Nenhuma origem ou histórico apagado.
- Backup/proposta/SQL/resultado privados em `.vercel/wiki-revisao-20261030/` (ignorado pelo Git). Ensaio PGlite confirmou rollback integral e recusa de reaplicação; escrita real transacional com lock por dono, revisão-base e recusa de trabalho ativo/edição concorrente.
- Pós-escrita: sete revisões publicadas, 30 afirmações, 50 citações exatas, dez notas de origem/apontadores intactas, sete novas versões e sete eventos. Snapshots antes atuais preservados; 15 snapshots totais no recorte.
- Código local previne duplicatas por sufixos e título atual, reconhece casos legados no diagnóstico, distingue o registro consolidado e melhora orientações de síntese/contexto/procedência. RED 5/32; GREEN inicial 41 testes; 313 testes da Wiki em 28 arquivos passaram antes do complemento da marca de consolidação. Tipos e lint iniciais limpos.
- [Relatório e limites](verificacoes/2026-10-30-consolidacao-blockchain-economia.md); atualizados índice, hot, domínio e ponteiro na avaliação anterior. Sem `.env`, modelo pago, fila, migração, commit, push ou deploy. Alterações preexistentes preservadas; código hospedado ainda anterior.
- Encerramento: **314 testes em 28 arquivos** passaram; oito testes de observabilidade passaram novamente após preservar o redirecionamento como destino legível. `tsc --noEmit`, ESLint e `git diff --check` limpos. Os quatro links locais do relatório de revisão e os links da entrega foram conferidos; snapshots privados confirmados fora do Git.

## [2026-10-30T13:55:00-03:00] feature | Novo chat e histórico de conversas no chat

- Pedido: "não temos botão de novo chat e historico, falta implementar". Escolha do usuário: histórico **no banco** (Supabase), não em localStorage.
- Código local (sem commit/push/deploy): tabelas `conversas` e `mensagens_de_conversa` (`src/lib/db/schema/conversas.ts`, migração **`drizzle/0012_conversas.sql`, gerada e NÃO aplicada**); módulo `src/lib/conversas/` (tipos, memória, banco, índice, http, cliente) com suíte de contrato compartilhada; rotas `GET /api/conversas`, `GET|POST|DELETE /api/conversas/[id]`; componente `HistoricoDeConversas` com os botões "Histórico" e "Novo chat" no alto do `Chat`; `janelaParaOAgente` limita o que vai ao `/api/chat` (40 mensagens/80 mil caracteres).
- Decisões: histórico só cresce (acrescentar idempotente pelo id da mensagem, id gerado no cliente); `/api/chat` segue sem estado; só `caminho` dos argumentos das ferramentas é guardado (nunca o texto de uma nota); reabrir traz as 200 mais recentes; salvar falha de forma suave (aviso, a conversa da tela segue). `POST` de acrescentar ficou em `/api/conversas/[id]` porque rotas aninhadas dão 404 no dev server do preview (também as de notas) — causa não investigada.
- Verificação: tsc e eslint limpos; testes novos (contrato em memória 11, rotas 15, janela 4, Chat/histórico 11) passam; `src/components` + `src/app` 586 passam e `src/lib` 1633 passam, exceto 2 testes de `repositorio-de-notas/banco.test.ts` (banco real, timeout de 5 s, módulo não alterado). Fluxo conferido no navegador com `NOTAS_FONTE=memoria`: enviar, listar, Novo chat, reabrir.
- **Não verificado:** a implementação `banco.ts` contra Postgres real (a suíte `conversas/banco.test.ts` se pula enquanto a migração 0012 não existir no banco); layout no celular/captura de tela (painel do navegador oculto); produção.

## [2026-10-30T14:40:00-03:00] migração | 0012_conversas aplicada no banco real

- Com autorização do usuário ("Aplicar e testar"), `npm run db:migrate` aplicou **só a 0012** (a 0011 já estava; 13 → 14 registros em `drizzle.__drizzle_migrations`). `conversas` e `mensagens_de_conversa` existem com RLS ligada.
- A primeira tentativa falhou e fez rollback silencioso (exit 1): o drizzle-kit gerou a chave composta `mensagens_de_conversa → conversas(id,user_id)` **antes** do índice único que ela referencia. Corrigida a ordem no próprio `0012_conversas.sql` (nunca aplicada antes). Lição: após `db:generate` com FK composta, conferir a ordem dos comandos.
- `conversas/banco.test.ts` agora roda contra o banco real: **11/11 passam** (usuários efêmeros, nunca o `USER_ID_PADRAO`); `memoria.test.ts` 11/11.

## [2026-10-30T15:20:00-03:00] correção | Botões de histórico movidos para a barra Cérebro/Diário

- Relato: os botões "Histórico"/"Novo chat" ficavam soltos sobre o grafo, no meio da tela. Agora o `Chat` os põe, por portal (`lugarDosBotoes`), na barra "Cérebro / Diário" da `PaginaPrincipal`, à direita; no celular só o ícone. Só aparecem com o chat à vista. Sem a prop, continuam no alto do chat.
- Testes novos (Chat e PaginaPrincipal) e tipos/lint ok. **Não verificado visualmente**: já havia um servidor de desenvolvimento do usuário na porta 3000, que não foi derrubado.

## [2026-10-30T17:18:00-03:00] diagnóstico | Ausência de exclusão de notas

- Conferidos contrato do repositório, rota individual e componentes da nota: a aplicação não oferece apagar notas; a lacuna inclui backend e interface.
- Sugerida lixeira restaurável, ainda sem decisão ou implementação. A entrega futura precisa coordenar autosave/abas, atualizar listagem/busca/grafo e tratar referências da Wiki Viva a fontes indisponíveis.
- Só leitura de código e atualização da MemWiki. Sem testes de software, banco remoto, migração, commit ou deploy; alterações concorrentes preservadas.

## [2026-10-30T17:48:00-03:00] implementação | Lixeira com restauração

- Após a escolha explícita "lixeira com restauração", implementei operações nos repositórios de memória/Postgres, rotas protegidas e interface web (confirmação na nota e lixeira no rodapé da barra lateral).
- O editor salva pendências antes de remover, preserva rascunho em falhas e invalida sua fila após sucesso. Remoção confirmada limpa abas/históricos/recentes, lista e grafo sem remontar o chat. Leituras antigas não fazem a nota reaparecer. Restauração preserva identidade/histórico e recusa colisão de título sem sobrescrever.
- A Wiki ignora fontes removidas, cancela a posse em voo e preserva consumo, publicações e evidências para a restauração. Leituras legadas de notas/busca também filtram a lixeira.
- Migração 0013 gerada sem credenciais/conexão remota e aplicada somente aos bancos efêmeros PGlite dos testes. **Aplicar a 0013 antes de usar/publicar o código com o banco real.** A tarefa não moveu notas reais, não rodou modelo pago, não alterou mobile e não fez commit/push/deploy.
- Tipos, lint e testes focados passaram; [relatório da entrega](verificacoes/2026-10-30-lixeira.md) contém os comandos, os resultados finais e os limites da validação. Branch observada `feat/historico-de-conversas`, HEAD `6d108f5`, com alterações anteriores preservadas.
- Fechamento às 17h50: segunda suíte ampla com **2.195 aprovados e um timeout** (185 arquivos, 2.196 testes). Recorte com timeout repetido sem mudanças com um worker: **10/10 aprovados**, cenário em 301 ms. Testes focados finais 90/90; recorte SQL após ajuste do dublê 39/39 (totais sobrepostos). Tipos/lint/diff limpos. A suíte ampla não teve uma execução integral verde; integrações remotas ficaram excluídas.

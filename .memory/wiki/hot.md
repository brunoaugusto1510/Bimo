# Correções da revisão da Fase 8a — 2026-10-16

Correções de salvamento, recuperação, revalidação e acessibilidade concluídas no
working tree, sem commit/push. Leia [edicao-de-notas.md](edicao-de-notas.md),
seção de correções; CLAUDE.md foi atualizado.

- Fila preserva debounce após voo; 409 igual ao enviado confirma resposta perdida.
- Copiar só copia; recusa tem copiar/repetir; timeout de 20 s e retries em aba oculta.
- Atualização usa API autenticada /api/grafo?comArvore=1 e estado cliente:
  falha nunca substitui a árvore com chat, abas e editor.
- Abas revalidam ao ativar sem pendência e após escrita do agente. Ligações só da
  ativa, com SWR e debounce de 600 ms em checkpoint ou mudança de wikilinks.
- Rascunhos grandes preservados, token por instância, aviso de storage/cota;
  desmonte descarrega cópia, solicita checkpoint e ignora confirmação tardia.
- Foco, regiões vivas, recuperação, conflito, textarea, estrutura, barra de
  status e marcador de pendência ajustados conforme revisão.

Validação: vitest run src aprovou 1.049 testes; depois foi acrescido o teste de
checkpoint no desmonte (hook: 14/14), e npm test final aprovou 1.050 testes.
Ambas as rodadas amplas tiveram duas suítes reais bloqueadas nos hooks:
46 casos sem execução por fetch failed/EACCES. USER_ID_PADRAO foi UUID novo
somente no subprocesso, preservando dados do usuário real.
TypeScript, ESLint src/scripts (sem avisos), build final e diff-check passaram.
banco.ts, memoria.ts e suite-de-contrato.ts sem diff; nenhum log solto na raiz.

Próximos passos externos: revisão humana; executar as integrações em ambiente
com rede e conferir no navegador/leitor de tela os anúncios, foco, cabeçalho
mobile e saída da página. Nenhum E2E com navegador/leitor de tela nesta sessão.

## Histórico anterior preservado

# Fase 8a — edição e salvamento automático (2026-10-16)

Implementada no working tree, sem commit/push. Leia [edicao-de-notas.md](edicao-de-notas.md).
Editor Markdown com textarea, debounce 3 s/teto 30 s, fila serial com revisão otimista,
retry, checkpoints, backup local e recuperação/conflito com três saídas. Leitura
preserva o texto local; abas inativas ficam montadas; fonte sem escrita permanece bloqueada.

`router.refresh()` agrupado com intervalo mínimo de 10 s, inclusive após checkpoints.
Teste de renovação de props preserva chat/grafo; posições e câmera do grafo também
são reaproveitadas. Keepalive usa a mesma fila, apenas sem voo existente e com JSON
UTF-8 até 64 KiB; cópia local e beforeunload protegem os demais casos.

Validação: `vitest run src` 1012 aprovados; `npm test` 1017 aprovados. Em ambos,
duas suítes reais falharam nos hooks (46 casos sem execução: fetch failed/EACCES).
TypeScript, ESLint src/scripts e build passaram. Sem alteração nos três arquivos
proibidos. Próximos passos: revisão humana, integrações em ambiente com rede e
verificação de navegador do merge RSC e saída da página. Detalhes finais no log.

## Histórico anterior preservado

# Correções da Fase 6 — 2026-10-16

Revisão implementada: A1, M1–M6, B1–B4 e B6 (segmentos aparados). Substituir exige `ler_nota` na mesma chamada de `responder`, usa revisão lida e não repete conflito; acrescentar mantém retry único. Escrita não resolve substring; caminhos exatos precedem normalização. Erros internos não expõem SQL/conteúdo, avisos são concatenados e id GitHub é calculado sem relistar. Ver [agente-repositorio-de-notas.md](agente-repositorio-de-notas.md), seção de correções.

B5/Fase 8 e B7 ficam fora do escopo. `banco.ts` preservado por SHA-256, sem commit/push. Próximos passos: revisão humana e validação das integrações em ambiente com acesso ao Supabase/Postgres; manter a porta GitHub até a Fase 10.

Validação atual: 982 testes aprovados na suíte completa; 46 casos de integração bloqueados por hooks (fetch failed/EACCES). TypeScript, ESLint src/scripts e diff-check passaram. A rodada src/lib aprovou 722 testes antes do último caso legado adicional; o caso adicional passou na suíte completa. Detalhes na página do agente.

## Histórico anterior (contexto preservado)

# Estado imediato — 2026-10-16

Fase 6 concluída: agente e ferramentas usam o repositório configurado, com porta temporária de escrita no GitHub até a Fase 10. Leia [agente-repositorio-de-notas.md](agente-repositorio-de-notas.md). TypeScript e ESLint globais passaram; `npm test` aprovou 961 testes, com 46 casos bloqueados nos hooks das duas suítes de integração por rede. Sem alteração em `banco.ts` ou no histórico Git. `CLAUDE.md` atualizado.

Fase 4 do repositório de notas implementada e corrigida conforme revisão no checkout `feat/notas-por-id`, sem commit/push.
Leia [repositorio-de-notas-banco.md](repositorio-de-notas-banco.md) para decisões e limites.

- `banco.ts`: leitura/escrita por usuário, CAS, versões com sessão de autosave, reescrita transacional de ligações, busca full-text e marca compartilhada entre instâncias.
- `index.ts` importa banco dinamicamente depois da validação; dependência `server-only` protege a fronteira do servidor.
- Migração Drizzle `0006_nostalgic_stepford_cuckoos.sql`: o briefing de correções informa que M4 já foi verificado, aplicada sem duplicatas. Nenhuma migração executada nesta correção; a tentativa sem confirmação da sessão anterior é histórica.
- Integrações reais bloqueadas por `fetch failed` no Supabase Auth; conexões Postgres da suíte legada também receberam `EACCES`. Não contornar a restrição de rede.
- Correções A1/M1/M2/M5/M6/B1/B2/B6/B7 concluídas: autosave direcionado, rollback obrigatório em reescrita recusada, timeouts antes do advisory lock, snapshots separados do agente, relógio do banco, UUID validado e compatibilidade do legado.
- Validação das correções da Fase 4 (histórico): 111 testes locais aprovados (repositório + notas/ingestão/versões); 39 integrações puladas apenas na rodada local com `DATABASE_URL` vazia no subprocesso. Na tentativa real anterior, o hook de criação de usuário falhou com `fetch failed`. ESLint e `git diff --check` passaram. Os 9 erros TypeScript então existentes na Fase 6 foram resolvidos pela implementação registrada acima.
- Próximo passo: executar os 39 testes reais de `banco.test.ts` em ambiente com rede, incluindo rollback injetado e invalidação do editor pelo legado. Pendentes deliberados: M3, B3, B4 e B5; M4 já verificado conforme briefing.
- Atenção: `src/lib/tests/busca-textual.integration.test.ts` usa `USER_ID_PADRAO` na limpeza. Nesta sessão a suíte inteira recebeu um UUID sem dados só no subprocesso, preservando os dados do usuário real. Antes de executar esse teste com rede, garantir usuário efêmero para esse valor.

O cache hot não existia no início desta tarefa; foi criado conforme o protocolo do projeto.

## Fase 5 — importador (2026-10-16)

Importador implementado e documentado em [importacao-de-notas.md](importacao-de-notas.md), sem commit/push. Padrão é simulação; 23 testes focados e ESLint passaram. Alias e CLI verificados. Simulação com limite 3 bloqueada ao listar GitHub, sem gravação. Instalação de tsx bloqueada; promovida dependência transitiva já instalada para direta. Suíte completa: 917 passaram, 30 falharam, 35 pulados com DATABASE_URL vazia apenas no subprocesso; falhas em tarefas concorrentes/banco e integração textual. TypeScript global também não passou nesses arquivos. Não mexer em agente.ts/ferramentas.ts: Fase 6 concorrente. Próximos passos: revisar importador, repetir simulação em ambiente com rede e banco pronto; execução real só por decisão do usuário.

Atualização após Fase 6: a restrição de trabalho concorrente no agente acima é histórica; implementação concluída a pedido do usuário. Próximos passos do agente: revisão humana e validação das integrações em ambiente com rede; manter adaptador GitHub até o corte da Fase 10. Nenhuma decisão de implementação em aberto nesta fase.


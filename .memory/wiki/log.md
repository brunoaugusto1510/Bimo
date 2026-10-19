# Histórico

## 2026-10-16 — Fase 4: repositório de notas no banco

Leitura do briefing, CLAUDE/AGENTS, contratos, memória e referências do banco. TDD iniciado com falha por implementação ausente; adicionados adapter Postgres, integração isolada, testes locais, migração 0006 aditiva e import dinâmico. Preservados contrato e semântica de no-op, incluindo ligações ao mover pasta. Migração e integrações reais tentadas, bloqueadas pela rede; 905 testes da suíte inteira aprovados. Nenhum commit/push nem leitura/impressão/cópia de `.env`. Ver [decisões e limites](repositorio-de-notas-banco.md).

Validação final: 81 testes locais aprovados, 35 integrações puladas com ausência de DATABASE_URL simulada no processo Node; TypeScript, ESLint e diff-check aprovados. O teste de índice adicionado depois da execução completa também depende de banco e permanece não executado. Não foi alterado `suite-de-contrato.ts`.

## 2026-10-16 16:26:05 -03:00 — Fase 5: importador de notas
Implementados CLI seguro por padrão, lógica injetável, parser, relatório e 23 testes (RED antes da implementação, GREEN ao final). Atualizados package.json/lock e Commands do CLAUDE.md; sem novas variáveis. Downloads 8, escritas sequenciais, idempotência, CAS/checkpoint e colisões. CLI/alias funcionam; simulação falhou ao listar GitHub. npm install bloqueado por rede/cache; dependência tsx existente promovida para direta. Suíte completa com URL de banco vazia apenas no subprocesso: 917 aprovados, 30 falhas externas à Fase 5, 35 pulados. TypeScript global com erros externos; ESLint passou. Sem execução real, migração, commit ou push. Ver importacao-de-notas.md.

## 2026-10-16 16:30 -03:00 — Correções da revisão da Fase 4

Executado briefing de correções: A1, M1, M2, M5, M6, B1, B2, B6 e B7. TDD reproduziu seis falhas nas bordas do adaptador e duas no legado antes das respectivas correções. Autosave lê apenas alvo e versão; criação usa pastas distintas e colisão direcionada; movimentos/renomeações cancelam a transação se uma reescrita for recusada. Timeouts precedem advisory lock; agente não reaproveita autosave; timestamps usam clock_timestamp e UUID reutiliza regex de config. Legado invalida revisão ao gravar conteúdo, fecha autosave e traduz colisão do índice de título. Testes reais adicionados para rollback no meio das reescritas e restauração contra editor antigo; tentativa bloqueada no Auth com fetch failed, 39 casos não executados. Rodada local sem URL apenas no subprocesso: 111 passaram, 39 pulados. ESLint e diff-check passaram; tsc tem nove erros externos em testes da Fase 6 concorrente. M3/B3/B4/B5 adiados; M4 já verificado segundo briefing. Preservados arquivos concorrentes e suite-de-contrato.ts, sem migração, commit/push ou leitura/impressão manual de .env. Ver repositorio-de-notas-banco.md.

## 2026-10-16 16:42 -03:00 — Fase 6: agente sobre o repositório configurado

Continuado briefing da Fase 6 com testes existentes. RED: 24 falhas e dois módulos ausentes. Implementados resolvedor puro, porta de escrita por capacidade, ferramentas sobre RepositorioDeNotas, retry único com CAS/checkpoint e prompt por fonte. Preservado legado GitHub até Fase 10; notaId passa às pílulas sem exigir commit ou mudar a interface. Corrigidos dois regex com acentos corrompidos; adicionados testes de propagação no laço e CRLF. CLAUDE.md e wiki atualizados. Vitest src/lib: 702 passaram; npm test: 961 passaram; ambas as rodadas bloquearam os 46 casos das duas suítes reais por fetch failed/EACCES. Usado UUID descartável no subprocesso para proteger dados na limpeza do teste legado. tsc --noEmit, ESLint src/lib src/components e diff-check passaram. banco.ts preservado (hash verificado). Sem migração, commit/push, troca de branch, alteração do histórico ou acesso manual a .env. Ver agente-repositorio-de-notas.md.

## 2026-10-16 16:58 -03:00 — Correções da revisão da Fase 6

Executados A1, M1–M6, B1–B4 e B6 do briefing. Leitura prévia registrada por chamada do agente; substituir usa revisão observada sem retry, inclusive exigência no legado. Caminho exato tem precedência, escrita sem substring, segmentos aparados, ambiguidade limitada a dez opções. Acréscimo com linha em branco e CRLF. Erros internos genéricos com detalhe só no servidor; avisos preservados/concatenados; id GitHub calculado sem reler árvore; distinção de nota removida e nota não resolvida. Testes de resolver, CAS, legado, isolamento do laço e SQL sem vazamento; CLAUDE.md e wiki atualizados. B5/Fase 8 e B7 fora do escopo. Sem commit/push, migração ou leitura/impressão manual de .env; alterações prévias preservadas, banco.ts intacto por hash.

Verificação das correções: RED com 24 falhas antes da implementação; GREEN focado com 82 testes, mais um caso legado aprovado na suíte completa. `npx vitest run src/lib`: 722 passaram, 46 casos bloqueados nos hooks de duas suítes reais; `npm test`: 982 passaram, os mesmos 46 casos bloqueados (39 banco e 7 busca textual). Falhas dos hooks: Supabase Auth `fetch failed`; limpeza Postgres `EACCES`. UUID descartável em USER_ID_PADRAO somente no subprocesso; não se contornou a rede. TypeScript, ESLint src/scripts e diff-check passaram. Último ajuste da descrição da busca também passou por RED (1) e GREEN (45 testes de ferramentas/correções), sem alteração de lógica. Hash de banco.ts continua B1C39EC61A73804078375BCA3E8F740B8DB426DC8F214B3CF840E0F394D136EC.

## 2026-10-16 18:38 -03:00 — Correções da revisão da Fase 8a

Implementadas correções A1–A5, M1–M8, B1–B6 e os controles de acessibilidade
solicitados. Detalhes e decisões atuais em edicao-de-notas.md; histórico inicial
preservado. A4 usa /api/grafo?comArvore=1 autenticada e mescla estado cliente,
sem router.refresh; falhar atualização não desmonta conversa/editor/grafo.
A5 revalida a ativa sem pendência, adota revisão maior sem texto local e reage
a escrita do chat com notaId. Ligações só da ativa, com SWR e debounce de 600 ms.

TDD reproduziu rajada durante voo, falso conflito, resposta tardia, manter texto
igual, retry oculto, cópia que descartava, recuperação A→B→A, rascunho multibyte,
remoção por instância, foco, SWR, API, metadados do grafo, erro em retry e checkpoint
no desmonte. Testes extras de StrictMode, storage, visibilitychange, beforeunload,
texto >64 KiB no fluxo automático, hooks reais de AbaDeNota e falha de atualização
com conversa/grafo reais preservados. A correção de desmonte solicita checkpoint
e destrói a máquina imediatamente: não confirma nem apaga rascunhos de outra
instância por resposta tardia. Backup e beforeunload cobrem saída durante voo
ou acima do limite de keepalive, sem duplicar escrita em voo.

Validação executada:
- vitest run src: primeira rodada 1.045 passaram e 3 regressões locais falharam;
  corrigidas duplicações de status e estado carregando ao repetir leitura com erro.
  Rodada corrigida: 1.049 passaram, duas suítes reais bloqueadas nos hooks,
  46 casos sem execução por fetch failed/EACCES.
- Último teste acrescentado: checkpoint no desmonte; hook final 14/14 aprovados.
- npm test final, incluindo esse teste: 1.050 passaram; as mesmas duas suítes
  bloqueadas nos hooks, 46 casos sem execução. USER_ID_PADRAO temporário/efêmero
  no subprocesso em todas as rodadas amplas.
- npx tsc --noEmit, npx eslint src scripts e npm run build finais: aprovados,
  ESLint sem avisos. git diff --check aprovado.
- Três arquivos proibidos sem diff; nenhum commit, push ou migração.
  Nenhuma leitura direta/impressão de .env. Logs em TEMP, fora do repositório.
  CLAUDE.md, página da edição e hot atualizados.

Não foi executado E2E real com navegador/leitor de tela. Integrações dependem de
rede liberada; não se tentou contornar o bloqueio. Próximos passos: revisão
humana, integração real e conferência de foco/anúncios/mobile/encerramento.


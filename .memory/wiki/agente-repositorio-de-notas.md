# Agente sobre o repositório de notas — Fase 6

## Contrato e decisões — 2026-10-16

- `executarFerramenta` obtém `RepositorioDeNotas` uma vez por chamada; testes injetam `{ repositorio, legado? }`, sem simular o módulo do repositório. Erros de configuração e de domínio viram respostas normais para o modelo.
- As cinco ferramentas preservam nomes e argumentos. O modelo usa caminhos; a persistência usa ids opacos. Busca mantém os trechos com `**` e limita a 1–20 resultados; listagem filtra pasta sem distinguir caixa/acentos e limita a 200 caminhos, informando o total.
- `resolver-nota-do-agente.ts` é puro: tenta caminho completo, título, sufixo de pasta e trecho do título, nessa ordem. Ambiguidade em uma etapa pede caminho completo e lista as opções. Entrada vazia não resolve. `caminhoDaNota` devolve o caminho canônico com `.md`.
- `porta-de-escrita-do-agente.ts` concentra a decisão pela capacidade de escrita. No banco/memória, criação valida título e edição usa revisão lida, autoria do agente e `checkpoint: true`. Acréscimo mantém uma quebra entre conteúdo antigo e novo, inclusive com CRLF; conflito tem uma única repetição, recalculando o acréscimo sobre o conteúdo atual.
- A única implementação somente leitura disponível é GitHub. Para preservar produção até o corte, a porta temporária chama as funções legadas de escrita, mantendo commits. Remover essa porta na Fase 10. Se a listagem falhar depois de um commit bem-sucedido, preservar o sucesso e derivar o id do caminho do GitHub em vez de anunciar uma recusa falsa.
- Escritas bem-sucedidas retornam `notaId` ao laço do agente e a `UsoDeFerramenta`; o resultado para o modelo inclui `commit` somente quando há commit. A interface não foi alterada: pílulas sem commit continuam funcionando sem link.
- `instrucao-do-agente.ts` gera o prompt pela fonte: GitHub explica commits; banco/memória explicam notas guardadas no Bimo e histórico de versões. Descrições das ferramentas não fixam armazenamento. Sem a palavra antiga em textos de prompt/descrição/mensagem; o nome interno do import legado continua existindo.
- `CLAUDE.md` atualizado nas descrições da camada de notas e no roadmap. `banco.ts` preservado; nenhuma migração ou chamada real ao Gemini/GitHub de escrita faz parte desta tarefa.

## Verificação

RED inicial: 24 testes falharam e dois módulos de teste não carregaram por implementação ausente. Após implementação, os testes da Fase 6 passaram; corrigidos dois regex com acentos corrompidos nos testes já recebidos. Acrescentada cobertura de propagação de `notaId`/prompt no laço e união de linhas CRLF.

`npx vitest run src/lib`: 702 testes aprovados, 46 casos de integração não executados por falha nos hooks. As duas suítes de integração receberam `fetch failed` no Supabase Auth; a limpeza legada recebeu `EACCES` no Postgres. O subprocesso recebeu UUID descartável em `USER_ID_PADRAO`, preservando os dados reais. `npx tsc --noEmit` e `npx eslint src/lib src/components` passaram.

`npm test`: 961 aprovados, 46 casos não executados nas mesmas duas suítes de integração; 82 arquivos de teste passaram. Sem falhas nos casos executados. `git diff --check` passou. SHA-256 de `banco.ts` permaneceu `B1C39EC61A73804078375BCA3E8F740B8DB426DC8F214B3CF840E0F394D136EC`. Sem commit/push, troca de branch, migração ou leitura/impressão manual de `.env`.

## Correções da revisão — 2026-10-16

Este contrato substitui os detalhes anteriores sobre resolução, retry e identificação após escrita:

- Cada chamada de `responder` cria um `Map<IdDeNota, number>` compartilhado apenas entre suas ferramentas. `ler_nota` registra a revisão efetivamente devolvida. `substituir` exige essa leitura, usa a revisão registrada no CAS e nunca repete conflito. No GitHub a exigência usa o mesmo id opaco do repositório, mantendo a escrita legada até a Fase 10.
- O resolvedor tenta primeiro caminho exato, sem normalizar caixa/acentos (retira apenas a extensão). Depois aceita caminho normalizado, título normalizado e sufixo de pasta. Só a leitura aceita substring do título. Segmentos são aparados, barras invertidas aceitas e ambiguidades mostram até dez caminhos mais o total restante.
- `acrescentar` continua com revisão fresca e uma única repetição em conflito; separa textos por linha em branco e termina com quebra de linha, preservando CRLF.
- Erros esperados do agente usam `ErroDeFerramenta`; também se preserva `ErroDeConfiguracao`. Qualquer outra falha é registrada no servidor com prefixo da ferramenta e retorna somente mensagem genérica, sem SQL/parâmetros para modelo/interface.
- A porta GitHub calcula `notaId` diretamente por `codificarIdDoGithub(caminho)`, sem relistar nem engolir falha após commit. `notaId` usa `IdDeNota`. Leitura diferencia caminho não resolvido de nota removida entre listagem e leitura.
- O adaptador GitHub guarda e concatena o último aviso de busca, limpando-o numa busca posterior sem aviso. Listagem concatena aviso do repositório e truncamento em 200 resultados. A descrição da busca informa título/conteúdo, tags no banco e caminho no GitHub.
- B5 (pílula na interface/Fase 8) e B7 não foram executados. `banco.ts` permanece intacto. Sem commit/push ou leitura/impressão manual de `.env`.

Verificação das correções: RED com 24 falhas antes da implementação; GREEN focado com 82 testes, mais um caso legado aprovado na suíte completa. `npx vitest run src/lib`: 722 passaram, 46 casos bloqueados nos hooks de duas suítes reais; `npm test`: 982 passaram, os mesmos 46 casos bloqueados (39 banco e 7 busca textual). Falhas dos hooks: Supabase Auth `fetch failed`; limpeza Postgres `EACCES`. UUID descartável em USER_ID_PADRAO somente no subprocesso; não se contornou a rede. TypeScript, ESLint src/scripts e diff-check passaram. Último ajuste da descrição da busca também passou por RED (1) e GREEN (45 testes de ferramentas/correções), sem alteração de lógica. Hash de banco.ts continua B1C39EC61A73804078375BCA3E8F740B8DB426DC8F214B3CF840E0F394D136EC.

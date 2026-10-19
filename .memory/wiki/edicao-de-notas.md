# Edição de notas — Fase 8a (2026-10-16)

## Correções da revisão — 2026-10-16

Estas regras substituem os comportamentos da implementação inicial registrados
abaixo, mantidos como histórico. Sem commit/push, sem leitura de .env e sem
alteração de banco.ts, memoria.ts ou suite-de-contrato.ts.

- A fila mantém 3 s de debounce/teto de 30 s também para texto digitado durante
  requisição em voo. Só forçar/checkpoint pendente reenvia imediatamente. Descarta
  respostas de gerações canceladas; manter texto igual ao atual termina salvo.
- Um 409 com conteúdo atual igual ao enviado confirma uma resposta perdida,
  inclusive em keepalive; adota revisão e preserva o texto mais recente. Timeout
  de 20 s usa o mesmo retry de rede, inclusive em aba oculta. 413 pausa como
  recusa explícita, com copiar/tentar de novo.
- A4: AtualizadorDasNotas é filho de PaginaPrincipal. Busca árvore e grafo juntos
  em /api/grafo?comArvore=1 (exigirSessao, no-store), no máximo a cada 10 s. Mescla
  por estado cliente; falhas só mostram aviso. Não usa router.refresh(), portanto
  um erro posterior não passa pelo ramo ConfiguracaoNecessaria de page.tsx.
- A5/M1/M4: cache de leitura por id mantém último dado durante revalidação.
  Ativar aba sem pendência revalida nota; escrita do chat com notaId revalida a
  ativa. Revisão maior só é adotada sem texto local pendente. Ligações são
  pedidas apenas para a aba ativa, com SWR; autosave só solicita recarga quando
  muda o conjunto de wikilinks ou em checkpoint, com debounce de 600 ms.
- Rascunho válido grande/multibyte nunca é apagado pelo tamanho. Tokens de
  instância e comparação da cópia recuperada impedem uma confirmação velha de
  remover rascunho alheio; storage avisa alteração em outra janela. Falha de
  gravação local tem aviso visível. Recuperação é zerada ao trocar a sessão.
- No desmonte, descarrega cópia, solicita checkpoint e destrói a máquina sem
  esperar rede; resposta atrasada não confirma/apaga cópia de instância nova.
  Em pagehide com voo já existente ou corpo acima de 64 KiB, a proteção é a
  cópia local e beforeunload; não duplica PATCH em voo. beforeunload inclui
  erro, conflito, recusa e salvamento pendente, mesmo com textos iguais.
- CRLF é normalizado na entrada da máquina, sem reescrever value a cada render.
  Textarea limita novas entradas a 1.000.000 caracteres, preservando rascunhos
  antigos maiores para cópia. ResizeObserver/useLayoutEffect acomodam largura.
- Acessibilidade: foco só por ação Leitura→Edição; recuperação descrita e com
  foco em Restaurar. Conflito sticky acompanha altura real do cabeçalho mobile,
  usa group rotulado e alert persistente, com Copiar/Usar/Manter nessa ordem.
  Copiar só copia, mostra Copiada e mantém conflito; aria-disabled retém foco.
  Resultados são anunciados; resolução em Leitura foca h1. Salvo espera 1,5 s,
  exceto atalho/botão explícito; estados transitórios não são narrados. Erros
  persistem sem repetição durante retry. Avisos passageiros não ocultam erros.
- Grafo copia somente x/y/vx/vy; título/grupo novos e fx/fy antigos não vazam.
  Nós adicionados recebem 30 passos de acomodação; câmera continua preservada.

TDD: RED observado para fila, conflito falso, resposta tardia, rascunho grande,
remoção por instância, cópia, navegação A→B→A, foco, SWR, atualização por API,
metadados do grafo, anúncios de erro e checkpoint no desmonte. Testes adicionais
cobrem StrictMode, visibilitychange, antes de sair, caminho automático >64 KiB,
hooks reais do painel, revisão do agente e identidade de conversa/grafo em falha.
Resultados finais da validação estão em hot.md/log.md. Integrações reais seguem
dependendo de ambiente com acesso de rede; não houve E2E com leitor de tela.

## Histórico da implementação inicial

Implementação no working tree, sem commit/push. Editor simples de Markdown com
textarea, habilitado exclusivamente por `capacidades.escrita`. Título e propriedades
continuam somente leitura; criação de notas e sugestões de inserção estão fora do escopo.

## Salvamento e concorrência

- `src/lib/edicao/salvamento-automatico.ts`: máquina sem React, dependências injetáveis,
  debounce de 3 s, teto de 30 s, uma escrita por vez, revisão encadeada. O texto
  digitado durante o voo nunca é substituído pela resposta anterior.
- Falhas transitórias usam 5/15/30 s de recuo, depois 30 s fixos. Conflito e recusa
  congelam a fila. Forçar devolve promessa que inclui as alterações durante o voo;
  checkpoint fecha também uma sessão já salva sem repetir checkpoints fechados.
- `src/lib/espaco-de-trabalho/usar-edicao-de-nota.ts` integra estado, HTTP e backup.
  Leitura usa o mesmo texto local da edição; abas inativas ficam montadas e ocultas.
  Trocar de aba/modo, navegar ou desmontar força checkpoint sem bloquear navegação.
- `cliente-de-notas.ts`: PATCH com id escapado, revisão/checkpoint e união discriminada
  dos resultados HTTP. Sucesso invalida prévias.

## Recuperação e conflitos

`rascunho-local.ts` mantém `bimo_rascunho:<id>`, com texto, revisão e instante,
limitando gravações a 500 ms e descarregando ao sair. JSON/tipos/revisão/data e teto
de 1 MB UTF-8 são validados. Storage indisponível ou cheio não lança para a UI.
Texto igual ao servidor é limpo; mesma revisão oferece Restaurar/Descartar;
revisão divergente abre conflito. Confirmação apaga só a cópia do mesmo texto.

Conflito exige Manter a minha versão (nova revisão-base e checkpoint), Usar a
versão salva ou Copiar a minha versão antes de usar a salva. Cópia recusada mantém
texto e conflito. Erros técnicos não são expostos. A UI anuncia status e marca abas
pendentes, com foco devolvido ao texto após resolução.

## Refresh e saída da página

`AtualizadorDasNotas`, irmão estável de `PaginaPrincipal` em `page.tsx`, recebe eventos
de sucesso e chama `router.refresh()` no máximo uma vez a cada 10 s, com execução
posterior agrupada, inclusive para checkpoints. A documentação instalada do Next
confirma merge do payload RSC preservando estado cliente. Teste de renovação de
props comprova identidade do chat/grafo e texto do chat. Não houve E2E real RSC.
`GrafoDeFundo`/`simulacao-do-grafo` preservam coordenadas, respiração e câmera ao
receber novos dados, evitando reinicialização visual na atualização.

Em hidden/pagehide, a mesma fila tenta keepalive com checkpoint se o JSON UTF-8
completo cabe em 64 KiB e não existe escrita em voo. Não duplica um pedido em voo.
Acima do limite ou durante voo existente, descarrega a cópia local; `beforeunload`
avisa enquanto há trabalho não salvo. Keepalive é best-effort e não garante entrega.

## Validação

TDD com RED observado antes das implementações da máquina, backup, cliente, hook,
editor, controles, refresh e preservação de posições. Primeira rodada `vitest run
src`: 1012 aprovados; rodada `npm test`: 1017 aprovados. Ambas tiveram duas suítes
de integração impedidas nos hooks (46 casos sem execução, fetch failed no Supabase
Auth e EACCES Postgres na limpeza). `USER_ID_PADRAO` foi um UUID novo somente no
subprocesso dos testes, evitando limpeza de dados do usuário real. TypeScript,
ESLint src/scripts e build passaram. Testes finais focados: ver hot/log.

`banco.ts`, `memoria.ts` e `suite-de-contrato.ts` preservados. Nenhuma migração,
commit ou push; nenhum conteúdo de `.env` lido ou impresso. Próximo passo externo:
validar integrações em ambiente com rede e realizar verificação no navegador do
refresh RSC e encerramento da página. Nenhuma escolha de implementação em aberto.

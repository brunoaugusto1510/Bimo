# Bimo — Plano: notas no banco, espaço de trabalho e edição automática

Branch: `feat/notas-por-id`. Última atualização: 19/10/2026.

## Objetivo

Levar ao app as 4 telas de desktop do design (Abrir nota com abas, Nova nota, Nenhuma nota aberta, Ir para nota — Ctrl+O), **sem modal**, no estilo do Obsidian, com as notas guardadas **no banco do Bimo** (Supabase/Drizzle) em vez do repositório do GitHub, e com **salvamento automático**. As telas de celular estão fora do escopo.

## Decisões

- As notas moram no banco do Bimo (tabelas `nos`, `notas`, `versoes_nota`). O repositório do GitHub foi a origem da importação (feita) e agora é só arquivo: o app não lê nem escreve nele.
- Salvamento automático, sem botão de salvar.
- Toda nota é identificada por um **id opaco** (string que a interface nunca interpreta), não pelo caminho. No banco é o `id` numérico da nota em texto.
- As **ligações `[[x]]` são derivadas do texto na leitura**; nunca são espelhadas na tabela `relacoes`.
- Concorrência otimista: toda gravação leva a `revisaoBase`; se a nota mudou desde então, a resposta é conflito com a versão salva.
- Fonte das notas escolhida por `NOTAS_FONTE`: `banco` (padrão; exige `DATABASE_URL` e `USER_ID_PADRAO`) e `memoria` (dev e testes, recusada em produção). `github` foi removida e dá erro de configuração.
- `SENHA_HASH` e `SEGREDO_SESSAO` falham fechado (503); as variáveis de notas falham suave (tela "falta configurar").
- Tudo em pt-BR (código, comentários, interface). Em texto que uma pessoa lê, diz-se "notas", nunca "vault".

## Fases

| Fase | O que é | Situação |
| --- | --- | --- |
| 1 | Núcleo puro: caminho, Markdown, ligações, índice de ligações, grafo, árvore | Feita |
| 2 | Contrato `RepositorioDeNotas`, repositório em memória, adaptador do GitHub (removido na 10c), serviço com cache, suíte de contrato | Feita |
| 3 | Rotas `/api/notas`, `/api/grafo` e interface por id | Feita |
| 4 | Repositório no banco (`banco.ts`) e migração `0006` | Feita |
| 5 | Importador `npm run importar-notas` | Feita. A importação real só foi executada em 21/10/2026 (383 criadas, 1 ignorada por título `.pdf.md`, 0 falhas), depois do corte; antes disso o banco estava vazio. O importador foi removido na 10c e segue no histórico do git |
| 6 | Agente (Gemini) lendo e escrevendo pelo repositório configurado | Feita |
| 7 | Espaço de trabalho de leitura: abas, navegação, Ctrl+O, painel lateral, prévia de ligação | Feita |
| 8a | Edição com salvamento automático | Feita |
| 8b | Nota nova: Alt+N, "Criar nota" pela paleta (Ctrl+Enter), criar pela ligação `[[x]]` | Feita |
| 9 | Extras do editor: autocompletar `[[` e `#`, menu `/`, rascunho do Bimo; editar título (renomear), pasta e tags | Feita (20/10/2026) |
| 10 | Corte para o banco e limpeza | Feita (20/10/2026) |

### Fase 8a — edição e salvamento automático

- Editor simples (`<textarea>`) no modo "Edição"; o título, pasta e tags continuam só leitura.
- Máquina de salvamento: espera 3 s depois da última tecla, no máximo 30 s sem salvar, uma requisição por vez, recuo em falha (5 s, 15 s, 30 s), Ctrl+S fecha a versão (checkpoint).
- Cópia local no `localStorage` (`bimo_rascunho:<id>`) e recuperação ao reabrir.
- Conflito (409): três saídas — manter a minha versão, usar a versão salva, copiar a minha versão.
- Ao sair da página, envio com `keepalive` quando o texto cabe no limite do navegador.
- Barra de status com o estado do salvamento, anunciado a leitores de tela.

### Fase 8b — nota nova

- `Alt+N` e o botão criam uma nota no banco e abrem a aba já em edição.
- Na paleta Ctrl+O, um título que não existe oferece "Criar nota" (Ctrl+Enter).
- Clicar numa ligação `[[x]]` que não existe cria a nota.
- Título explícito repetido na mesma pasta abre a nota existente e anuncia isso;
  criações automáticas tentam até vinte títulos livres. A renomeação recusa colisões.
- Aproveitar para ligar a pílula do chat (`notaId` já chega) à nota no espaço de trabalho.
- Implementada: título selecionado nas criações automáticas da sessão; paleta e
  ligações focam o texto. Renomeação serializada com autosave, proteção local
  contra listagens antigas e atualização imediata por `bimo:nota-criada`.
- Notas vazias permanecem. Durante o POST há anúncio “Criando nota…”; teclas
  digitadas antes da chegada do foco podem se perder (limitação aceita).

### Fase 9 — extras do editor e metadados

Plano do planejador do ECC (20/10/2026). Editor continua um `<textarea>` com popover
posicionado pelo cursor (CodeMirror fica para uma fase própria, se realce virar
objetivo). Cinco subfases, cada uma commitada sozinha, nesta ordem, com Codex +
revisão do ECC + verificação completa + commit e push, sem parar entre elas.

**Decisões do usuário:** renomear direto e anunciar depois quantas notas tiveram
ligações atualizadas (só Enter confirma em nota já existente; sair do campo não
renomeia); tags escritas no texto (`#x`, frontmatter) são só leitura no painel; o
rascunho do Bimo pode buscar em outras notas (só leitura, sem ferramentas de escrita).

| Subfase | Escopo | Situação |
| --- | --- | --- |
| 9a | Renomear qualquer nota | Feita (20/10/2026) |
| 9b | Pasta e tags pela interface | Feita (20/10/2026) |
| 9c | Base do autocompletar + `[[` | Feita (20/10/2026) |
| 9d | `#` e menu `/` | Feita (20/10/2026) |
| 9e | Rascunho do Bimo | Feita (20/10/2026) |

**9a — renomear qualquer nota.** `CampoDeTitulo` em toda nota com escrita e modo
Edição; `idsComTituloEditavel` sai (o foco da criação já vem de `focoPedido`).
`edicao.renomear` devolve `{ nota, notasReescritas }`; anúncio "Título alterado para
«X»; N notas tiveram ligações atualizadas". Editor `readOnly` + `aria-busy` durante
`executarExclusivo` (a renomeação reescreve autoligações da própria nota; digitar no
meio faria o autosave apagar essa reescrita). Mensagem da fila exclusiva genérica.
Arquivos: `AbaDeNota`, `EspacoDeTrabalho`, `PaginaPrincipal`, `CampoDeTitulo`,
`EditorDeNota` (prop `ocupado`), `usar-edicao-de-nota.ts`, `salvamento-automatico.ts`.

*Como ficou (9a):* em nota existente só Enter confirma e sair do campo restaura o título
(com anúncio falado); em nota recém-criada o blur confirma até a primeira saída
(`idsComConfirmacaoAoSair` perde o id depois disso). Perder a janela (Alt-Tab) não conta
como sair. `ocupado` é contado por id (a aba não remonta ao navegar); o editor fica
`readOnly` com o aviso "Renomeando a nota…". Trocar para Leitura fica bloqueado
durante a renomeação e com título pendente (o foco vai ao campo). O foco no texto após o
Enter espera o editor liberar. `EVENTO_NOTAS_REESCRITAS` sai mesmo se a máquina de edição
já foi trocada. Fora de escopo, por decisão de design: contraste da borda dos campos
(`--borda`, 1,3:1) e `scroll-mt` dos campos sob a barra grudada.

**9b — pasta e tags.** `atualizarNota` passa a devolver `notasReescritas` quando a
pasta muda (`tipos.ts`, `banco.ts`, `memoria.ts`, `suite-de-contrato.ts`; `salvarNota`
repassa). `edicao.atualizarMetadados({ pasta?, tags? })` pela fila exclusiva, com
checkpoint e `rebasear`; depois `registrarNota` e `bimo:notas-reescritas` se
`notasReescritas > 0`. Só em modo Edição. Tags: só as da coluna são editáveis; as do
texto aparecem marcadas "no texto". Pasta: combobox com pastas existentes + Raiz +
texto livre (`normalizarPasta`; `titulo-em-uso` → "Já existe «X» nessa pasta").
Nova rota `GET /api/notas/tags` (`exigirSessao`; `{ tags: { nome, quantidade }[] }`,
calculada em `servico-de-notas.ts` sobre o cache por `marcaDeVersao`).

*Como ficou (9b):* `CampoDePasta` (input + datalist com as pastas e as pastas-pai, botão
**Mover** visível, Enter também move; sair do campo não descarta, Esc descarta e avisa;
mostra a grafia que o servidor gravou) e `EditorDeTags` (chips da coluna removíveis, as do
texto marcadas "no texto"; Enter ou vírgula adiciona, lista colada vira várias; rejeita
espaço e os limites de 30 tags / 100 caracteres antes de enviar; foco vai ao chip vizinho
ao remover). Ambos recomeçam a cada nota (`chave`), ficam somente leitura enquanto a fila
exclusiva trabalha e usam `edicao.atualizarMetadados`, que divide com `renomear` o helper
`escreverExclusivo`. O hook `useTagsDasNotas` guarda as sugestões e só as refaz depois de um
checkpoint. As tags são contadas sob demanda no servidor. `salvarNota` repassa
`notasReescritas` e a mensagem de validação em 400. Fora de escopo, por decisão de design:
contraste da borda dos campos (`--borda`). Conhecido: uma resposta perdida de "mover" em
nota com autoligação por caminho vira um conflito falso (sem perda de texto).

**9c — base do autocompletar + `[[`.** Puros em `src/lib/edicao/`:
`gatilho-do-editor.ts` (`detectarGatilho(texto, cursor)` → ligação/tag/comando, sem
disparar em código nem frontmatter; `[[` cancela com `]`, quebra de linha, `|` ou
`\[[`), `insercao-no-editor.ts` (não duplica `]]`; no DOM `setSelectionRange` +
`execCommand("insertText")` para preservar o Ctrl+Z, fallback `setRangeText`),
`posicao-do-cursor.ts` (div espelho). Alvo: só o título quando o resolvedor resolve
para aquela nota, senão `juntarCaminho(pasta, titulo)`. Ranking com `buscarPorTitulo`
(8 itens, sem rede). `SugestoesDoEditor.tsx` (listbox dentro do `<article>` relativo;
inverte perto da borda; largura total no celular; opções `min-h-10` com `onMouseDown`
`preventDefault`). Teclado: ↑/↓, Enter/Tab inserem, Esc fecha; com popover fechado
Tab/Enter normais; ignora composição IME; não abre durante recuperação de rascunho.
ARIA: textarea continua textbox; aberto ganha `aria-autocomplete="list"`,
`aria-controls`, `aria-activedescendant`; região `status` ao abrir e ao inserir.
`[[Título#` com seções da nota alvo é opcional no fim.

*Como ficou (9c):* `detectarGatilho` (só `ligacao`; `tag` e `comando` entram na 9d) olha primeiro a
linha do cursor e só então frontmatter e código; não dispara com o cursor no meio de uma
ligação existente (`[[Mi|nha]]`, `[[Nota|apelido]]`). `sugerirLigacoes` reaproveita
`buscarPorTitulo` (8 itens, sem a própria nota) e usa `Pasta/Título` quando só o título não
resolve para a nota. O hook `useSugestoesDoEditor` concentra o estado: a lista **abre só por
digitação** (mover o cursor apenas atualiza ou fecha), Esc é persistente no mesmo `[[`, Tab só
insere depois de navegar com as setas, setas/Enter com modificador são do campo, IME e
somente leitura fecham a lista, e `escolher` revalida o gatilho. A lista (`SugestoesDoEditor`)
escolhe no `click` (o `mousedown` só mantém o foco), tem id por nota (`aria-activedescendant`
muda quando o topo muda) e indicador de opção ativa por borda, não só por cor. Conhecido:
`aria-activedescendant` em `<textarea>` é pouco anunciado no Safari/iOS; a abertura e a
inserção são faladas numa região de status. Decisão: o campo continua `textbox` (um
`<textarea>` não aceita `role="combobox"`).

**9d — `#` e `/`.** `#` só no começo da linha ou após espaço, seguido de caractere
de tag (`# ` e `##` nunca abrem); sugestões de `GET /api/notas/tags` (cache até
`bimo:nota-salva`) + tags da nota. `/` no começo da linha (após recuo) ou após
espaço, consulta só letras, fecha com espaço ou sem resultado. `aplicarComando`
puro: título 1–3 (troca prefixo existente), lista, numerada, tarefa, citação, bloco
de código (cursor no meio), divisor `---` (com linha em branco antes), tabela 2×2.

*Como ficou (9d):* o hook `useSugestoesDoEditor` serve os três gatilhos; `src/lib/edicao/sugestoes.ts`
é o modelo unificado (ligação, tag, comando: ranking, itens da lista, avisos, `planejarInsercao`).
`#` não abre com número puro (`#123`), dentro de ligação aberta, em código/frontmatter nem no meio
de palavra; a barra sozinha só abre o menu no começo da linha (no meio da frase só com letras).
Enter em tag (e no `/` sozinho) só insere depois de escolher com as setas, porque a busca é
aproximada e trocaria o que foi digitado; em ligação e em `/letras` Enter insere a primeira opção.
Depois de inserir, o gatilho fica dispensado (a tag inserida ainda casa com `#tag`). Comandos de
bloco empurram o resto da linha para baixo, ocupam o lugar de um prefixo de lista/citação vazio e
`/divisor` na primeira linha vira `***` (um `---` ali abriria um frontmatter). A tabela deixa
"Coluna 1" selecionado. Conhecido e não tratado: filtrar a lista ou fechá-la por falta de
resultado não é anunciado; reabrir depois de Esc exige digitar o gatilho de novo.

**9e — rascunho do Bimo.** Rota nova `POST /api/bimo/rascunho` (não reaproveitar
`/api/chat`, que tem ferramentas de escrita e até 5 voltas): `exigirSessao` +
`exigirMesmaOrigem` + `lerJsonComLimite`; zod `{ acao: continuar|resumir|melhorar,
trecho ≤ 8k, antes ≤ 4k, depois ≤ 2k, titulo }` (o cliente manda o texto do editor,
inclusive o não salvo); limite em memória ~20/min; Gemini sem ferramentas de escrita
(pode usar busca/leitura de notas só leitura, por decisão do usuário), saída curta,
timeout; instrução de sistema fixa trata o texto entre delimitadores como dado; erro
→ 500 genérico. Extrair `getClient`/`MODELO` de `agente.ts` para `src/lib/gemini.ts`.
UI: barra "Bimo sugere" (Continuar no cursor; Resumir/Melhorar na seleção), comandos
`/continuar` etc.; `BimoPensando` + Cancelar durante a geração; proposta num cartão
`bg-destaque-suave` com Aceitar/Descartar/Tentar de novo, texto puro
(`whitespace-pre-wrap`, nunca o renderizador de Markdown). Aceitar confere a âncora
(trecho igual ao original) e insere pelo helper da 9c (autosave normal); nada vai ao
servidor de notas antes de aceitar. Sem streaming na v1. À parte: `/api/chat` não
chama `exigirMesmaOrigem` e devolve `erro.message` cru — corrigir.

*Como ficou (9e):* servidor: `src/lib/gemini.ts` (cliente e modelo compartilhados com o agente),
`rascunho-do-bimo.ts` (somente leitura: só `buscar_notas`, `listar_notas` e `ler_nota`, até 4
consultas por rodada e 6 no total, textos cortados em 12 mil caracteres, resultado marcado como dado
não confiável, erro de consulta volta ao modelo, 25 s de limite, saída sem imagens Markdown),
`limite-de-uso.ts` (20 por minuto, uma chave só: o app tem um usuário), `validacao-do-rascunho.ts`
e a rota `POST /api/bimo/rascunho` (sessão, mesma origem, corpo de até 64 KB lido em stream, erros
genéricos). `/api/chat` ganhou `exigirMesmaOrigem` e erro genérico (configuração faltando segue
explicada com 503). Cliente: barra "Bimo sugere" (Continuar, Resumir seleção, Melhorar seleção) e
`/continuar` no menu `/`; `useRascunhoDoBimo` guarda a proposta sem tocar no texto; o cartão mostra
texto puro (nunca Markdown) com Aceitar, Descartar e Tentar de novo. Aceitar confere a âncora: o
tamanho do texto, o que vem antes, depois e a seleção precisam ser os do pedido (senão "Peça de
novo"), tira imagens Markdown e entra pelo mesmo caminho da digitação. O foco só vai ao cartão
se estava na barra, no cartão ou perdido (nunca é roubado do texto); Esc cancela o pedido.
Respostas do agente no chat também não criam mais `<img>`.

**Pendências conhecidas depois da 9e (decisão do usuário):** (1) CSP em `next.config.ts` (hoje não
há; `img-src 'self' data:` e `connect-src 'self'` fechariam de vez a exfiltração por imagem, mas
exigem testar o script de tema e o Next em desenvolvimento); (2) `/api/chat` ainda sem limite de
corpo, de mensagens, de uso nem cancelamento, e o agente tem ferramentas de ESCRITA que leem texto
de notas (uma injeção numa nota pode gerar `editar_nota` sem aprovação: considerar confirmação);
(3) roteiro manual de leitor de tela (NVDA+Chrome, VoiceOver+Safari) para `aria-activedescendant`
em `<textarea>` e para o cartão do Bimo; (4) avisos falados ao filtrar/fechar a lista de sugestões;
(5) contraste da borda dos campos (`--borda`, decisão de design).

**Riscos a testar:** fila única (digitação durante operação exclusiva; mover que
reescreve o próprio texto); inserção nunca perde caracteres (recalcula o gatilho no
`selectionStart` atual); desempenho de `mascararCodigo` por tecla em nota de 1 MB;
acessibilidade (roteiro manual NVDA+Chrome e VoiceOver+Safari para
`aria-activedescendant` em textarea); segurança da 9e (sem escrita, texto puro,
limites de tamanho e frequência, mesma origem); vocabulário sem "vault".

### Fase 10 — corte e limpeza

Subfases (cada uma commitada e verificada sozinha, branch `feat/corte-para-o-banco`):

| Subfase | O que é | Situação |
| --- | --- | --- |
| 10a | `NOTAS_FONTE` passa a valer `banco`; `github` vira erro de configuração; prompt do agente sem depender da fonte; página inicial sem vazar o erro cru | Feita (20/10/2026) |
| 10b | Sai a porta legada de escrita do agente, o `commitUrl` e o link de commit da pílula | Feita (20/10/2026) |
| 10c | Apagados `vault-real.ts`, `github.ts`, o adaptador do GitHub, `etapas-futuras/`, o importador e `lerConfiguracaoDoGrafo` | Feita (20/10/2026) |
| 10d | "vault" e "GitHub" saem dos comentários e nomes internos | Feita (20/10/2026) |
| 10e | Documentação: `CLAUDE.md`, `AGENTS.md`, `README.md`, `.env.example` e este plano | Feita (20/10/2026) |

*Como ficou:* o app só lê e escreve no banco. O repositório do GitHub é arquivo e a
edição no Obsidian/GitHub deixou de chegar ao app. O grafo usa a configuração padrão
(`CONFIGURACAO_PADRAO`), como já fazia no modo banco; o `.obsidian/graph.json` não é
mais lido. O importador saiu: as 383 notas só foram importadas depois do corte (21/10/2026; o
plano e a 10c afirmavam, por engano, que já estavam no banco) e o código segue no
histórico do git (para repetir a importação, recupere `scripts/importar-notas.ts`,
`src/lib/importacao-de-notas.ts` e `src/lib/vault-real.ts` de um commit anterior a
`a2cd2a6`). `tsx` deixou de ser dependência direta (continua como dependência do
`drizzle-kit`). A regex de id (`esquemaDeIdDeNota`, até 1500 caracteres) ficou como
estava: o teto folgado era para o id do GitHub, mas apertá-lo não traz ganho agora.

**Checklist de produção (ação sua, na Vercel):** conferir que `DATABASE_URL` (porta
6543), `USER_ID_PADRAO`, `SENHA_HASH`, `SEGREDO_SESSAO` e `GEMINI_API_KEY` existem e que
não há `NOTAS_FONTE=github`; sem isso a página mostra a tela "falta configurar" e o chat
responde 503. Depois do deploy, apagar `VAULT_REPO`, `VAULT_BRANCH`, `VAULT_SUBPATH` e
`GITHUB_TOKEN` e **revogar o token do GitHub** (ele tinha permissão de escrita).

**Decisão em aberto:** o repositório do GitHub vira só arquivo (assim está). Uma
exportação periódica das notas para ele seria um recurso novo, a decidir depois.

## O que cada peça faz

- `src/lib/repositorio-de-notas/` — contrato (`tipos.ts`), `banco.ts`, `memoria.ts`, `suite-de-contrato.ts` (qualquer repositório que aceita escrita precisa passar), `config.ts` e `index.ts` (escolhe a fonte).
- `banco.ts` — escritas serializadas por usuário (lock consultivo na transação, com timeouts), gravação por revisão base, histórico em `versoes_nota` (o salvamento automático reaproveita a versão da sessão aberta do usuário; o checkpoint a fecha; edições do agente abrem versão própria), renomear e mover pasta reescrevem as ligações das outras notas na mesma transação, busca com `portugues_sem_acento`.
- `src/lib/agente.ts`, `ferramentas.ts`, `porta-de-escrita-do-agente.ts`, `resolver-nota-do-agente.ts` — o agente continua endereçando por caminho (`Pasta/Título.md`); `substituir` exige ter lido a nota na conversa; escrita nunca resolve por trecho do título.
- `src/lib/espaco-de-trabalho/` e `src/components/` — estado das abas (reducer puro), persistência, hooks `useEspacoDeTrabalho`/`useNota`/`useLigacoes`, e os componentes do espaço de trabalho.

## Continuar em outro computador

1. `git fetch && git checkout main && git pull`, depois `npm install` (a Fase 10 está na `feat/corte-para-o-banco` até ser mergeada).
2. Crie o `.env` a partir de `.env.example`. Valores que faltam num computador novo: `DATABASE_URL` (transaction pooler, porta 6543), `DATABASE_URL_MIGRATIONS` (session pooler, 5432), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (a chave secreta, não a publicável), `USER_ID_PADRAO`, `SENHA_HASH` e `SEGREDO_SESSAO` (`npm run gerar-senha`, `npm run gerar-segredo`), `GEMINI_API_KEY`. Nada disso vai para o Git.
3. Os dados já estão no Supabase: as migrações `0000` a `0006` estão aplicadas e as 383 notas foram importadas.
4. Para ver as notas do banco: `npm run dev` (o banco é o padrão; `NOTAS_FONTE=memoria` usa notas de exemplo).
5. Conferir que está tudo certo: `npm test`, `npx tsc --noEmit`, `npx eslint src scripts`, `npm run build`. Os testes de `banco.test.ts` rodam contra o Postgres real: criam e apagam um usuário efêmero pela Admin API do Supabase.

## Pendências conhecidas

- Marca de versão e listagem com conteúdo escalam com o número de notas: um índice `(user_id) INCLUDE (revisao, atualizado_em)` ou um contador por usuário resolve quando houver milhares de notas.
- Busca no banco: consulta só com termos negados, ranking sem normalização por tamanho, destaque `**` pode colidir com negrito do texto, tsvector acima de ~1 MB falha.
- Diferença entre `lower()` do JavaScript e do Postgres para alguns caracteres (raro).
- Contraste de `text-suave` e `destaque-texto` no tema claro abaixo de 4,5:1 — é decisão do design system, tokens não alterados.
- Interface: abas de notas homônimas sem a pasta no nome; Ctrl+J não leva o foco ao chat; sem cache por id em `useNota`; o grafo ignora `prefers-reduced-motion`; muitos `section aria-label` viram landmarks.
- Importação: as notas importadas ficam com a data da importação; uma nota (`...MQTTGIT.pdf.md`) foi ignorada porque o título não pode terminar em extensão de arquivo.

## Como o trabalho é feito

TDD; revisão independente a cada bloco (agentes do ECC e o Codex); commits convencionais em pt-BR. O Codex aceita uma tarefa por vez neste repositório e a sandbox dele não alcança a rede: testes de integração contra o banco e `db:migrate` rodam fora dela.

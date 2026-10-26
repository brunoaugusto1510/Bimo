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
6543), `USER_ID_PADRAO`, `SENHA_HASH`, `SEGREDO_SESSAO`, `OPENAI_API_KEY` (chat) e `GEMINI_API_KEY` (rascunho e ingestão) existem e que
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

## Agente principal com GPT-6 Luna — 21/10/2026

O chat passa a usar `gpt-6-luna` pela Responses API da OpenAI. `openai.ts`
usa HTTP nativo, protegido por `server-only`, sem dependência adicional, com
`OPENAI_API_KEY` e modelo opcional `OPENAI_MODEL`. A chave fica no servidor;
sem ela a rota responde 503, sem troca automática de provedor. O Gemini continua
no rascunho do editor e na ingestão, com suas próprias variáveis.

`ferramentas-openai.ts` adapta as cinco declarações existentes para schemas
estritos (campos opcionais anuláveis); a execução continua em `ferramentas.ts`.
O agente preserva raciocínio e resultados pelo `call_id`, o mapa de revisões lidas,
a recusa de substituição sem leitura e os eventos `aoPasso`/NDJSON do grafo.
Não há repetição automática de requisições; escritas com nome e argumentos iguais
são reaproveitadas dentro da mesma execução, evitando um segundo acréscimo.
Isso não é idempotência entre pedidos separados ou instâncias.

Limites: raciocínio `low`, saída até 4.096 tokens por chamada, até cinco chamadas,
prazo de 45 segundos e cancelamento do transporte ao abandonar o fluxo. Uma
escrita já concluída não é desfeita pelo cancelamento. A rota limita o corpo a
1 MB, histórico a 40 mensagens, cada texto a 20 mil caracteres e o total a 80 mil;
o agente recusa contexto serializado acima de 200 mil caracteres antes da próxima
chamada, sem cortar notas silenciosamente. Chamadas incompletas e recusas não
executam ferramentas. Consumo é registrado por chamada só com metadados; não há
teto financeiro mensal persistente nem limitador de frequência do chat nesta etapa.
O cancelamento não interrompe uma transação de notas já iniciada.

Validação inicial RED: 30 testes falharam, 18 passaram e duas suítes não carregaram
porque os módulos novos ainda não existiam. GREEN final: 164 testes em 13 arquivos, TypeScript e ESLint passaram. A validação usa API simulada e
notas em memória; não chama OpenAI/Gemini nem Supabase reais. Configurar a chave no
ambiente de execução e verificar o comportamento real do modelo continuam pendentes.

## RAG e Wiki Viva — plano para revisão — 21/10/2026

Proposta detalhada em [Bimo - Plano de RAG e Wiki Viva.md](./Bimo%20-%20Plano%20de%20RAG%20e%20Wiki%20Viva.md), com referências à documentação oficial da OpenAI consultada nesta data. O objetivo é adaptar a organização ao que o usuário anota livremente, criando e enriquecendo notas derivadas com sínteses, relações e evidências verificáveis.

O caminho recomendado combina busca textual/semântica no Postgres, embeddings da OpenAI e compilação incremental pela Responses API. O plano compara File Search, descreve snapshots separados do autosave, publicação atômica, isolamento por usuário, fila durável, limites de consumo, avaliação e oito etapas após os contratos iniciais. Inclui um briefing pronto para o Claude revisar. É planejamento; RAG e Wiki Viva ainda não foram implementados.

Validação desta entrega: 132 testes passaram em nove arquivos focados no transporte OpenAI, laço do agente, ferramentas, resolução de notas, helpers HTTP e rota de chat, com APIs simuladas e repositório em memória. TypeScript (`--noEmit --incremental false`) e ESLint dos nove arquivos TypeScript da migração passaram. Essa execução é distinta da validação histórica de 164 testes registrada acima. Não houve inferência real, integração com Supabase ou migração do banco.

## Wiki Viva sob pedido — 22/10/2026

**Registro histórico de um protótipo manual; fluxo não aprovado como produto.** Após esclarecimento do usuário, a wiki deve operar como memória integrada ao agente, criando e enriquecendo notas na base normal. A página separada e a seleção manual de origens foram decisões do assistente. O planejamento funcional revisado está em [Bimo - Plano de RAG e Wiki Viva.md](./Bimo%20-%20Plano%20de%20RAG%20e%20Wiki%20Viva.md); telas e design serão definidos pelo usuário com o Claude. O relato e os resultados de teste abaixo descrevem somente aquele protótipo.

Implementada a primeira versão em `/wiki`, acessível pelo link **Wiki** da página principal em outra aba. O usuário escolhe até dez notas e cria/enriquece uma síntese; a mesma página é reutilizada na atualização. O compilador usa Responses com saída estruturada, valida citações literais e armazena snapshots das fontes e evidências por revisão publicada. As páginas entram no índice, na busca textual e no grafo de notas existente, sem embeddings. A leitura pelo agente informa quando a nota é uma síntese e quando suas fontes mudaram.

As notas pessoais são preservadas. A publicação confere fontes e revisão-base dentro da transação; mudanças nas fontes ou na página durante a geração impedem a gravação. Edição manual da página bloqueia a recompilação, sem retomada automática nesta etapa. As origens anteriores são mantidas ao enriquecer; páginas derivadas não podem virar fontes de outras páginas.

Schema/migração: `paginas_wiki`, `0007_wiki_viva.sql` e snapshot/journal Drizzle gerados sem carregar `.env`. **Migração não aplicada**. O banco só expõe a capacidade de wiki com `WIKI_VIVA_ATIVA=1`, a configurar após revisar/aplicar a migração. Em memória, a capacidade é disponibilizada para desenvolvimento e testes. Não houve chamada real OpenAI/Gemini, acesso ao Supabase ou alteração de dados reais.

TDD: RED inicial por ausência dos módulos de serviço/gerador e, depois, rota/componente (quatro suítes sem coleta, sem testes executados nessa etapa). Os cenários novos cobrem publicação, enriquecimento, concorrência, citações fabricadas, Unicode, preservação das notas, configuração, sessão/origem, índice e interface. RED de comportamento adicional: dois testes falharam (19 passaram) por geração desnecessária em título ocupado e grafia de pasta divergente; ambos passaram após a correção. GREEN final focado: **168 testes em 11 arquivos**, excluindo `.claude/worktrees/**` para não contabilizar outra worktree. TypeScript e ESLint passaram. Cobertura do recorte `src/lib/wiki/*.ts`, `src/app/api/wiki/route.ts` e `WikiViva.tsx`: 100% de linhas, 88,35% de ramificações e 81,48% de funções na medição anterior à inclusão da expansão visual do contexto das fontes. O adaptador SQL foi exercitado com bordas simuladas; isso não comprova locks, rollback ou políticas no Postgres real. A validação de navegador e a qualidade com o modelo real seguem não executadas.

Limites da entrega: compilação manual, uma chamada por pedido, 60 mil caracteres de contexto, cinco pedidos por minuto por instância e prazo de 45 segundos. Não há orçamento persistente, fila/outbox ou varredura automática da base; a automação completa permanece no [plano de RAG e Wiki Viva](./Bimo%20-%20Plano%20de%20RAG%20e%20Wiki%20Viva.md), com embeddings rebaixados a uma melhoria posterior. Nenhum commit ou push foi feito nesta implementação.

## Wiki Viva integrada — planejamento revisado — 22/10/2026

Por orientação do usuário, esta etapa altera somente o planejamento da funcionalidade. A Wiki Viva passa a ser tratada como conhecimento persistente integrado ao ciclo das notas e às conversas: descoberta de conceitos, recuperação textual/por ligações, criação e enriquecimento de sínteses, evidências, atualização incremental, carga da base anterior, fila durável e controle de consumo. Não há exigência de área separada, seleção manual de fontes, taxonomia imposta ou embeddings para a primeira entrega.

O plano foi reescrito com etapas e critérios funcionais para revisão pelo Claude, sem decisões de telas, navegação ou design. O código experimental e a migração preparada permanecem sem alterações nesta revisão documental; não foram removidos, ativados ou considerados aprovados por sua presença no checkout. Não houve nova implementação, migração, inferência, commit ou push.

## Wiki Viva integrada — implementação do backend — 22/10/2026

Implementação autorizada pelo usuário na branch feat/estrutura-llmwiki. Criar/editar/renomear/mover/importar notas registra trabalho transacional; a fila consolida autosaves e reconcilia a base anterior. O compilador descobre conceitos com schema estrito pela Responses API, recupera candidatas por texto/aliases/dependências, cria ou enriquece sínteses na base normal e conserva evidências de raízes pessoais. Atualizações de dependentes seguem ondas limitadas; perguntas e respostas do chat não se tornam fatos automaticamente.

Publicação de nota, histórico, snapshots, conceito e progresso é atômica, com geração/posse e revisões revalidadas. Reserva de tokens por dono/dia UTC antecede chamadas; custo incerto não é estornado como zero. Falha de autenticação interrompe a fila do dono. Edições manuais são protegidas, inclusive se feitas durante a pausa da automação. Gerenciamento tem contrato autenticado com revisão-base para a futura interface; o segredo do executor libera somente seu endpoint. RLS das tabelas operacionais permite apenas leitura direta ao papel authenticated.

Executor independente via npm run wiki:executar e aceleração oportunista após atividade. Migração 0008_wiki_automatica gerada offline e revisada; o índice pai é criado antes das constraints compostas. O protótipo visual anterior foi preservado para o trabalho do Claude e a compilação manual é recusada quando a automação está habilitada. Nenhuma nova tela ou decisão de design foi implementada.

Validação: 1.801 testes passaram em 150 arquivos offline. Após o endurecimento final das políticas e a nova regressão de expiração durante a publicação, 27 testes focados passaram novamente, incluindo dez de SQL real em PGlite descartável, sem Supabase remoto ou modelos reais. A suíte completa não foi repetida após essa última alteração coberta pelo foco. TypeScript, ESLint src/scripts, sintaxe do executor e diff --check passaram. As integrações que leem configuração real foram excluídas; o build não foi executado para evitar leitura automática de .env. Não houve aplicação das migrações no ambiente do usuário, mudança de configuração, ativação paga, commit ou push. Passos de ativação, limites e pendências de avaliação estão em [Wiki Viva — Operação](./Bimo%20-%20Wiki%20Viva%20-%20Operacao.md).

## Wiki Viva — diário, diagnósticos e neurônios — 23/10/2026

As pendências de backend anotadas após a revisão do Claude foram implementadas na `feat/estrutura-llmwiki`, preservando os commits existentes. Por decisão do usuário, novas sínteses nascem na pasta **Neurônios** e o executor ganha GET protegido por `CRON_SECRET`, com Cron diário em `vercel.json` para o plano Hobby. O POST do executor contínuo foi preservado. As telas foram autorizadas, mas dependem do arquivo visual que o usuário enviará; nenhuma tela nova foi desenhada nesta etapa.

Diário transacional por dono, leitura por período/cursor, diagnóstico local periódico sem modelo, estados dos neurônios, pausa com revisão-base e divergências estruturadas foram acrescentados. GET `/api/wiki/cerebro` retorna resumo e índice compacto, GET `/api/wiki/diario` retorna eventos e o detalhe existente informa estado/pausa/alertas. O grafo identifica neurônios e distingue notas, sinapses e ligações entre neurônios, preservando as arestas derivadas do texto. Chat e GrafoDeFundo não foram remontados nem redesenhados.

Snapshots de fontes passam a hashes SHA-256 e trechos citados; a migração **0011_wiki_observabilidade**, gerada offline, inclui o backfill compatível com Unicode. Também foram tratados retirada de ligações, perguntas legadas recuperadas do markdown, raiz explícita para notas homônimas, codificação de delimitadores em pastas existentes, expiração da sonda negativa em 30 segundos e coleta do Vitest restrita ao aplicativo. O teste de cinco mil títulos verifica resultados e limites sem depender de 500 ms de relógio.

Validação offline: **1.945 testes em 163 arquivos**. Após os últimos ajustes, **281 testes focados em 26 arquivos** e, depois da indicação de pausa no contexto do modelo, **41 testes em três arquivos** passaram. TypeScript, ESLint e diff --check passaram. PGlite executou as migrações 0007–0011 e verificou rollback do diário/publicação, RLS, custo, pausa concorrente, backfill, legado e paginação com microssegundos. Não houve Supabase remoto, leitura de `.env`, build, navegador, inferência real, migração de produção, commit ou push. Estado e passos de ativação estão em [Wiki Viva — Pendências](./Bimo%20-%20Wiki%20Viva%20-%20Pendencias.md) e [Wiki Viva — Operação](./Bimo%20-%20Wiki%20Viva%20-%20Operacao.md).

## Wiki Viva — telas do Cérebro, Diário e neurônios — 23/10/2026

Implementadas as telas autorizadas na `feat/estrutura-llmwiki`, usando as 17 pranchas do HTML "Bimo — Wiki Viva conceitos e telas" enviado pelo usuário e os tokens existentes do projeto. Cérebro e Diário abrem na página principal, com contagens reais, cobertura, energia, filtros e paginação por cursor. O detalhe do neurônio mostra afirmações, inferências, sinapses com trechos e revisão, divergências e perguntas em aberto. Citações levam o foco à evidência; origens e relacionados abrem por id. Referências do chat também abrem o detalhe quando a nota tem metadados de neurônio.

Editar usa o editor e o autosave existentes. Pausar, retomar e devolver ao Bimo enviam a revisão lida e mostram conflitos sem repetir a escrita. O texto atual da pessoa é preservado no detalhe mesmo quando o neurônio está pausado. Chat e GrafoDeFundo continuam na mesma árvore; teste de navegação verifica a conservação do rascunho e dos elementos. O grafo distingue tipos de ligação, desenha anel duplo e os seis estados, filtra Só neurônios sem reconstruir a simulação e anima nascimento respeitando movimento reduzido.

Validação: **778 testes em 78 arquivos** no recorte ampliado e **88 testes em seis arquivos** após os ajustes finais; TypeScript sem emissão, ESLint e `git diff --check` passaram. A prévia visual isolada, com APIs simuladas, foi conferida em desktop/celular e temas claro/escuro. Isso não comprova integração autenticada nem o piloto com notas reais. Não houve leitura de `.env`, build, migração remota, inferência paga, commit ou push. A ativação segue os passos do documento de operação.

## Wiki Viva — versionamento por funcionalidade e tela — 23/10/2026

Por solicitação do usuário, a entrega foi separada em commits de testes, correção de wikilinks, backend da Wiki Viva, Cron autenticado, grafo, telas do Cérebro/Diário, detalhe do neurônio, integração com notas/chat e documentação. Os testes acompanham as respectivas alterações. O código validado na etapa anterior foi mantido; os relatos de ausência de commit acima descrevem aquele momento da implementação. Não houve push, migração ou ativação nesta etapa de versionamento.

## Wiki Viva — ativação e piloto em produção — 23/10/2026

Após autorização do usuário para migração, envio protegido da configuração à Vercel e publicação, as migrações 0007–0011 foram aplicadas no Supabase pelo histórico do Drizzle. Backup criptografado das 383 notas e 383 versões foi criado e conferido em `.vercel/wiki-ativacao/backup-1792788194334.json`. A comparação posterior confirmou zero mudanças nas notas originais; o total chegou a 384 pela criação de um neurônio.

Produção em https://bimo-omega.vercel.app, deployment `dpl_B6g2Pve7Bh1zXyAwBsFms7HAVsVS`. Cron habilitado diariamente às 05:00 UTC, flags ligadas e teto de 200.000 tokens/dia. O piloto processou duas notas com `gpt-6-luna`: uma sem novidade e uma com neurônio publicado, consumindo 15.767 tokens confirmados. Resumo, detalhe, fontes compactas, grafo e Diário foram conferidos pela API autenticada; leituras/processamento anônimos recusados com 401. Ao final, 381 notas ainda aguardavam processamento, incluindo as ainda não reconciliadas.

O executor precisou de import compatível com CommonJS de `@next/env` no Node 24. `.vercelignore` passou a excluir credenciais, worktrees, memória de agentes, mobile e temporários do deploy. Build da Vercel e build local com Webpack/TypeScript passaram; Turbopack local encontrou falha de rede/fontes e erro interno de processo no Windows. Sete testes focados de executor/proxy, sintaxe e ESLint passaram. Uma revisão automática inicialmente exigiu autorização explícita para os segredos de produção, posteriormente fornecida; outra consulta foi interrompida por limite da revisão e passou ao ser retomada pelo mesmo fluxo. Não houve push ou novo commit nesta ativação. Detalhes e limites operacionais estão em [Wiki Viva — Operação](./Bimo%20-%20Wiki%20Viva%20-%20Operacao.md).

## Chat — leitura de várias notas e criação de resumo — 24/10/2026

Reproduzida uma interrupção com o agente e `gpt-6-luna` reais, usando três notas fictícias em memória: busca, três leituras e criação consomem cinco chamadas, e o limite anterior de cinco impedia a sexta chamada de confirmar a gravação. A nota era criada, mas a conversa terminava com desistência. O prompt e erro originais do usuário não estavam disponíveis; essa reprodução confirma o defeito do fluxo, sem provar que explica todos os erros observados.

O chat agora admite até 12 chamadas, com a última reservada à resposta final (`tool_choice: none`) e sem executar ferramentas nessa etapa. Prazo do agente ampliado de 45 para 150 segundos, com margem de 180 segundos na rota da Vercel. Cancelamento, revisão-base e deduplicação de escritas foram preservados. Prazo esgotado tem mensagem própria e HTTP 504 no modo JSON; NDJSON conserva os passos já entregues. Logs registram apenas categoria/status da falha. O transporte preserva a causa do cancelamento também durante a leitura do corpo da resposta.

Verificação autenticada posterior no domínio de produção: POST `/api/chat` respondeu HTTP 200 em NDJSON, com resposta final e zero ferramentas, usando pedido curto de conectividade. Essa verificação confirma autenticação/transporte do chat publicado; a criação completa foi validada separadamente com as fontes fictícias, sem criar resumo de teste na base real.

TDD: reproduções offline falharam antes da correção; 137 testes passaram no recorte de nove arquivos de agente, transporte, ferramentas, resolução, API, fluxo e Chat. Após o ajuste final do timeout, 75 testes de quatro arquivos passaram novamente. TypeScript, ESLint dos arquivos alterados e `git diff --check` passaram; revisão independente sem achados pendentes. Repetição com modelo real e repositório fictício concluiu busca, três leituras, uma criação e confirmação em seis chamadas, sem alterar notas reais. Publicação `dpl_9oDxV9AaTukv8gbFfphDGgSUFMn6` pronta na Vercel, com build de 32 segundos e alias `bimo-omega.vercel.app` conferido. Não houve migração, commit ou push nesta correção.

## Integração da Wiki Viva à main — 25/10/2026

Por solicitação do usuário, a revisão de conclusão identificou `feat/estrutura-llmwiki` como pronta para integração: fila, evidências, recuperação, orçamento, diário, diagnósticos, estados, Cron, grafo, telas e correção do chat estão implementados. Os commits separados de funcionalidades e telas são preservados. A correção do chat, a compatibilidade do executor com Node 24 e as exclusões do deploy recebem commits próprios antes do merge.

Validação para integração: **1.969 testes em 165 arquivos** passaram, incluindo persistência SQL em PGlite descartável; TypeScript, ESLint de `src`/`scripts`, sintaxe do executor e `git diff --check` passaram. Foram excluídos os dois testes de integração com banco remoto (`repositorio-de-notas/banco.test.ts` e `tests/busca-textual.integration.test.ts`); não houve nova migração nem chamada paga nesta revisão. A revisão independente não encontrou bloqueadores. README e registros foram alinhados ao estado implementado/ativado, preservando os relatos históricos.

O processamento inicial do acervo, a avaliação ampliada de qualidade/custo e a conferência visual com notas reais permanecem acompanhamentos operacionais, sem serem apresentados como concluídos. `feat/login-multiusuario` continua em desenvolvimento em sua worktree, com alterações não commitadas; não faz parte desta integração. Memória de agentes, worktrees, backup e o documento de pesquisa Obsidian não são adicionados ao versionamento nesta entrega.

## Carga do acervo em lotes — 25/10/2026

Após o relato de poucas notas lidas, a inspeção do código e das contagens em produção confirmou o gargalo: Cron diário e POST do executor processavam apenas um trabalho por chamada. Havia 389 notas pessoais, 18 concluídas, 371 pendentes e dez neurônios, sem erros ou posses ativas. O consumo confirmado do dia era 44.550 de 200.000 tokens; não era bloqueio de orçamento.

Na branch `fix/processamento-acervo-wiki`, GET/POST agora percorrem até 25 rodadas sequenciais, preservando a unidade transacional existente. Novas rodadas param aos 180 segundos, há sinal de prazo aos 240 segundos e a rota dispõe de 300 segundos. O lote também para por orçamento, adiamento, cancelamento ou ausência de trabalho pronto. O executor contínuo acompanha essa duração e registra contagens sem conteúdo das notas. A aceleração oportunista continua em uma rodada para preservar a duração do chat. O teto de 200 mil tokens/dia e o Cron diário Hobby foram mantidos; não há trabalhador permanente entre execuções.

TDD: os dois testes da rota reproduziram a falha anterior (uma leitura concluída e duas pendentes); depois passaram com três leituras no mesmo pedido. **257 testes em 26 arquivos** passaram no recorte ampliado; após os testes adicionais com 389 notas e retomada/publicação no SQL, **51 testes em cinco arquivos** passaram. TypeScript, ESLint, sintaxe do executor e `git diff --check` passaram. Revisão independente sem bloqueadores. Não foi necessária migração. Publicação `dpl_9F4Ljq3jC711Stt4QreCijD4TCXh` pronta em produção, com build de 49 segundos e alias `bimo-omega.vercel.app` conferido.

Um lote real controlado concluiu sete rodadas e cinco publicações. As leituras completas passaram de 18 para 24, os neurônios de dez para 15, com 365 pendentes, duas notas parcialmente lidas e nenhum trabalho impedido ou posse ativa ao final. O consumo diário confirmado chegou a 111.283 tokens, dentro do teto de 200.000. Esses valores são a fotografia da verificação. A retomada automática frequente fora do Cron Hobby foi apresentada ao usuário como decisão de operação: Supabase, executor sempre ligado ou manutenção somente do lote diário. A execução contínua no servidor ainda não foi configurada nesta etapa.

## Modos de energia e análise da granularidade — 25/10/2026

Por solicitação do usuário, o brainstorming de funcionamento foi registrado em [Modos de consolidação e energia](./Bimo%20-%20Modos%20de%20Consolidacao%20e%20Energia.md). Manual, diário, contínuo, seleção, acervo completo e pausa são propostas; não foram implementados nem usados para autorizar um novo agendamento.

A [análise da granularidade](./Bimo%20-%20Analise%20de%20Granularidade%20dos%20Neuronios.md) confronta o código, a referência original LLM Wiki, a documentação de um plugin e conteúdos reais. Na consulta das últimas revisões havia 14 neurônios: 13 com uma fonte, um com duas, três com uma afirmação e dez sem ligações a outros neurônios. Corrige-se a contagem operacional anterior: 15 eram publicações incluindo histórico, não neurônios distintos. Há separações temáticas defensáveis e páginas curtas com pouco ganho aparente sobre a origem. A recomendação é uma política editorial mais sintética, com prioridade a enriquecer/relacionar e critérios para criar; não um mínimo rígido de fontes. Nenhum neurônio ou regra de geração foi alterado nesta análise, e não houve inferência paga, commit ou push.

## Plano de qualidade e critérios dos neurônios — 25/10/2026

Preparado o [plano de qualidade e critérios](./Bimo%20-%20Plano%20de%20Qualidade%20e%20Criterios%20dos%20Neuronios.md), conforme o pedido de planejar a análise dos neurônios e os parâmetros de criação/edição. Por correção explícita do usuário, controle de energia foi retirado deste escopo. O plano cobre inventário individual, utilidade/ganho/destino, decisões de conservar/enriquecer/relacionar/criar/adiar, edição com evidências, risco de duplicar afirmações ao reforçar fontes, parâmetros atuais, testes, comparação controlada e propostas revisáveis para páginas existentes. Não houve nova consulta de produção, geração, alteração de código funcional ou de neurônios, migração, commit ou push.

## Critérios editoriais implementados — 25/10/2026

Executado o [plano de qualidade dos neurônios](./Bimo%20-%20Plano%20de%20Qualidade%20e%20Criterios%20dos%20Neuronios.md). A política `sintetica-v2` exige utilidade, ganho e destino, admite conservar/adiar, distingue alvos lidos de entradas do índice e impede criação com identidade conhecida. Adicionados reforço de evidências com ID lógico preservado e limpeza explícita de perguntas. Publicação parcial preserva as propostas válidas e deixa a origem em revisão na mesma transação, sem declarar cobertura completa. Motivos editoriais ficam no Diário privado e a procedência da política no JSON da publicação existente; nenhuma migração.

[Inventário de 14 neurônios](./Bimo%20-%20Revisao%20Individual%20dos%20Neuronios.md) com prévias por item, sem alteração automática das páginas existentes. [Avaliação com modelo real](./Bimo%20-%20Avaliacao%20da%20Politica%20Editorial.md): 24 casos sintéticos por política, 22/24 decisões adequadas na v2 contra 16/24 anteriormente, 12/14 positivos contra 10/14, e zero publicação redundante negativa contra uma. Permanecem duas omissões conhecidas; a candidata foi calibrada na própria amostra. Reprodução local executou 25 consultas por política, todas com acertos; sem teste integral do chat ou aferição do ranking em produção.

Suíte ampla: 1.997 testes em 167 arquivos; validação focada após ajustes finais: 54 testes, além de TypeScript/ESLint/diff check. Builds locais falharam em infraestrutura Next/Turbopack e Webpack no Windows; build remoto READY em cerca de 27 segundos. Publicação `dpl_GRnCEg18jz9QMhY3NuM28PF8tSpG` promovida em produção, com login HTTP 200 e APIs privadas/execução HTTP 401 sem sessão/segredo. Sem energia, telas, mudança de agendamento ou reprocessamento forçado do acervo. Alterações continuam na branch `fix/processamento-acervo-wiki`, sem commit/push nesta execução.

## Ensaio real após a política v2 — 25/10/2026

A pedido do usuário, executada uma passagem real pela fila com o motor atual do Bimo, Supabase de produção e `gpt-6-luna`. Foram seis notas enviadas ao modelo: cinco conservadas na origem, uma adiada, nenhuma proposta de publicação. A sétima reivindicação parou antes da chamada porque a reserva não cabia no saldo diário. O ensaio usou 48.027 tokens; total diário passou de 111.283 para 159.310, sem elevar teto. Leituras concluídas: 24→29; pendentes: 365→359; em revisão: 0→1; neurônios: 14→14. Conteúdo e revisão das 389 notas pessoais permaneceram intactos.

O [relatório por nota](./Bimo%20-%20Ensaio%20Real%20dos%20Neuronios%20-%202026-10-25.md) separa decisões observadas e julgamento editorial. A conservação dos exercícios duplicados de MDC é defensável; PDFManual e middleware expõem oportunidades de síntese entre código e documentação. No adiamento SuperLógica, o modelo classificou incorretamente uma candidata pessoal já lida como síntese não lida. O ensaio não aprova o resultado apenas por ter evitado publicações: recomenda calibrar distinção origem/destino, divergências e leitura dirigida com estes casos reais, em prévia, antes de reprocessá-los. Snapshot/respostas completos cifrados em `.vercel/ensaio-neuronios/`, ignorados pelo Git. Sem alterações de política, configuração, retomada, agendamento, commit ou push neste ensaio.

## Ajustes editoriais e segunda passagem — 26/10/2026

Por autorização do usuário, implementada a política `sintetica-v3`: papéis explícitos de notas pessoais e neurônios, indicação de leitura parcial, síntese de código com documentação complementar e tratamento contextual de diferenças. Adiamento pode solicitar até três neurônios somente do índice ainda não lidos; o servidor valida IDs/proteções e oferece uma continuação, com no máximo duas chamadas, prazo compartilhado e consumo separado. A fila permite reprocessar explicitamente por ID/revisão sem editar a origem ou reabrir todo o acervo. Mantidos teto diário, agendamento e telas. Nenhuma migração.

Validação atual: **244 testes/24 arquivos da Wiki**, TypeScript, ESLint dos arquivos alterados e diff check passaram. Revisão independente sem bloqueadores. Build remoto `dpl_4DT8PvJpEpu7MwaBYkc68RKtqPL8` READY e promovido em `bimo-omega.vercel.app`; login 200, APIs privadas 401 sem credenciais. Não foi repetida a suíte ampla anterior nem testado o fluxo integral no navegador.

A [segunda passagem real](./Bimo%20-%20Segunda%20Passagem%20dos%20Neuronios%20-%202026-10-26.md) reavaliou as mesmas seis origens na revisão 1: seis chamadas, 55.829 tokens, duas criações (3507/PDF e 3508/middleware), um enriquecimento (3503/listagem), duas conservações e um adiamento. As 389 origens permaneceram intactas; somente o neurônio anterior 3503 recebeu nova revisão. Neurônios 15→17, saldo diário final 70.111. O ponto inicial mudou pelo processamento normal entre ensaios, portanto não é comparação controlada apenas de prompt.

Resultado editorial misto: houve junção de origens e reaproveitamento de destino, mas o PDF inverteu a ordem exclusão/retorno e propôs uma divergência com o mesmo ID dos dois lados, ignorada pelo validador existente. Permanecem citações estreitas para afirmações compostas, conservação discutível de Bling e estados diferentes para exercícios de MDC duplicados. A leitura dirigida não foi acionada no ensaio real, somente validada em testes locais. Essas pendências estão descritas no relatório; não houve correção manual de neurônios nem autorização inferida para reconstrução em massa. Sem commit/push nesta execução.

## Correções de integridade e terceira passagem — 26/10/2026

Executadas as correções autorizadas após a segunda passagem. Política `sintetica-v4` recusa divergência com mesmo ID, ID inexistente/retirado ou par novo acima do teto de dez. Propostas irmãs válidas continuam sendo publicadas sem declarar cobertura integral. Substituição apenas de evidências remapeia a relação antiga; mudar texto/natureza exige reconfirmação explícita do par, impedindo perda silenciosa. Instruções reforçam afirmações específicas, citações completas e ordem do código; notas integralmente iguais são sinalizadas e erro de sintaxe não implica adiamento automático. A validação estrutural não certifica toda a semântica.

O [relatório de correções e terceira passagem](./Bimo%20-%20Correcoes%20e%20Terceira%20Passagem%20-%202026-10-26.md) registra: PDF 3507 corrigido para revisão 2, por proposta revisada sem inferência; quatro origens reavaliadas com modelo real, 41.138 tokens, um enriquecimento do middleware e três conservações. Os exemplos duplicados de MDC agora receberam a mesma decisão, e a origem 2594 saiu de revisão. Bling continua conservada e merece acompanhamento editorial; a ausência de página não prova resolução ideal desse caso.

A passagem revelou perda de relação ao substituir IDs do middleware; o motor foi corrigido, com reprodução RED e testes de preservação/reconfirmação. A divergência foi restaurada em 3508/revisão 3 e a documentação recebeu evidência completa, sem outra inferência. Conferidos snapshots cifrados das três operações: **389 origens intactas, somente 3507 e 3508 alterados, nenhuma criação/exclusão nesta rodada**. Estado final: 17 neurônios, 38 leituras concluídas, 351 pendentes, zero impedidos; consumo diário 171.027 e saldo 28.973, mantendo teto 200.000.

**255 testes/24 arquivos da Wiki, TypeScript, ESLint dos arquivos alterados e diff check passaram**. Revisão independente sem bloqueadores após corrigir teto e CAS operacional. Build final `dpl_3FNSHySPCz1hun2tJouBPQQXn62Z` READY, promovido e confirmado em `bimo-omega.vercel.app`; login 200 e APIs privadas 401 sem credenciais. A inferência real ocorreu antes do último ajuste de remapeamento; o ajuste final foi verificado em testes e na restauração transacional. Sem migração, telas, mudança de energia/agendamento, reconstrução em massa, commit ou push.

## Consolidação para integração à main — 26/10/2026

A pedido do usuário, preparado o [registro consolidado da entrega](./Bimo%20-%20Entrega%20Consolidada%20da%20Wiki%20Viva%20-%202026-10-26.md), com inventário de código/testes/documentos, operação atual, alterações reais no banco, publicações e limites do que será versionado. Operação e pendências foram atualizadas para a política v4 e a cobertura medida de 389 origens, mantendo os relatos dos pilotos como históricos. A referência comparativa com Obsidian permanece identificada como pesquisa de 23/10, sem nova verificação externa nesta consolidação.

Os scripts sintéticos foram incluídos como ferramentas históricas de avaliação: uma geração por caso, continuação bloqueada antes da inferência e reprodução versionada somente em checkout compatível. Não houve nova chamada paga, migração ou alteração de notas nesta consolidação. Código de contas/login e seu plano continuam no checkout separado de `feat/login-multiusuario`, sem integração nesta entrega.

Validação antes dos commits: **2.020 testes passaram em 168 arquivos**, excluindo expressamente as duas integrações destrutivas com Supabase real; TypeScript, ESLint de `src`/`scripts`, sintaxe dos executores e diff check passaram. Os testes de interface emitiram avisos de `act`/layout, sem falha. Conferidos 39 arquivos públicos preparados, sem credenciais reconhecíveis na varredura; arquivos reais de ambiente, `.vercel`, dados privados, memórias e worktrees ficaram fora da seleção. Os commits e a integração remota efetiva são identificados pelo histórico Git.

## Continuar em outro computador

1. `git fetch && git checkout main && git pull`, depois `npm install`. A integração da Wiki Viva e da correção do chat é registrada acima; o login multiusuário continua em desenvolvimento separado.
2. Crie o `.env` a partir de `.env.example`. Valores que faltam num computador novo: `DATABASE_URL` (transaction pooler, porta 6543), `DATABASE_URL_MIGRATIONS` (session pooler, 5432), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (a chave secreta, não a publicável), `USER_ID_PADRAO`, `SENHA_HASH` e `SEGREDO_SESSAO` (`npm run gerar-senha`, `npm run gerar-segredo`), `OPENAI_API_KEY` para o chat e `GEMINI_API_KEY` para rascunho/ingestão. `OPENAI_MODEL` é opcional (padrão `gpt-6-luna`). Nada disso vai para o Git.
3. Os dados já estão no Supabase: as migrações `0000` a `0011` estão aplicadas. As 383 notas pessoais foram preservadas na ativação; novos neurônios são acrescentados pela Wiki Viva.
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

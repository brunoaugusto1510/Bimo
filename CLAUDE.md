# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**Bimo** ("Personal Brain") — a chat UI that reads a real Obsidian vault (hosted in
a GitHub repo) and, in a future step, will let Gemini answer questions from it via
function calling. Everything is in Portuguese (pt-BR): variable/function/type names,
comments, and UI copy. Keep new code in pt-BR to match.

## Commands

```bash
npm install       # install deps
npm run dev       # start dev server at http://localhost:3000
npm run build     # production build (next build)
npm run start     # run the production build
npm run lint      # eslint (eslint.config.mjs, flat config, next/core-web-vitals + next/typescript)
npm run importar-notas -- --limite 3 # simula importação do GitHub para o banco
```

O importador usa `dotenv/config` e exige `VAULT_REPO`, `GITHUB_TOKEN`,
`DATABASE_URL` e `USER_ID_PADRAO` já existentes na configuração. Por padrão,
é simulação: lê GitHub e banco para comparar, mas não grava. Flags:
`--executar` habilita gravações; `--pasta <caminho>` restringe uma subpasta;
`--limite <n>` limita as notas após o filtro; `--sobrescrever` permite substituir
conteúdo divergente com revisão otimista e checkpoint. Sem essa última flag,
divergências são preservadas. Listagem truncada impede `--executar` sem `--pasta`.
Novas notas recebem datas da importação. Falhas ou colisões retornam código 1.
O comando passa `--conditions=react-server` ao `tsx` para carregar `server-only`
fora do Next; imports relativos e o alias `@/` usam `tsconfig.json`.
Tests run on **Vitest** (`vitest.config.mts`, jsdom environment, `@/*` alias via
`vite-tsconfig-paths`): `npm test`, `npm run test:watch`, `npm run test:coverage`.
Test files sit next to the code they cover (`src/lib/sessao.test.ts`,
`src/app/api/login/route.test.ts`, …).

Two helper scripts generate the auth secrets: `npm run gerar-senha` (prints
`SENHA_HASH` for a password read from stdin) and `npm run gerar-segredo` (prints a
`SEGREDO_SESSAO`). `scripts/gerar-senha.mjs` duplicates the scrypt parameters from
`src/lib/senha.ts`; the "aceita um hash gerado com os mesmos parâmetros do script"
test in `senha.test.ts` is what catches the two drifting apart.

### Local setup

Requires a `.env.local` with (there is no `.env.local.example` committed despite
the README mentioning one — check with the user before assuming its shape):

- `VAULT_REPO` — GitHub repo holding the vault, `owner/repo`
- `GITHUB_TOKEN` — PAT with read access to that repo
- `SENHA_HASH` — `scrypt:<salt>:<hash>` of the login password (`npm run gerar-senha`).
  The separator is `:` and not the conventional `$` because `@next/env` runs
  `.env.local` through dotenv-expand, which eats `$...` as a variable reference
- `SEGREDO_SESSAO` — HMAC key that signs the session cookie, 32+ chars
  (`npm run gerar-segredo`)
- `VAULT_BRANCH` — optional, defaults to `main`
- `VAULT_SUBPATH` — optional, subfolder inside the repo where notes live
- `NOTAS_FONTE` — optional, where the notes come from: `github` (default; read-only),
  `memoria` (sample notes in server memory, dev/tests only — refused in
  production) or `banco` (Postgres via Drizzle: needs `DATABASE_URL` + `USER_ID_PADRAO`;
  supports reads, writes and version history). See `src/lib/repositorio-de-notas/config.ts`.

Missing/invalid *vault* env vars don't crash the app — `src/lib/github.ts`'s
`getGitHubConfig()` throws a descriptive error that `src/app/page.tsx` catches and
renders as `ConfiguracaoNecessaria` instead of the main UI. Preserve this
fail-soft pattern when touching config loading.

`SENHA_HASH`/`SEGREDO_SESSAO` are the deliberate exception: they fail
**closed**. `src/lib/senha.ts` and `src/lib/sessao.ts` treat missing, empty or
malformed values as "refuse everything" and answer 503, because the failure mode
of a fail-soft auth gate is serving the whole vault to the internet. Don't "fix"
that into a fail-soft.

## Architecture

Next.js 16 App Router + React 19 + TypeScript (strict) + Tailwind CSS 4.

### Auth

`src/proxy.ts` gates **every** request before any route runs. Next 16 deprecated
`middleware.ts` and renamed it to `proxy.ts` (function named `proxy`, always Node
runtime — setting `runtime` throws). Its `matcher` deliberately does **not**
exclude `api`: `/api/notas/...` serves raw note content, so excluding it would
leave the vault readable. Only `_next/static`, `_next/image` and `favicon.ico`
are exempt, plus the `PUBLICOS` set inside the proxy (`/login`, `/api/login`,
`/api/logout`) which must work *before* a session exists.

The layering, each file knowing only the one below it:

- `senha.ts` — checks the typed password against `SENHA_HASH` (scrypt).
- `sessao.ts` — mints and verifies the signed cookie `bimo_sessao`, shaped
  `<expiresAtMs>.<HMAC>`. Stateless on purpose: no session table, so it survives
  serverless instances that share no memory. Cost: a single session can't be
  revoked — rotate `SEGREDO_SESSAO` to invalidate every session at once.
- `autenticacao.ts` — the HTTP bridge: reads the cookie off the raw header
  (works in both proxy and route handlers, unlike `cookies()` from
  `next/headers`) and turns a refusal into the right response.
- `limite-de-tentativas.ts` — 5 failures per IP per 15 min on `/api/login`.
  In-memory, so per-instance and best-effort: a brake, not a guarantee.

Both API routes *also* call `exigirSessao` themselves. That duplication is
intentional — the Next docs warn that a `matcher` change can silently uncover a
route, so the proxy is the fence, not the only lock.

There is no OAuth and that was a deliberate call: with a single user who already
owns the vault repo, GitHub OAuth would add `next-auth` plus an OAuth App whose
single callback URL breaks Vercel preview deployments, and its one real gain
(no shared secret) barely applies.

### Server/client split

`src/app/page.tsx` is a server component (`dynamic = "force-dynamic"`, no static
caching — the notes can change between visits). It asks `obterRepositorio()` for the
configured source and `obterDadosDaPagina()` (`servico-de-notas.ts`) for the tree and
the link graph: one read of the notes, cached per repository and valid while that
repository's `marcaDeVersao()` is unchanged. Secrets (`GITHUB_TOKEN`, the DB
connection) never reach the client. It hands the result to
`PaginaPrincipal` ("use client"), which owns all interactive state (mode, open note,
focused note, menu, draft text, graph "pulse" counter) and composes the rest of the UI:

```text
page.tsx (server: fetch tree + grafo)
  -> PaginaPrincipal (client: shared state; header has the Bimo | Notas SeletorPill)
       -> BarraLateral   (search + folder/note tree, recursive component)
       -> GrafoDeFundo   (canvas graph, d3-force physics; background OR interactive)
       -> Chat -> Mensagem (stays mounted, only hidden, on the Notas tab)
       -> BarraDoGrafo + CartaoDeFoco (Notas tab overlays: counts/zoom, selected note)
       -> LeitorDeNota   (note content panel, fetches /api/notas/<id> on demand)
```

Two tabs share the **same** `GrafoDeFundo` (so switching never reshuffles the
layout): **Bimo** is the chat with the graph as a faint, breathing background;
**Notas** passes `interativo` — drag the background to pan, wheel/pinch to zoom,
drag a node (neighbours follow via the physics), click a note to select it. The
sidebar on that tab selects the node instead of opening the reader; "Abrir Nota" on
the focus card opens it. `GrafoDeFundo` only owns the animation loop and gestures:
physics is `lib/simulacao-do-grafo.ts`, camera math `lib/camera-do-grafo.ts`
(pure and tested), drawing `components/desenhar-grafo.ts`. Don't put `sr-only`
(position: absolute) inside a scroll container without a `relative` ancestor — it
escapes the clipping and makes the document scrollable, so the chat's
`scrollIntoView` scrolls the whole page.

Notes are identified everywhere by an opaque `IdDeNota` (a string, never parsed by the
UI), not by file path. The HTTP surface, all behind `exigirSessao` (writes also behind
`exigirMesmaOrigem`, JSON only, 1 MB cap, `zod` in `validacao-de-notas.ts`):
`GET/POST /api/notas`, `GET/PATCH /api/notas/[id]` (PATCH carries `revisaoBase` for
optimistic concurrency; a stale one answers 409 with the saved note),
`GET /api/notas/[id]/ligacoes` (links in/out + unlinked mentions — separate from the note
read because it needs *every* note, hundreds of downloads on the GitHub source),
`POST /api/notas/[id]/renomear` (rewrites the `[[links]]` of other notes),
`GET /api/notas/busca?q=` and `GET /api/grafo`. Shared bits live in `http-de-notas.ts`.
Next 16 doesn't allow `[id]` and `[...caminho]` as siblings, which is why the old
catch-all read route is gone.

### Edição e salvamento automático (Fase 8a)

`AbaDeNota` habilita Edição pela `capacidades.escrita` da resposta da nota.
`EditorDeNota` é um textarea de Markdown; título, pasta e tags continuam somente
leitura. `useEdicaoDeNota` mantém texto e revisão confirmada separados, inclusive
ao alternar para Leitura. Abas de notas inativas ficam montadas e ocultas;
Desativar ou sair da edição força checkpoint sem bloquear a UI. Ao desmontar,
a instância descarrega o rascunho, solicita checkpoint e ignora respostas tardias; não apaga cópias de
uma instância nova. O fechamento definitivo avisa se há trabalho pendente.

`edicao/salvamento-automatico.ts` serializa PATCHs, com debounce de 3 s e teto de
30 s, encadeando a revisão devolvida pelo servidor. Texto digitado durante um voo
reagenda o próximo envio com o restante do teto de 30 s, limitado a 3 s; só
forçar/checkpoint pendente permite envio imediato. Rede/5xx/timeout de 20 s usam
recuo de 5/15/30 s, mantido inclusive em aba oculta. Ctrl/Cmd+S fecha a sessão com
checkpoint, inclusive depois de um autosave sem texto novo. Um 409 cujo conteúdo
atual é igual ao enviado é confirmação de resposta perdida: adota a revisão,
preserva texto mais novo e não abre conflito. Conflitos reais suspendem escrita
até escolha explícita: manter (substitui a salva), usar a salva (descarta a local)
ou copiar. Copiar só copia e mantém o conflito; sucesso e falha são anunciados.
413 é recusa sem repetição automática, com saída para copiar ou tentar de novo.

`edicao/rascunho-local.ts` guarda `bimo_rascunho:<id>` a cada 500 ms e descarrega
a cópia ao sair. O storage é não confiável: JSON, tipos, revisão e data são
validados; um rascunho grande ou multibyte nunca é apagado por exceder o limite
do servidor. Cada rascunho tem token de instância; uma confirmação só remove a
cópia que lhe pertence (ou a cópia recuperada ainda idêntica). O evento storage
avisa sobre outra janela; indisponibilidade/cota cheia gera aviso para copiar o texto.
Uma cópia diferente com a mesma revisão oferece Restaurar/Descartar; uma revisão
divergente abre conflito. Só confirmar o mesmo texto apaga a cópia.

`visibilitychange` hidden e `pagehide` tentam checkpoint com `keepalive` pela mesma
fila, só se não há pedido em voo e o JSON completo em UTF-8 cabe em 64 KiB.
Acima disso, ou durante um voo existente, a cópia local é a proteção; há aviso
`beforeunload` enquanto houver trabalho não salvo. Keepalive não garante entrega.

Ligações só são buscadas para a aba ativa, mantendo os dados anteriores durante
recarga (stale-while-revalidate). Salvamentos as recarregam com debounce de 600 ms
somente em checkpoint ou quando muda o conjunto de wikilinks. Ativar uma aba sem
pendência revalida sua nota; escrita do chat com notaId revalida a ativa e atualiza
árvore/grafo. Revisão maior só é adotada automaticamente sem texto pendente.

`AtualizadorDasNotas` vive dentro de `PaginaPrincipal` e consulta
`GET /api/grafo?comArvore=1`, sob exigirSessao, a cada 10 s no máximo. Mescla os
dados pelo estado cliente; falha mantém a árvore inteira e mostra aviso. Não usa
router.refresh(): falhar uma atualização nunca desmonta chat, abas ou editor.
O grafo reaproveita somente x/y/vx/vy, mantendo título/grupo novos e acomodando
nós adicionados. Câmera e conversa permanecem montadas.

O editor normaliza CRLF para LF na entrada, limita novas entradas a 1.000.000
caracteres e foca somente na ação Leitura→Edição. Recuperação tem descrição,
aria-readonly e foco em Restaurar rascunho. Anúncios persistentes não narram cada
estado transitório: Salvo espera 1,5 s (imediato no atalho), erros são alertas
persistentes sem repetição, e a barra de status permite quebra de linha.

### Notes layer (`src/lib/`)

Pure core (no I/O, same code on server and client): `caminho-da-nota.ts` (title/folder
rules), `markdown-da-nota.ts` (frontmatter, tags, headings), `ligacoes.ts` (`[[links]]`:
parse, resolve with a deterministic tie-break, rewrite), `indice-de-ligacoes.ts` (who
links to whom — **derived from the text on read, never mirrored into `relacoes`**),
`grafo-de-notas.ts`, `arvore-de-notas.ts`.

`repositorio-de-notas/` is the storage contract (`tipos.ts`) with `memoria.ts`,
`github-somente-leitura.ts` (wraps `vault-real.ts`; ids are the path in base64url) and
`banco.ts` (Postgres, scoped by user, optimistic revisions and version history).
`config.ts` never imports the DB: `db/cliente.ts` throws on import
without `DATABASE_URL`, so the DB must only be `await import()`ed after the config
passes, or the fail-soft page breaks. Any writable repository must pass
`suite-de-contrato.ts`.

`ferramentas.ts` resolves the configured repository once per tool call (or accepts
an injected repository for tests). Reads and searches use its contract;
`resolver-nota-do-agente.ts` translates approximate paths to opaque ids, refusing
ambiguous titles with up to ten full-path options. Exact paths take precedence
over accent/case normalization; writes never match a title by substring.
`porta-de-escrita-do-agente.ts` selects
writes by capability: writable repositories record agent authorship, closed version
checkpoints and optimistic revisions. Replacing requires `ler_nota` in the same
`responder` call and uses that read revision, without retry on conflict (also
required on GitHub, whose legacy write behavior remains). Only appending retries
one conflict with the latest content, separating text with a blank line and
preserving CRLF. Unexpected tool errors are logged on the server and return a
generic message without SQL or note contents.
Its temporary GitHub adapter keeps the legacy commits until the Phase 10 cutover.
`instrucao-do-agente.ts` generates the system prompt for the configured source.

### Data layer (`src/lib/`)

Layered, each file only knows about the layer below it:

- `github.ts` — thin GitHub REST client. Knows nothing about "notes" or
  "vaults": just repos, trees, blobs. `getGitHubConfig()` reads/validates env vars.
- `vault-real.ts` — lists the GitHub notes (non-`.md` files and Obsidian internals —
  `.obsidian`, `.trash`, `.git` — filtered out), reads, searches and writes them (each
  write is a commit). Owns a module-level, process-lifetime 5-minute cache
  (`obterNotasPlanas`) that the GitHub repository and temporary write adapter build on.

The cache is plain in-memory module state — it resets on restart/redeploy and isn't
shared across serverless instances. Every write through `vault-real.ts` invalidates
it, which also changes `marcaDoCache()` and so renews the tree and graph in the service.

### `etapas-futuras/`

Draft code for the next two roadmap steps (Gemini function-calling agent that reads
*and writes* the vault). It is **excluded from the TypeScript build**
(`tsconfig.json` → `exclude`) and not wired into the app — treat it as a design
reference for the agent loop and tool contracts, not working code to run as-is.

### Design system

The visual source of truth is the "Bimo — Design System" artifact
(https://claude.ai/artifact/BZGehoJQFuhgXiS9M61zfJ; read `project/README.md` and
`project/tokens.json` with the Artifact tool's `read` action). **UI work follows it
by default** — don't invent colors, radii or components it already defines. Its
`project/components/*/README.md` say how each piece is used.

How it lands in this repo (the DS names are the artifact's, the app's are in pt-BR):

- Colors: `azul` → `--destaque` (`bg-destaque`, `text-destaque-texto`), `azul-suave` →
  `--destaque-suave`, `superficie` → `--painel`, `superficie-alt` → `--painel-alt`,
  `bg` → `--fundo`. **Azul is the only action color** (primary button, selection,
  links, note title, focused graph node); text on it is `text-sobre-destaque`.
  The DS only defines a light theme — the dark values in `globals.css` are ours.
  **Theme switching**: the dark values live in a single `:root[data-tema="escuro"]`
  block — never a `@media (prefers-color-scheme)`. `data-tema` is always written by JS
  (`src/lib/tema.ts`): an inline script in `layout.tsx`'s `<head>` sets it before first
  paint from `localStorage["bimo_tema"]` (`sistema` | `claro` | `escuro`), and the
  header's `AlternadorDeTema` cycles the preference. Anything that reads colors outside
  CSS (the graph canvas) must re-read them when `data-tema` changes.
- Type and shape: `text-titulo-nota`, `text-corpo`, `text-meta`, `text-secao`, plus
  `text-controle` (13.5px, ours, for buttons/pills/inputs/tree rows — not in the DS);
  `rounded-bolha`, `rounded-painel`, `rounded-bloco`, `rounded-tag`, `shadow-foco`
  (the DS's only shadow). Actions, chips and switches are pills (`rounded-full`).
- Brand: `MarcaBimo` renders the official brain-graph logo (`src/assets/`, used
  as-is, never recolored) — the DS marks "Bimo speaks" with the logo, not an emoji.
  `BimoPensando` is the DS's "BimoThinking": use it instead of a spinner whenever
  the agent is thinking/searching/suggesting (and only then).
- `texto-suave` (`text-suave`) is below 4.5:1 contrast on purpose, as in the DS:
  metadata and inactive items only, never essential text.
- Not adopted: the graph's per-folder category palette (`--grafo-cor-*`) stays,
  because it is validated for color-blindness; the intro `.mp4` and logo `.png`
  files are still in the old purple.

When the DS changes, re-read its `tokens.json` and update `globals.css` — that file
is the only place values live.

### Styling convention

No component uses a literal color. Every color is a CSS custom property defined
once in `src/app/globals.css` (`:root` for light, overridden inside
`:root[data-tema="escuro"]`), then exposed to Tailwind via `@theme
inline` as classes like `bg-painel`, `text-suave`, `border-borda`, `bg-destaque`.
Add new colors there, never as arbitrary Tailwind values or inline hex.

**Interaction polish** (apply to new buttons/lists): touch targets ≥ 40px (`h-10`/`min-h-10`,
or an `after:-inset-*` pseudo-element when the visible control must stay smaller — as in
`SeletorPill`/`CartaoDeFoco`'s ✕); press feedback `motion-safe:active:scale-[0.96]`
with an explicit `transition-[…]` list (never `transition-all`); `tabular-nums` on any
number that changes (counts); `text-balance` on short headings, `text-pretty` on short
copy; entrances use `motion-safe:animate-entrada` (defined in `globals.css`), exits are
instant. The design system has no shadows besides `shadow-foco`, so don't add any.

**Frontend work must be mobile-first**: write the unprefixed Tailwind classes for
the mobile/base layout, then layer `md:`/`lg:` overrides for larger screens —
never the other way around. `PaginaPrincipal.tsx` already does this (sidebar and
graph panel toggle via a `menuAberto` state + hamburger button that's `md:hidden`,
so on mobile you get one panel at a time instead of a squeezed side-by-side
layout); follow that pattern for new UI rather than designing desktop-first and
retrofitting breakpoints.

### Other conventions worth matching

- Discriminated unions over optional fields for variant data (see `ItemVault` in
  `src/lib/types.ts`: `{ tipo: "pasta" | "nota" }`).
- Recursive components for recursive data (`BarraLateral.tsx`'s `ItemDaArvore`
  renders itself for nested folders).
- Errors are caught close to their source and turned into a `{ tipo: "erro",
  mensagem }`-shaped result rather than thrown across component boundaries (see
  `carregarDadosDaPagina` in `page.tsx`).
- **Vocabulary: say "notas", never "vault", in anything a person reads** — UI copy,
  aria-labels, warnings/errors shown in the UI, and the Gemini system prompt and tool
  descriptions (the agent repeats them to the user). Notes are moving to Bimo's own
  database, so "vault" (the Obsidian/GitHub repo) is leaving the product vocabulary.
  It still survives, on purpose, only in *internal* names that the migration will
  replace: `vault-real.ts`, `ItemVault`, `obterGrafoDoVault`, and the `VAULT_REPO` /
  `VAULT_BRANCH` / `VAULT_SUBPATH` env vars (renaming those now would break the
  deployed `.env`). `BarraLateral.test.tsx` fails if the word reappears in the sidebar.

## Current state / roadmap

The `etapas-futuras/` roadmap (Gemini function calling, then write access) is
implemented. `Chat.tsx` calls `/api/chat`, which runs `src/lib/agente.ts`'s
function-calling loop against `src/lib/ferramentas.ts`'s tools: `buscar_notas`,
`listar_notas`, `ler_nota` (read) and `criar_nota`, `editar_nota` (write), all using
the configured `RepositorioDeNotas`. Bank/memory writes carry agent authorship,
revision checks and note version history; only the temporary GitHub write adapter
still creates commits. The model keeps addressing notes by paths, while successful
writes also pass the opaque `notaId` to the UI. `Mensagem.tsx` renders a pill per
tool used in a turn, linking to the commit only when one was made. The
whole app sits behind a password-protected session (`src/proxy.ts` +
`src/lib/sessao.ts`/`autenticacao.ts`) — this was added independently of the
etapas-futuras roadmap, not part of the original plan.

`etapas-futuras/` itself is now stale as a design reference (the real
implementation diverged in a few places — e.g. it used `"assistant"` where
`types.ts`'s `Papel` uses `"agente"`) — treat `src/lib/` as the source of truth.

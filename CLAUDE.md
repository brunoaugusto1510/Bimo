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
```

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
caching — the vault can change between visits). It fetches the vault tree and the
link graph **in parallel** via `Promise.all`, and is the only place `GITHUB_TOKEN`
is used — the token never reaches the client. It hands the result to
`PaginaPrincipal` ("use client"), which owns all interactive state (mode, open note,
focused note, menu, draft text, graph "pulse" counter) and composes the rest of the UI:

```text
page.tsx (server: fetch tree + grafo)
  -> PaginaPrincipal (client: shared state; header has the Bimo | Notas SeletorPill)
       -> BarraLateral   (search + folder/note tree, recursive component)
       -> GrafoDeFundo   (canvas graph, d3-force physics; background OR interactive)
       -> Chat -> Mensagem (stays mounted, only hidden, on the Notas tab)
       -> BarraDoGrafo + CartaoDeFoco (Notas tab overlays: counts/zoom, selected note)
       -> LeitorDeNota   (note content panel, fetches on demand)
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

`src/app/api/notas/[...caminho]/route.ts` is a catch-all GET route that
`LeitorDeNota` calls on demand to fetch one note's Markdown — this keeps the
token-authenticated GitHub read on the server.

### Data layer (`src/lib/`)

Layered, each file only knows about the layer below it:

- `github.ts` — thin GitHub REST client. Knows nothing about "notes" or
  "vaults": just repos, trees, blobs. `getGitHubConfig()` reads/validates env vars.
- `vault-real.ts` — turns the GitHub file tree into the `ItemVault[]` folder/note
  structure the sidebar renders. Filters out non-`.md` files and Obsidian internals
  (`.obsidian`, `.trash`, `.git`). Owns a module-level, process-lifetime 5-minute
  cache (`obterNotasPlanas`) that both the tree and the graph build on top of.
- `grafo.ts` — downloads note contents (bounded concurrency of 8, capped at 800
  notes) to extract `[[wikilink]]`-style links and build the local graph. Has its
  own separate 5-minute cache.

Both caches are plain in-memory module state — they reset on restart/redeploy and
aren't shared across serverless instances. Any future write path (creating/editing
notes) needs to explicitly invalidate them.

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
- Type and shape: `text-titulo-nota`, `text-corpo`, `text-meta`, `text-secao`;
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
`@media (prefers-color-scheme: dark)`), then exposed to Tailwind via `@theme
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
`listar_notas`, `ler_nota` (read) and `criar_nota`, `editar_nota` (write — each
a real commit via `src/lib/github.ts`'s `putFile`). `Mensagem.tsx` renders a
pill per tool used in a turn, linking to the commit when one was made. The
whole app sits behind a password-protected session (`src/proxy.ts` +
`src/lib/sessao.ts`/`autenticacao.ts`) — this was added independently of the
etapas-futuras roadmap, not part of the original plan.

`etapas-futuras/` itself is now stale as a design reference (the real
implementation diverged in a few places — e.g. it used `"assistant"` where
`types.ts`'s `Papel` uses `"agente"`) — treat `src/lib/` as the source of truth.

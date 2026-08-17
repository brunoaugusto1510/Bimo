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

There is no test suite yet (no test runner installed, no `*.test.*`/`*.spec.*`
files) — do not assume Jest/Vitest is available.

### Local setup

Requires a `.env.local` with (there is no `.env.local.example` committed despite
the README mentioning one — check with the user before assuming its shape):

- `VAULT_REPO` — GitHub repo holding the vault, `owner/repo`
- `GITHUB_TOKEN` — PAT with read access to that repo
- `BASIC_USER` / `BASIC_PASS` — basic-auth credentials that gate the whole app
- `VAULT_BRANCH` — optional, defaults to `main`
- `VAULT_SUBPATH` — optional, subfolder inside the repo where notes live

Missing/invalid *vault* env vars don't crash the app — `src/lib/github.ts`'s
`getGitHubConfig()` throws a descriptive error that `src/app/page.tsx` catches and
renders as `ConfiguracaoNecessaria` instead of the main UI. Preserve this
fail-soft pattern when touching config loading.

`BASIC_USER`/`BASIC_PASS` are the deliberate exception: they fail **closed**.
`src/lib/autenticacao.ts` treats missing-or-empty credentials as "refuse
everything" and returns 503, because the failure mode of a fail-soft auth gate is
serving the whole vault to the internet. Don't "fix" that into a fail-soft.

## Architecture

Next.js 16 App Router + React 19 + TypeScript (strict) + Tailwind CSS 4.

### Auth

`src/proxy.ts` gates **every** request with basic auth before any route runs.
Next 16 deprecated `middleware.ts` and renamed it to `proxy.ts` (function named
`proxy`, always Node runtime — setting `runtime` throws). Its `matcher`
deliberately does **not** exclude `api`: `/api/notas/...` serves raw note
content, so excluding it would leave the vault readable. Only `_next/static`,
`_next/image` and `favicon.ico` are exempt.

Both API routes *also* call `verificarCredenciais` themselves. That duplication
is intentional — the Next docs warn that a `matcher` change can silently uncover
a route, so the proxy is the fence, not the only lock.

### Server/client split

`src/app/page.tsx` is a server component (`dynamic = "force-dynamic"`, no static
caching — the vault can change between visits). It fetches the vault tree and the
link graph **in parallel** via `Promise.all`, and is the only place `GITHUB_TOKEN`
is used — the token never reaches the client. It hands the result to
`PaginaPrincipal` ("use client"), which owns all interactive state (open note, menu,
draft text, graph "pulse" counter) and composes the rest of the UI:

```text
page.tsx (server: fetch tree + grafo)
  -> PaginaPrincipal (client: shared state)
       -> BarraLateral   (folder/note tree, recursive component)
       -> GrafoDeFundo   (canvas graph behind the chat, d3-force physics)
       -> Chat -> Mensagem
       -> LeitorDeNota   (note content panel, fetches on demand)
```

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

### Styling convention

No component uses a literal color. Every color is a CSS custom property defined
once in `src/app/globals.css` (`:root` for light, overridden inside
`@media (prefers-color-scheme: dark)`), then exposed to Tailwind via `@theme
inline` as classes like `bg-painel`, `text-suave`, `border-borda`, `bg-destaque`.
Add new colors there, never as arbitrary Tailwind values or inline hex.

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

## Current state / roadmap

Per the README, the project is at "Etapa 3": real vault browsing + graph, but
`Chat.tsx` still returns a hardcoded fake reply on a `setTimeout` — there is no
real model call yet. Next steps: wire `@google/genai` (Gemini) with function
calling using `etapas-futuras/` as the draft (search → read → answer, citing note
paths), then allow the agent to create/edit notes as real commits to the vault repo.

Note: `BarraLateral.tsx`'s sidebar subtitle still says "dados de exemplo" (example
data) even though the tree is real vault data now — leftover copy from an earlier
stage, not a functional issue.

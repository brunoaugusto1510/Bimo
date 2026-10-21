# CLAUDE.md

Rules for working in this repository. Keep this file to rules and conventions only —
progress, phase status and implementation history go to
`docs/Bimo - Plano de Notas no Banco.md`, never here.

@AGENTS.md

## Project

**Bimo** ("Personal Brain") — a chat UI over the user's notes, with a GPT-6 Luna agent that
reads and writes them through the OpenAI Responses API. Gemini still handles editor drafts and ingestion. Everything is in Portuguese (pt-BR):
variable/function/type names, comments and UI copy. Keep new code in pt-BR to match.

## Commands

```bash
npm install                            # install deps
npm run dev                            # dev server at http://localhost:3000
npm run build                          # production build
npm run start                          # run the production build
npm run lint                           # eslint (flat config, next/core-web-vitals + next/typescript)
npm test                               # Vitest (also test:watch, test:coverage)
npm run gerar-senha                    # prints SENHA_HASH for a password read from stdin
npm run gerar-segredo                  # prints a SEGREDO_SESSAO
```

- Vitest runs in jsdom with the `@/*` alias; test files sit next to the code they cover.
- `scripts/gerar-senha.mjs` duplicates the scrypt parameters of `src/lib/senha.ts`; the
  "aceita um hash gerado com os mesmos parâmetros do script" test catches drift. Change
  both together.
- `banco.test.ts` and the other integration suites run against the real Supabase
  database (they create and delete ephemeral users); never point them at production.
- **Integration tests must never use `USER_ID_PADRAO`** (the real user): their `afterAll`
  deletes everything owned by the test users, and a test that used it wiped the real notes
  on every `npm test`. Create ephemeral users through the Admin API and delete only theirs.

## Environment

Variables are documented in `.env.example`. Never print or read the `.env` values.

- `SENHA_HASH` uses `:` as separator (`scrypt:<salt>:<hash>`), not `$`, because
  `@next/env` runs the file through dotenv-expand, which eats `$...`.
- `NOTAS_FONTE` picks the source: `banco` (default; needs `DATABASE_URL` +
  `USER_ID_PADRAO`) or `memoria` (dev/tests, refused in production). `github` was
  removed and is a configuration error.
- Missing/invalid notes config must fail **soft**: config errors become
  `ConfiguracaoNecessaria`, not a crash. Preserve this when touching config loading.
- `SENHA_HASH`/`SEGREDO_SESSAO` fail **closed** on purpose (503 when missing or
  malformed). Never "fix" that into fail-soft.
- `src/lib/repositorio-de-notas/config.ts` must never import the DB: `db/cliente.ts`
  throws on import without `DATABASE_URL`, so the DB is only `await import()`ed after
  the config passes.

## Architecture rules

Next.js 16 App Router + React 19 + TypeScript (strict) + Tailwind CSS 4. Read the
relevant guide in `node_modules/next/dist/docs/` before using a Next API (see AGENTS.md).

### Auth

- `src/proxy.ts` (Next 16's replacement for `middleware.ts`; function named `proxy`,
  always Node runtime — setting `runtime` throws) gates **every** request. Its
  `matcher` must not exclude `api`. Only `_next/static`, `_next/image`, `favicon.ico`
  and the `PUBLICOS` set (`/login`, `/api/login`, `/api/logout`) are exempt.
- Every API route also calls `exigirSessao` itself; writes also call
  `exigirMesmaOrigem`. The proxy is the fence, not the only lock — keep both.
- Layering: `senha.ts` → `sessao.ts` (stateless signed cookie `bimo_sessao`; revoke all
  sessions by rotating `SEGREDO_SESSAO`) → `autenticacao.ts` (reads the cookie from
  the raw header) and `limite-de-tentativas.ts` (in-memory, best effort).
- No OAuth: deliberate decision (single user; OAuth would break Vercel previews).

### Notes

- Notes are identified by an opaque `IdDeNota` everywhere. The UI never parses it.
- Everything above storage talks only to `RepositorioDeNotas`
  (`repositorio-de-notas/tipos.ts`). Any writable repository must pass
  `suite-de-contrato.ts`.
- `[[links]]` are derived from the text on read (`indice-de-ligacoes.ts`), **never
  mirrored into `relacoes`**.
- The DB repository must filter every query by `user_id` (the app connects as the DB
  owner, so RLS does not protect it).
- Every write carries `revisaoBase` (optimistic concurrency). A stale one answers 409
  with the saved note. Never overwrite silently and never auto-resolve a real conflict;
  a 409 whose content equals what was just sent is a lost response — adopt the revision
  instead of showing a conflict.
- Saving and renaming the same note go through the single queue in
  `edicao/salvamento-automatico.ts`; never send concurrent writes for one note.
- Write routes: JSON only, 1 MB cap, validated with `zod` (`validacao-de-notas.ts`);
  shared bits live in `http-de-notas.ts`. Next 16 forbids `[id]` and `[...caminho]` as
  siblings.

### Client state

- `PaginaPrincipal` owns the interactive state; `EspacoDeTrabalho` keeps **one stable
  React tree** across the Bimo and Notas modes. `Chat` and `GrafoDeFundo` must never
  remount (it loses the conversation and reshuffles the graph): no `key` or new branch
  around them.
- Never use `router.refresh()` to update the tree or graph — a failed refresh unmounts
  the app. `AtualizadorDasNotas` fetches `GET /api/grafo?comArvore=1` and merges in
  client state.
- Tabs of notes created in this session stay protected by `notasLocais` until a listing
  started after their creation contains them; `descartar-inexistentes` only receives
  server ids.
- `localStorage` is untrusted input: validate everything read from it, never let a
  read throw, and never delete a draft just because it is large.
- Keyboard shortcuts go through `combinaAtalho` (`atalhos.ts`); never match by
  `event.code` when `event.key === "Dead"` (Option+N is the tilde dead key on macOS).
- Don't put `sr-only` (position: absolute) inside a scroll container without a
  `relative` ancestor — it escapes the clipping and makes the whole page scroll.
- Anything that reads colors outside CSS (the graph canvas) must re-read them when
  `data-tema` changes.

### Agent

- `ferramentas.ts` resolves the configured repository per tool call; the model keeps
  addressing notes by path, resolved by `resolver-nota-do-agente.ts` (exact path first;
  ambiguous titles are refused with options; writes never match a title by substring).
- `editar_nota` in replace mode requires a `ler_nota` of that note in the same
  `responder` call and uses that read's revision, with no retry on conflict.
- Unexpected tool errors are logged on the server and return a generic message — never
  SQL or note contents to the model or the UI.

## Design system

The visual source of truth is the "Bimo — Design System" artifact
(https://claude.ai/artifact/BZGehoJQFuhgXiS9M61zfJ; read `project/README.md` and
`project/tokens.json` with the Artifact tool's `read` action). UI work follows it —
don't invent colors, radii or components it already defines.

- Colors: `azul` → `--destaque` (`bg-destaque`), text in blue → `--destaque-texto`
  (`text-destaque-texto`), `azul-suave` → `--destaque-suave`, `superficie` → `--painel`,
  `superficie-alt` → `--painel-alt`, `bg` → `--fundo`. **Azul is the only action
  color**; text on it is `text-sobre-destaque`.
- Theme: dark values live in a single `:root[data-tema="escuro"]` block — never
  `@media (prefers-color-scheme)`. `data-tema` is always written by JS (`src/lib/tema.ts`).
- Type and shape: `text-titulo-nota`, `text-corpo`, `text-meta`, `text-secao`,
  `text-controle` (13.5px, ours); `rounded-bolha`, `rounded-painel`, `rounded-bloco`,
  `rounded-tag`, `shadow-foco` (the only shadow). Actions, chips and switches are pills.
- `MarcaBimo` renders the official logo as-is (never recolored). `BimoPensando` replaces
  a spinner whenever the agent is thinking — and only then.
- `text-suave` is below 4.5:1 on purpose: metadata and inactive items only, never
  essential or interactive text.
- The graph keeps its per-folder palette (`--grafo-cor-*`, validated for color blindness).
- `globals.css` is the only place values live; when the DS changes, re-read its
  `tokens.json` and update it.

## Styling rules

- No literal colors in components. Every color is a CSS custom property in
  `src/app/globals.css`, exposed via `@theme inline`. Never arbitrary Tailwind values or
  inline hex.
- Mobile-first: unprefixed classes for mobile, then `md:`/`lg:` overrides.
- Touch targets ≥ 40px (`min-h-10`, or an `after:-inset-*` pseudo-element); press
  feedback `motion-safe:active:scale-[0.96]` with an explicit `transition-[…]` list
  (never `transition-all`); `tabular-nums` on changing numbers; `text-balance` on short
  headings, `text-pretty` on short copy; entrances `motion-safe:animate-entrada`, exits
  instant; no shadows besides `shadow-foco`.
- Disabled controls that must keep focus use `aria-disabled` and must also look
  disabled (`aria-disabled:` variants).

## Code conventions

- Discriminated unions over optional fields for variant data (e.g. `ItemDeNotas` in
  `src/lib/types.ts`: `{ tipo: "pasta" | "nota" }`).
- Recursive components for recursive data (`BarraLateral`'s `ItemDaArvore`).
- Catch errors close to their source and turn them into a `{ tipo: "erro", mensagem }`
  result instead of throwing across component boundaries (`carregarDadosDaPagina` in
  `page.tsx`).
- **Vocabulary: say "notas", never "vault", in anything a person reads** — UI copy,
  aria-labels, UI errors, the Gemini system prompt and tool descriptions. Don't use it in
  code or comments either. `BarraLateral.test.tsx`, `instrucao-do-agente.test.ts` and the
  tool-declaration tests fail if the word reappears.

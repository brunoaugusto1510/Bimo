# Tech Stack

*Document the core technologies, versions, and deployment details here.*

## Inventário verificado em 26/10/2026

Ingestão local da árvore de trabalho em `main`, base `99e0cc8`, com alterações em andamento. As versões abaixo vêm do lockfile da raiz; não representam uma inspeção da hospedagem nem de pacotes carregados em processos ativos.

| Camada | Tecnologia | Versão no lockfile |
| --- | --- | --- |
| Aplicação web | Next.js, App Router | 16.3.1 |
| Interface web | React / React DOM | 19.2.8 |
| Tipagem web | TypeScript, modo estrito | 5.9.3 |
| Estilos web | Tailwind CSS | 4.3.3 |
| Persistência | Drizzle ORM + PostgreSQL | Drizzle 0.45.2 |
| Integração Supabase | `@supabase/supabase-js` | 2.112.4 |
| Geração complementar | `@google/genai` | 2.17.1 |
| Testes web | Vitest | 3.2.7 |
| Banco descartável dos testes | PGlite | 0.5.11 |

O chat e a Wiki Viva usam um transporte próprio para a Responses API da OpenAI. A geração de rascunhos e o pipeline de ingestão de fontes usam Gemini. Modelos e credenciais dependem da configuração do ambiente; a ingestão da MemWiki não leu `.env` nem testou provedores.

## Organização do repositório

| Caminho | Responsabilidade |
| --- | --- |
| `src/app/` | Páginas e rotas HTTP da aplicação web |
| `src/components/` | Espaço de trabalho, editor, chat, grafo e telas da Wiki Viva |
| `src/lib/repositorio-de-notas/` | Contrato das notas, implementação no banco e memória descartável |
| `src/lib/wiki/` | Geração, política editorial, evidências, fila, orçamento, recuperação e observabilidade |
| `src/lib/db/` e `drizzle/` | Schema e migrações SQL; há arquivos de migração de 0000 a 0011 |
| `scripts/` | Executor da wiki, avaliação editorial e geração de credenciais |
| `mobile/` | Aplicativo Expo com dependências, estado e testes próprios |
| `.memory/wiki/` | Memória dos agentes, páginas de domínio e documentação migrada |

O inventário desta execução contou 372 arquivos em `src` (171 arquivos de testes), 7 em `scripts`, 155 em `mobile` (32 arquivos de testes), 25 em `drizzle`, 5 em `public` e um arquivo de instruções em `.github`. Essas são contagens de arquivos, não resultados de testes. Dependências, saídas geradas e dados locais de infraestrutura ficaram fora do inventário.

## Mobile

O manifesto de `mobile/` declara Expo `~57.0.18`, React Native `0.86.3`, React `19.2.3`, Expo Router `~57.0.17`, Zustand `^5.0.15`, TypeScript `~6.0.3` e Jest `^29.7.0`. Essas versões são do manifesto mobile, separado do lockfile web. O provedor de serviços usa implementações simuladas por padrão; confira a [página mobile](dominios/mobile.md) antes de assumir integração com o backend web.

## Comandos e verificação

- Desenvolvimento web: `npm.cmd run dev`.
- Testes web: `npm.cmd test`; a seleção precisa distinguir testes locais das integrações com banco real.
- Tipagem web: `npx.cmd tsc --noEmit`; lint: `npx.cmd eslint src scripts`.
- Testes locais da Wiki Viva usam também PGlite. As suites de integração remota exigem ambiente próprio e autorização para acesso externo.
- Mobile: use o diretório `mobile/`, com `npm.cmd test` para Jest e `npm.cmd run lint` para Expo.
- `npm.cmd run wiki:executar` processa a wiki do aplicativo e pode gastar tokens. `npm.cmd run db:migrate` altera o banco. Esses comandos não fazem parte de uma ingestão documental da MemWiki.
- `npm.cmd run build` usa o ambiente do Next; não é necessário para verificar uma alteração apenas nesta wiki.

`vercel.json` configura o Cron de processamento às 05:00 UTC diariamente. O arquivo versionado informa intenção de agendamento, sem provar a execução na hospedagem. Não há workflow de CI encontrado em `.github/workflows` neste inventário; `.github/copilot-instructions.md` contém instruções para agentes.

Fontes locais: [manifesto web](../../package.json), [lockfile web](../../package-lock.json), [manifesto mobile](../../mobile/package.json), [Vitest](../../vitest.config.mts), [TypeScript web](../../tsconfig.json), [Cron](../../vercel.json) e [mapa dos domínios](index.md).


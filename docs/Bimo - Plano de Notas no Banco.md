# Bimo — Plano: notas no banco, espaço de trabalho e edição automática

Branch: `feat/notas-por-id`. Última atualização: 19/10/2026.

## Objetivo

Levar ao app as 4 telas de desktop do design (Abrir nota com abas, Nova nota, Nenhuma nota aberta, Ir para nota — Ctrl+O), **sem modal**, no estilo do Obsidian, com as notas guardadas **no banco do Bimo** (Supabase/Drizzle) em vez do repositório do GitHub, e com **salvamento automático**. As telas de celular estão fora do escopo.

## Decisões

- As notas moram no banco do Bimo (tabelas `nos`, `notas`, `versoes_nota`). O GitHub vira origem da importação e, depois do corte, arquivo.
- Salvamento automático, sem botão de salvar.
- Toda nota é identificada por um **id opaco** (string que a interface nunca interpreta), não pelo caminho. No banco é o `id` numérico da nota em texto; no adaptador do GitHub é o caminho em base64url.
- As **ligações `[[x]]` são derivadas do texto na leitura**; nunca são espelhadas na tabela `relacoes`.
- Concorrência otimista: toda gravação leva a `revisaoBase`; se a nota mudou desde então, a resposta é conflito com a versão salva.
- Fonte das notas escolhida por `NOTAS_FONTE`: `github` (padrão até o corte, interface só leitura), `memoria` (dev e testes, recusada em produção) e `banco`.
- `SENHA_HASH` e `SEGREDO_SESSAO` falham fechado (503); as variáveis de notas falham suave (tela "falta configurar").
- Tudo em pt-BR (código, comentários, interface). Em texto que uma pessoa lê, diz-se "notas", nunca "vault".

## Fases

| Fase | O que é | Situação |
| --- | --- | --- |
| 1 | Núcleo puro: caminho, Markdown, ligações, índice de ligações, grafo, árvore | Feita |
| 2 | Contrato `RepositorioDeNotas`, repositório em memória, adaptador do GitHub, serviço com cache, suíte de contrato | Feita |
| 3 | Rotas `/api/notas`, `/api/grafo` e interface por id | Feita |
| 4 | Repositório no banco (`banco.ts`) e migração `0006` | Feita |
| 5 | Importador `npm run importar-notas` | Feita (importação real executada: 383 notas) |
| 6 | Agente (Gemini) lendo e escrevendo pelo repositório configurado | Feita |
| 7 | Espaço de trabalho de leitura: abas, navegação, Ctrl+O, painel lateral, prévia de ligação | Feita |
| 8a | Edição com salvamento automático | Feita |
| 8b | Nota nova: Alt+N, "Criar nota" pela paleta (Ctrl+Enter), criar pela ligação `[[x]]` | Feita |
| 9 | Extras do editor: autocompletar `[[` e `#`, menu `/`, rascunho do Bimo; editar título (renomear), pasta e tags | A fazer |
| 10 | Corte para o banco e limpeza | A fazer |

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

### Fase 9 — extras do editor

- Autocompletar ao digitar `[[` (notas) e `#` (tags), menu `/`, rascunho do Bimo dentro da nota.
- Editar título (rota de renomear já existe e reescreve as ligações das outras notas), pasta e tags pela interface.

### Fase 10 — corte e limpeza (pede confirmação antes)

- `NOTAS_FONTE=banco` vira o padrão e a edição no Obsidian/GitHub para, para os dois lados não divergirem.
- Remover `vault-real.ts`, o adaptador somente leitura do GitHub, a porta temporária de escrita do agente e `etapas-futuras/`.
- Trocar as menções restantes a "vault" por "notas" nos nomes internos e renomear as variáveis `VAULT_*` com cuidado (quebram o `.env` já implantado).
- Decidir se o GitHub vira só arquivo ou ganha uma exportação periódica.

## O que cada peça faz

- `src/lib/repositorio-de-notas/` — contrato (`tipos.ts`), `banco.ts`, `memoria.ts`, `github-somente-leitura.ts`, `suite-de-contrato.ts` (qualquer repositório que aceita escrita precisa passar), `config.ts` e `index.ts` (escolhe a fonte).
- `banco.ts` — escritas serializadas por usuário (lock consultivo na transação, com timeouts), gravação por revisão base, histórico em `versoes_nota` (o salvamento automático reaproveita a versão da sessão aberta do usuário; o checkpoint a fecha; edições do agente abrem versão própria), renomear e mover pasta reescrevem as ligações das outras notas na mesma transação, busca com `portugues_sem_acento`.
- `scripts/importar-notas.ts` + `src/lib/importacao-de-notas.ts` — copia as notas do GitHub para o banco. Simula por padrão; só grava com `--executar`; repetir não duplica; divergentes só são sobrescritas com `--sobrescrever`.
- `src/lib/agente.ts`, `ferramentas.ts`, `porta-de-escrita-do-agente.ts`, `resolver-nota-do-agente.ts` — o agente continua endereçando por caminho (`Pasta/Título.md`); `substituir` exige ter lido a nota na conversa; escrita nunca resolve por trecho do título.
- `src/lib/espaco-de-trabalho/` e `src/components/` — estado das abas (reducer puro), persistência, hooks `useEspacoDeTrabalho`/`useNota`/`useLigacoes`, e os componentes do espaço de trabalho.

## Continuar em outro computador

1. `git fetch && git checkout feat/notas-por-id && git pull`, depois `npm install`.
2. Crie o `.env` a partir de `.env.example`. Valores que faltam num computador novo: `DATABASE_URL` (transaction pooler, porta 6543), `DATABASE_URL_MIGRATIONS` (session pooler, 5432), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (a chave secreta, não a publicável), `USER_ID_PADRAO`, `GITHUB_TOKEN`, `VAULT_REPO`, `SENHA_HASH` e `SEGREDO_SESSAO` (`npm run gerar-senha`, `npm run gerar-segredo`), `GEMINI_API_KEY`. Nada disso vai para o Git.
3. Os dados já estão no Supabase: as migrações `0000` a `0006` estão aplicadas e as 383 notas foram importadas. A importação é idempotente, então repetir não duplica.
4. Para ver as notas do banco: `NOTAS_FONTE=banco npm run dev` (ou ponha `NOTAS_FONTE=banco` no `.env`).
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

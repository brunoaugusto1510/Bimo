# Bimo - Retrieval (Fase 4)

> Documento de trabalho da Fase 4 do roadmap (ver [Bimo - Visão e Direção do Projeto.md](./Bimo%20-%20Vis%C3%A3o%20e%20Dire%C3%A7%C3%A3o%20do%20Projeto.md), seção 22).

---

## Checklist da Fase 4

- [x] Busca textual
- [ ] Embeddings
- [ ] pgvector
- [ ] Busca semântica
- [ ] Busca por relações
- [ ] Reranking
- [ ] Context assembly
- [ ] Citações

Ordem combinada: busca textual (base barata, zero dependência nova) → embeddings → pgvector → busca semântica → busca por relações → reranking → context assembly → citações.

---

## Decisão 1 — Busca textual: full-text search nativo do Postgres

Planejada pelo agente **planner** e implementada pelo agente **tdd-guide** (primeira vez nesta sessão usando a administração de agentes do plugin ECC para uma feature completa, do plano à implementação e revisão).

Full-text search sobre `notas` (título+tags+conteúdo) e `entidades` (nome+aliases+tipo), via **coluna `tsvector` gerada (STORED) + índice GIN**, sem nenhuma dependência npm nova (Princípio 9 do doc de visão).

**Coluna gerada, não índice funcional**: `ts_rank`/`ts_headline` (trecho destacado) precisam do vetor já materializado — com índice funcional direto em `to_tsvector(...)`, o Postgres recalcularia o vetor do zero pra cada linha candidata só pra ranquear/destacar, justamente o custo que o índice deveria evitar. Custo aceito: a coluna nova trafegaria em toda leitura se não fosse projetada explicitamente — por isso `obterNota`/`listarNotas`/`obterEntidade`/`listarEntidades` (e, depois da revisão, também `criarNota`/`atualizarNota`/`criarEntidade`/`atualizarEntidade`) agora selecionam colunas explícitas em vez de `db.select()`/`.returning()` genéricos, e os tipos `Nota`/`Entidade` viraram `Omit<..., "vetorBusca">`.

**Configuração de texto `public.portugues_sem_acento`** (`portuguese` + `unaccent` no mapeamento): `portuguese` puro faz stemming mas não remove acento ("codigo" não acharia "código"); `simple` não faz stemming nenhum. A combinação resolve os dois. `CREATE EXTENSION unaccent` funcionou sem restrição de permissão no Supabase — não foi preciso o fallback pra `'portuguese'` puro que ficou documentado como plano B.

**Função `public.texto_de_lista(text[])`, `IMMUTABLE`**: necessária porque `tags`/`aliases` são arrays e as formas óbvias de virar texto (`array_to_string` direto) são `STABLE`, recusadas pelo Postgres em coluna gerada/índice.

**Migrations**: `drizzle/0004_busca_textual_infra.sql` (extensão, configuração de texto, função — custom, escrita à mão, drizzle-kit não gera nenhum desses três) e `drizzle/0005_busca_textual_colunas.sql` (coluna gerada + índices GIN nas duas tabelas — gerada por `drizzle-kit generate` e aplicada sem correção manual). Verificado com `explain analyze` que a busca usa *Bitmap Index Scan* nos índices novos.

**API** — [src/lib/busca-textual.ts](../src/lib/busca-textual.ts): `buscarNotasPorTexto`, `buscarEntidadesPorTexto`, `buscarNoConhecimento`. Módulo novo, não uma extensão de `notas.ts`/`entidades.ts` (a busca é transversal aos dois domínios, e `buscarNotas` já existe em `vault-real.ts`, o legado do GitHub). `websearch_to_tsquery` (nunca `plainto_tsquery`) — aceita `"frases"`/`-exclusão` e nunca lança erro de sintaxe com entrada livre de usuário/agente. `buscarNoConhecimento` devolve `{ notas, entidades }` **sem achatar** num ranking único: `ts_rank` de tabelas diferentes não é comparável — combinar os dois é trabalho do item "Reranking", mais adiante nesta mesma fase.

**Teste de integração real** — primeira vez que um teste *versionado* do repo toca o Supabase de verdade (`src/lib/tests/busca-textual.integration.test.ts`, `describe.skipIf(!process.env.DATABASE_URL)`), decisão tomada com o usuário porque nem mock prova stemming, remoção de acento, uso do índice GIN ou isolamento por usuário. Confirma: busca sem acento acha conteúdo acentuado, stemming plural/singular, título ranqueia acima de corpo, isolamento total entre dois usuários (um efêmero, criado via Supabase Admin API e removido no fim), trecho com `**destaque**` sem HTML.

**Revisão** (agentes **code-reviewer** e **security-reviewer**, em paralelo): 0 CRITICAL, 0 HIGH. Corrigidos antes de fechar:
- Vazamento de `vetorBusca` nas escritas (`criarNota`/`atualizarNota`/`criarEntidade`/`atualizarEntidade` faziam `.returning()` sem projeção — a leitura já tinha sido corrigida, a escrita não).
- `describe.skipIf` só pula a *execução* de `it`/hooks, não o corpo do `describe` — `getConfigStorage()`/`createClient(...)` e a validação de `USER_ID_PADRAO` foram movidos pra dentro do `beforeAll`, senão um ambiente sem `SUPABASE_URL`/chave quebraria a coleta de testes mesmo com `DATABASE_URL` ausente.
- `afterAll` do teste de integração agora limpa cada recurso independentemente (try/catch por passo) — antes, uma falha no meio (ex.: usuário efêmero nunca criado) podia abortar o resto da limpeza e deixar lixo real no Supabase.
- `normalizarLimite` ganhou guarda contra `NaN`.

Não corrigido (aceito, registrado): `CREATE EXTENSION unaccent` sem schema qualificado explicitamente (`public` por convenção do `search_path` — baixo risco no modelo atual de single-tenant/service-role); `deleteUser` do usuário efêmero sem retry (loga aviso e segue, não trava o teste).

**Fora de escopo, explicitamente**: ferramenta do agente (`buscar_conhecimento`), rota HTTP, UI. Isso entra na Fase 5 (Agent 2.0) — esta fase entrega só a camada de recuperação.

**Limitações conhecidas, documentadas no código**: stemming do Snowball português erra sigla/nome próprio/termo técnico em inglês; semântica AND da consulta pode devolver zero resultado pra consulta longa (sem fallback automático pra OR); relevância de busca textual sozinha é limitada — é a primeira perna da busca (textual → semântica → relações → reranking), não a resposta final.

Suíte inteira: **199 testes passando** em `src/lib` (226 no projeto inteiro). `tsc`/lint limpos (mobile/ é gap de config pré-existente, não relacionado).

## Próximo ponto do checklist

**Embeddings** — decidir provedor. O usuário já sinalizou que não pretende ficar preso ao Gemini a longo prazo (cogita GPT ou outra API mais em conta); a decisão de embeddings deve levar isso em conta, desacoplando o provedor de embeddings do modelo de chat/ingestão, da mesma forma que foi feito para a transcrição (Fase 3) — que, aliás, segue adiada.

# Bimo - Knowledge Core (Fase 2)

> Documento de trabalho da Fase 2 do roadmap (ver [Bimo - Visão e Direção do Projeto.md](./Bimo%20-%20Vis%C3%A3o%20e%20Dire%C3%A7%C3%A3o%20do%20Projeto.md), seção 22). Implementa o modelo desenhado na Fase 1 ([Bimo - Architecture Audit.md](./Bimo%20-%20Architecture%20Audit.md)). Diferente da Fase 1, aqui já entra infraestrutura e código real, não só decisão conceitual.

---

## Checklist da Fase 2

- [x] Definir banco (provedor + ORM)
- [x] Configurar PostgreSQL (instância dev/prod, pooling)
- [x] Criar modelo de dados (schema real das Decisões 1-7 do Architecture Audit)
- [x] Implementar fontes
- [x] Implementar entidades
- [x] Implementar notas
- [ ] Implementar relações
- [ ] Implementar revisões
- [ ] Implementar metadata

---

## Decisão 1 — Provedor de Postgres e camada de acesso

**Contexto:** a seção 25 do doc de visão listava "ORM" e "provedor definitivo de PostgreSQL" como não decidido. Isso trava o modelo de dados (próximo passo) e qualquer código de acesso, então precisava ser resolvido primeiro.

### Provedor: Supabase

Comparado com Neon/Vercel Postgres/Railway/self-hosted, Supabase entrega Postgres + Auth + Storage + `pgvector` no mesmo produto, com Row-Level Security como cidadão de primeira classe — casa direto com a Decisão 7 do Architecture Audit (isolamento por linha reforçado por RLS). Isso também resolve, de graça, dois itens hoje pendentes:

- **Storage** — a Fonte imutável (Decisão 1 do Architecture Audit) precisa de um object storage; Supabase Storage cobre isso sem adicionar outro provedor.
- **Autenticação SaaS** (item "ainda não decidido" da seção 25, checklist da Fase 8) — Supabase Auth dá uma base pronta pra quando a arquitetura multiusuário sair do papel.

Trade-off aceito: o pooler deles roda em modo transaction (pgbouncer), o que limita prepared statements com alguns clients — mitigado pela escolha do Drizzle abaixo, que não depende de recursos avançados de prepared statement do jeito que Prisma às vezes depende.

### Camada de acesso: Drizzle

Comparado com Prisma/Kysely/`pg` cru, Drizzle é uma camada fina sobre o driver (sem engine/binário separado), próxima de SQL — o que facilita escrever os triggers/constraints de integridade que a Decisão 7 exige (relação nunca cruza `user_id`) sem lutar contra abstração de ORM. Casa com o estilo já estabelecido no projeto (camadas finas e explícitas, como `github.ts` hoje) e com KISS/YAGNI das regras globais de coding-style. Tem driver oficial para Supabase/Postgres e ferramentas de migration (`drizzle-kit`).

Prisma foi descartado por ter atrito conhecido com RLS (setar `SET LOCAL` por request não é idiomático) e por adicionar uma camada de runtime mais pesada, sem trazer benefício que pese mais que isso neste projeto.

---

## Decisão 2 — Configuração do Postgres

Projeto Supabase criado; conexão validada nas duas strings necessárias:

- `DATABASE_URL` — transaction pooler (porta 6543), usada em runtime pela aplicação (compatível com funções serverless; `prepare: false` no cliente, já que esse modo não sustenta prepared statements entre requisições).
- `DATABASE_URL_MIGRATIONS` — session pooler (porta 5432), usada só pelo drizzle-kit (DDL/migrations).

Ambas em `.env` (não `.env.local` — padrão do projeto), documentadas em `.env.example`. `pgvector` disponível no projeto, ainda não habilitado (só necessário na Fase 4).

## Decisão 3 — Modelo de dados

Schema Drizzle em `src/lib/db/schema/`, traduzindo as Decisões 1-7 do Architecture Audit:

- `nos` — identidade compartilhada entre Entidade e Nota, só para dar a `relacoes` uma FK real sem precisar de 3 tabelas por combinação de tipo (refinamento sobre a Decisão 1: 1 tabela de relação, não 3).
- `entidades`, `notas`, `fontes` — conforme desenhado.
- `relacoes` — tabela única e poligamérfica (`origem_id`/`destino_id` → `nos`), com os 8 tipos fechados (os 6 da Decisão 3 + `documenta`/`menciona` para o vínculo nota↔entidade).
- `proveniencia` — join N:N fonte↔(entidade ou nota), com check constraint garantindo exatamente um alvo.
- `versoes_entidade`/`versoes_nota` — snapshot completo por edição (Decisão 4).
- Todas as tabelas com `user_id uuid` referenciando `auth.users` (Decisão 7), RLS habilitada e uma policy de dono (`(select auth.uid()) = user_id`) em cada uma.

Migration gerada e aplicada ao Supabase (`npm run db:generate` / `npm run db:migrate`, scripts novos no `package.json`). Verificado direto no banco: 8 tabelas com `rowsecurity = true`, 8 policies ativas, os 4 enums com os valores esperados. `tsc` limpo nos arquivos novos. `npm test` não rodou — falha pré-existente e não relacionada (erro `ERR_INVALID_PACKAGE_CONFIG` num pacote transitivo do jsdom, ambiente Windows), não causada por esta mudança.

## Decisão 4 — Pasta como organização, não como grafo

Pergunta em aberto ao implementar: a estrutura de pastas do vault atual (`ItemVault`) não tinha equivalente no modelo do Architecture Audit. Resposta: pasta é puramente organizacional — não vira nó nem relação no grafo (diferente de Entidade/Relação, que são conceitos estruturais). Serve pra dois usos que já existem hoje: agrupar visualmente na barra lateral e colorir nós do grafo por grupo (`cores-grupo.ts`, hoje calculado a partir do primeiro segmento do caminho).

- Campo `pasta: text` (caminho completo, ex. `"Projetos/Bimo/Ideias"`, sem nome de arquivo), adicionado só em `notas` — reproduz a árvore atual 1:1 pra exportação futura (princípio 8, portabilidade).
- **Só Nota, não Entidade**: Entidade é majoritariamente criada pelo agente ao processar fontes — não faz sentido o usuário "arquivar" uma entidade numa pasta; pasta é um conceito de organização humana.
- Migration incremental aplicada (`0001_superb_george_stacy.sql`, `ALTER TABLE notas ADD COLUMN pasta`).

## Decisão 5 — Implementar Fontes

[src/lib/supabase-storage.ts](../src/lib/supabase-storage.ts) (cliente fino do Storage) + [src/lib/fontes.ts](../src/lib/fontes.ts) (domínio: `criarFonte`/`obterFonte`/`listarFontes`, sem `atualizarFonte` — imutabilidade deliberada). `criarFonte` sobe o blob antes de inserir a linha; se o insert falhar, remove o blob (compensação — Storage não participa de transação do Postgres).

Descobertas ao verificar de ponta a ponta:

- `.env` tinha `SUPABASE_URL` com `/rest/v1/` colado (endpoint REST, não a URL base) — corrigido.
- `auth.users` estava vazio, e toda tabela nossa tem FK pra lá (Decisão 7) — nada seria inserível. Criado um usuário bootstrap via API admin do Supabase, salvo como `USER_ID_PADRAO` no `.env`/`.env.example`, documentado como **provisório até a Fase 8** (autenticação definitiva vai substituir isso por usuário real por sessão).
- Bucket `fontes` criado no Storage (privado).
- Testado com dado real (não só mock): criar, buscar, listar, limpar — funcionando.

## Decisão 6 — Implementar Entidades

[src/lib/entidades.ts](../src/lib/entidades.ts): `criarEntidade`, `atualizarEntidade`, `obterEntidade`, `listarEntidades`. Sem `removerEntidade` — a seção 14 do doc de visão não lista ferramenta de exclusão de entidade; o modelo favorece merge/substituição (`substitui`) sobre apagar conhecimento.

- `criarEntidade`/`atualizarEntidade` usam `db.transaction`: gravam `nos` + `entidades` (+ `versoes_entidade`) atomicamente — diferente de Fonte, tudo aqui é Postgres, então dá pra usar transação de verdade em vez de compensação manual.
- Cada edição grava o estado novo inteiro em `versoes_entidade` (Decisão 4), com a autoria de quem editou — sem sobrescrever o `criadoPor` original da entidade.
- Enforcement de risco/autonomia (Decisão 5 do Architecture Audit — ex.: bloquear edição de entidade `aprovada` sem aprovação) **não está aqui**: é responsabilidade da futura camada de ferramentas do agente (Fase 5), não da camada de dados.
- Testado com dado real: criar, atualizar (rascunho → aprovada), buscar, listar, limpar via cascade em `nos` — funcionando.

Toda a suíte de `src/lib` (129 testes) segue passando.

## Decisão 7 — Implementar Notas

[src/lib/notas.ts](../src/lib/notas.ts): `criarNota`/`atualizarNota`/`obterNota`/`listarNotas`, mesmo padrão de `entidades.ts` (transação `nos`+`notas`+`versoes_nota`), sem `confianca`/`status` e com `pasta`.

Correção feita antes de escrever este módulo: `versoes_nota` não tinha coluna `pasta` (esquecida quando a Decisão 4 da Fase 2 adicionou `pasta` só em `notas`) — snapshot de versão ficaria incompleto. Adicionada via migration incremental (`0002_noisy_zaladane.sql`).

Testado com dado real: criar, atualizar conteúdo, buscar, listar, limpar via cascade — funcionando. Suíte inteira de `src/lib`: **135 testes passando**.

## Próximo ponto do checklist

**Implementar relações** — a tabela `relacoes` já existe desde a Decisão 3; falta a camada de domínio (`criarRelacao`/`removerRelacao`/consultas de grafo), incluindo o constraint de mesmo `userId` entre origem e destino (Decisão 7 do Architecture Audit) que ainda não foi implementado em código.

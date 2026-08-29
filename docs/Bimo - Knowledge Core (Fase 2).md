# Bimo - Knowledge Core (Fase 2)

> Documento de trabalho da Fase 2 do roadmap (ver [Bimo - Visão e Direção do Projeto.md](./Bimo%20-%20Vis%C3%A3o%20e%20Dire%C3%A7%C3%A3o%20do%20Projeto.md), seção 22). Implementa o modelo desenhado na Fase 1 ([Bimo - Architecture Audit.md](./Bimo%20-%20Architecture%20Audit.md)). Diferente da Fase 1, aqui já entra infraestrutura e código real, não só decisão conceitual.

---

## Checklist da Fase 2

- [x] Definir banco (provedor + ORM)
- [x] Configurar PostgreSQL (instância dev/prod, pooling)
- [x] Criar modelo de dados (schema real das Decisões 1-7 do Architecture Audit)
- [ ] Implementar fontes
- [ ] Implementar entidades
- [ ] Implementar notas
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

## Próximo ponto do checklist

**Implementar fontes** — camada de acesso a dados (funções `criarFonte`/etc. sobre `src/lib/db/cliente.ts`) + upload pro Supabase Storage.

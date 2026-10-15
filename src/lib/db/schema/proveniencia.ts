import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usuariosAuth } from "./auth";
import { entidades } from "./entidades";
import { fontes } from "./fontes";
import { notas } from "./notas";

/**
 * Proveniência (Decisão 2 do Architecture Audit, Camada 2 — fontes
 * associadas): tabela de junção N:N entre uma Fonte e a Entidade/Nota que ela
 * ajudou a originar. Uma Entidade se consolida de múltiplas fontes ao longo
 * do tempo (seção 15 do doc de visão), então isto nunca é uma FK única.
 *
 * `entidadeId`/`notaId` são mutuamente exclusivos — proveniência aponta pra
 * uma Entidade OU uma Nota, nunca as duas nem nenhuma (o check constraint
 * abaixo garante isso no banco).
 *
 * `locator` fica reservado (nulo) pra granularidade de citação — só passa a
 * ser usado na Fase 4 (Retrieval), não implementado agora.
 */
export const proveniencia = pgTable(
  "proveniencia",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usuariosAuth.id, { onDelete: "cascade" }),
    fonteId: bigint("fonte_id", { mode: "number" })
      .notNull()
      .references(() => fontes.id, { onDelete: "cascade" }),
    entidadeId: bigint("entidade_id", { mode: "number" }).references(() => entidades.id, {
      onDelete: "cascade",
    }),
    notaId: bigint("nota_id", { mode: "number" }).references(() => notas.id, {
      onDelete: "cascade",
    }),
    /** Reservado pra citação em nível de trecho (página/offset) — ver Fase 4. */
    locator: text("locator"),
    vinculadoEm: timestamp("vinculado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    index("proveniencia_user_id_idx").on(tabela.userId),
    index("proveniencia_fonte_id_idx").on(tabela.fonteId),
    index("proveniencia_entidade_id_idx").on(tabela.entidadeId),
    index("proveniencia_nota_id_idx").on(tabela.notaId),
    check(
      "proveniencia_alvo_unico_chk",
      sql`(${tabela.entidadeId} is not null)::int + (${tabela.notaId} is not null)::int = 1`,
    ),
    pgPolicy("proveniencia_dono_policy", {
      for: "all",
      to: "authenticated",
      using: sql`(select auth.uid()) = ${tabela.userId}`,
      withCheck: sql`(select auth.uid()) = ${tabela.userId}`,
    }),
  ],
).enableRLS();

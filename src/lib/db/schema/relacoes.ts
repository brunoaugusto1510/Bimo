import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { usuariosAuth } from "./auth";
import { criadoPorEnum, tipoRelacaoEnum } from "./enums";
import { nos } from "./nos";

/**
 * Relação: tabela única e poligamérfica (Decisão 1/3 do Architecture Audit).
 * `origemId`/`destinoId` apontam pra `nos`, que pode ser uma Entidade ou uma
 * Nota — isso é o que permite ter uma FK real sem precisar de 3 tabelas
 * separadas por combinação de tipos.
 *
 * Não recebe a máquina de versionamento de Nota/Entidade (Decisão 4): uma
 * relação existe ou não existe, não é editada incrementalmente — por isso
 * `removidoEm`/`removidoPor` em vez de uma tabela de versões própria.
 */
export const relacoes = pgTable(
  "relacoes",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usuariosAuth.id, { onDelete: "cascade" }),
    origemId: bigint("origem_id", { mode: "number" })
      .notNull()
      .references(() => nos.id, { onDelete: "cascade" }),
    destinoId: bigint("destino_id", { mode: "number" })
      .notNull()
      .references(() => nos.id, { onDelete: "cascade" }),
    tipo: tipoRelacaoEnum("tipo").notNull(),
    criadoPor: criadoPorEnum("criado_por").notNull(),
    /** Nome da ferramenta que criou, quando `criadoPor = 'agente'`. */
    criadoPorFerramenta: text("criado_por_ferramenta"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    removidoEm: timestamp("removido_em", { withTimezone: true }),
    removidoPor: criadoPorEnum("removido_por"),
  },
  (tabela) => [
    index("relacoes_user_id_idx").on(tabela.userId),
    index("relacoes_origem_id_idx").on(tabela.origemId),
    index("relacoes_destino_id_idx").on(tabela.destinoId),
    // Evita duplicar a mesma relação ativa (não removida) entre o mesmo par + tipo.
    uniqueIndex("relacoes_ativa_unica_idx")
      .on(tabela.origemId, tabela.destinoId, tabela.tipo)
      .where(sql`${tabela.removidoEm} is null`),
    pgPolicy("relacoes_dono_policy", {
      for: "all",
      to: "authenticated",
      using: sql`(select auth.uid()) = ${tabela.userId}`,
      withCheck: sql`(select auth.uid()) = ${tabela.userId}`,
    }),
  ],
).enableRLS();

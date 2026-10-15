import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usuariosAuth } from "./auth";
import { criadoPorEnum, statusEntidadeEnum } from "./enums";
import { entidades } from "./entidades";
import { notas } from "./notas";

/**
 * Versionamento (Decisão 4 do Architecture Audit): snapshot completo por
 * edição, não diff por campo — cada linha aqui é uma foto inteira do estado
 * da Entidade/Nota naquele momento. Restaurar uma versão antiga cria uma
 * versão *nova* com aquele conteúdo (nunca apaga/reescreve as intermediárias).
 */

export const versoesEntidade = pgTable(
  "versoes_entidade",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    entidadeId: bigint("entidade_id", { mode: "number" })
      .notNull()
      .references(() => entidades.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usuariosAuth.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    tipo: text("tipo"),
    aliases: text("aliases").array(),
    confianca: numeric("confianca", { precision: 3, scale: 2 }),
    status: statusEntidadeEnum("status").notNull(),
    criadoPor: criadoPorEnum("criado_por").notNull(),
    criadoPorFerramenta: text("criado_por_ferramenta"),
    versionadoEm: timestamp("versionado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    index("versoes_entidade_entidade_id_idx").on(tabela.entidadeId),
    pgPolicy("versoes_entidade_dono_policy", {
      for: "all",
      to: "authenticated",
      using: sql`(select auth.uid()) = ${tabela.userId}`,
      withCheck: sql`(select auth.uid()) = ${tabela.userId}`,
    }),
  ],
).enableRLS();

export const versoesNota = pgTable(
  "versoes_nota",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    notaId: bigint("nota_id", { mode: "number" })
      .notNull()
      .references(() => notas.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usuariosAuth.id, { onDelete: "cascade" }),
    titulo: text("titulo").notNull(),
    conteudo: text("conteudo").notNull(),
    pasta: text("pasta"),
    tags: text("tags").array(),
    criadoPor: criadoPorEnum("criado_por").notNull(),
    criadoPorFerramenta: text("criado_por_ferramenta"),
    versionadoEm: timestamp("versionado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    index("versoes_nota_nota_id_idx").on(tabela.notaId),
    pgPolicy("versoes_nota_dono_policy", {
      for: "all",
      to: "authenticated",
      using: sql`(select auth.uid()) = ${tabela.userId}`,
      withCheck: sql`(select auth.uid()) = ${tabela.userId}`,
    }),
  ],
).enableRLS();

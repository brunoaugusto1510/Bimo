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
import { nos } from "./nos";

/**
 * Entidade: nó leve do grafo de conhecimento (Decisão 1 do Architecture
 * Audit). Criada majoritariamente pelo agente ao processar fontes — pode não
 * ter corpo de texto nenhum, é identidade + relações, não narrativa.
 */
export const entidades = pgTable(
  "entidades",
  {
    /** Mesmo id da linha correspondente em `nos` — não gera identidade própria. */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => nos.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usuariosAuth.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    /** Categoria livre do conceito (ex.: "pessoa", "projeto") — não confundir com tipo de relação. */
    tipo: text("tipo"),
    aliases: text("aliases").array(),
    /** 0.00–1.00; quão confiante o agente está de que esta entidade está correta/consolidada. */
    confianca: numeric("confianca", { precision: 3, scale: 2 }),
    status: statusEntidadeEnum("status").notNull().default("rascunho"),
    criadoPor: criadoPorEnum("criado_por").notNull(),
    /** Nome da ferramenta que criou/editou, quando `criadoPor = 'agente'`. */
    criadoPorFerramenta: text("criado_por_ferramenta"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (tabela) => [
    index("entidades_user_id_idx").on(tabela.userId),
    pgPolicy("entidades_dono_policy", {
      for: "all",
      to: "authenticated",
      using: sql`(select auth.uid()) = ${tabela.userId}`,
      withCheck: sql`(select auth.uid()) = ${tabela.userId}`,
    }),
  ],
).enableRLS();

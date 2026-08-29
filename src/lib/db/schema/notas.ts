import { sql } from "drizzle-orm";
import { bigint, index, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usuariosAuth } from "./auth";
import { criadoPorEnum } from "./enums";
import { nos } from "./nos";

/**
 * Nota: documento pesado, majoritariamente autoral do usuário (Decisão 1 do
 * Architecture Audit). Corpo em markdown, versionado (ver `versoes_nota`).
 * Não carrega colunas de workflow do agente (`confianca`/`status`) — isso é
 * problema da Entidade, não da Nota.
 */
export const notas = pgTable(
  "notas",
  {
    /** Mesmo id da linha correspondente em `nos` — não gera identidade própria. */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => nos.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usuariosAuth.id, { onDelete: "cascade" }),
    titulo: text("titulo").notNull(),
    conteudo: text("conteudo").notNull(),
    tags: text("tags").array(),
    criadoPor: criadoPorEnum("criado_por").notNull(),
    /** Nome da ferramenta que criou/editou, quando `criadoPor = 'agente'`. */
    criadoPorFerramenta: text("criado_por_ferramenta"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (tabela) => [
    index("notas_user_id_idx").on(tabela.userId),
    pgPolicy("notas_dono_policy", {
      for: "all",
      to: "authenticated",
      using: sql`(select auth.uid()) = ${tabela.userId}`,
      withCheck: sql`(select auth.uid()) = ${tabela.userId}`,
    }),
  ],
).enableRLS();

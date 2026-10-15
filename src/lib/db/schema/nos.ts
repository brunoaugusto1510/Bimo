import { sql } from "drizzle-orm";
import { bigint, index, pgPolicy, pgTable, uuid } from "drizzle-orm/pg-core";
import { usuariosAuth } from "./auth";
import { tipoNoEnum } from "./enums";

/**
 * Identidade compartilhada entre Entidade e Nota.
 *
 * Existe só pra dar a `relacoes` uma foreign key de verdade que pode apontar
 * pra qualquer uma das duas (Decisão 1/3 do Architecture Audit: "Relação
 * poligamérfica") sem precisar de 3 tabelas de relação separadas nem de um
 * trigger de validação. `entidades.id` e `notas.id` referenciam `nos.id` —
 * toda Entidade/Nota tem uma linha correspondente aqui.
 */
export const nos = pgTable(
  "nos",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    tipo: tipoNoEnum("tipo").notNull(),
    /**
     * Duplicado de entidades.user_id/notas.user_id: o dono de um nó nunca
     * muda depois de criado, então denormalizar aqui evita que a política de
     * RLS precise de subquery nas tabelas concretas pra saber quem é o dono
     * (Decisão 7 do Architecture Audit — RLS como reforço).
     */
    userId: uuid("user_id")
      .notNull()
      .references(() => usuariosAuth.id, { onDelete: "cascade" }),
  },
  (tabela) => [
    index("nos_user_id_idx").on(tabela.userId),
    pgPolicy("nos_dono_policy", {
      for: "all",
      to: "authenticated",
      using: sql`(select auth.uid()) = ${tabela.userId}`,
      withCheck: sql`(select auth.uid()) = ${tabela.userId}`,
    }),
  ],
).enableRLS();

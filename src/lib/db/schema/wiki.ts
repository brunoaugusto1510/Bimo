import { sql } from "drizzle-orm";
import { bigint, index, integer, jsonb, pgPolicy, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { usuariosAuth } from "./auth";
import { notas } from "./notas";
import type { AfirmacaoWiki, EstruturaWiki, FonteWiki } from "../../wiki/tipos";

/** Snapshots imutáveis por publicação; o histórico da nota preserva o texto anterior. */
export const paginasWiki = pgTable("paginas_wiki", {
  notaId: bigint("nota_id", { mode: "number" }).notNull().references(() => notas.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usuariosAuth.id, { onDelete: "cascade" }),
  revisaoPublicada: integer("revisao_publicada").notNull(),
  fontes: jsonb("fontes").$type<FonteWiki[]>().notNull(),
  afirmacoes: jsonb("afirmacoes").$type<AfirmacaoWiki[]>().notNull(),
  /** Ligações a outras sínteses e perguntas em aberto; ver `EstruturaWiki`. */
  estrutura: jsonb("estrutura").$type<EstruturaWiki>().notNull().default(sql`'{"ligacoes":[],"lacunas":[]}'::jsonb`),
}, (t) => [primaryKey({ columns: [t.notaId, t.revisaoPublicada] }), index("paginas_wiki_dono_idx").on(t.userId), pgPolicy("paginas_wiki_dono_policy", {
  for: "all", to: "authenticated", using: sql`(select auth.uid()) = ${t.userId}`,
  withCheck: sql`(select auth.uid()) = ${t.userId} and exists (select 1 from public.notas n where n.id = ${t.notaId} and n.user_id = (select auth.uid()))`,
})]).enableRLS();

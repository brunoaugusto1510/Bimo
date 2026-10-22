import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, foreignKey, index, integer, jsonb, pgPolicy, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { notas } from "./notas";
import { usuariosAuth } from "./auth";

export const conceitosWiki = pgTable("conceitos_wiki", {
  notaId: bigint("nota_id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").notNull().references(() => usuariosAuth.id, { onDelete: "cascade" }),
  chave: text("chave").notNull(), aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
  origens: jsonb("origens").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
  protegida: boolean("protegida").notNull().default(false),
  revisaoGerenciada: integer("revisao_gerenciada").notNull().default(1),
}, (t) => [
  foreignKey({ columns: [t.notaId, t.userId], foreignColumns: [notas.id, notas.userId] }).onDelete("cascade"),
  uniqueIndex("conceitos_wiki_dono_chave_idx").on(t.userId, t.chave),
  index("conceitos_wiki_origens_idx").using("gin", t.origens),
  check("conceitos_wiki_revisao_positiva", sql`${t.revisaoGerenciada} > 0`),
  check("conceitos_wiki_chave_valida", sql`char_length(${t.chave}) between 1 and 200`),
  pgPolicy("conceitos_wiki_dono_policy", { for: "select", to: "authenticated",
    using: sql`(select auth.uid()) = ${t.userId}` }),
]).enableRLS();

export const trabalhosWiki = pgTable("trabalhos_wiki", {
  userId: uuid("user_id").notNull().references(() => usuariosAuth.id, { onDelete: "cascade" }),
  notaId: bigint("nota_id", { mode: "number" }).notNull(), revisao: integer("revisao").notNull(),
  geracao: integer("geracao").notNull().default(1), cursor: integer("cursor").notNull().default(0),
  estado: text("estado").notNull().default("pendente"), tentativas: integer("tentativas").notNull().default(0),
  disponivelEm: timestamp("disponivel_em", { withTimezone: true }).notNull().defaultNow(),
  posse: uuid("posse"), posseAte: timestamp("posse_ate", { withTimezone: true }),
  /** Só a categoria da última falha (ex.: "ErroOpenAI:429"), para diagnosticar o piloto sem texto das notas. */
  ultimoErro: text("ultimo_erro"),
}, (t) => [
  primaryKey({ columns: [t.userId, t.notaId] }),
  foreignKey({ columns: [t.notaId, t.userId], foreignColumns: [notas.id, notas.userId] }).onDelete("cascade"),
  index("trabalhos_wiki_prontos_idx").on(t.userId, t.disponivelEm).where(sql`${t.estado} = 'pendente'`),
  check("trabalhos_wiki_progresso_valido", sql`${t.revisao} > 0 and ${t.geracao} > 0 and ${t.cursor} >= 0 and ${t.tentativas} >= 0`),
  check("trabalhos_wiki_estado_valido", sql`${t.estado} in ('pendente', 'concluido', 'temporario', 'revisar', 'configuracao')`),
  pgPolicy("trabalhos_wiki_dono_policy", { for: "select", to: "authenticated",
    using: sql`(select auth.uid()) = ${t.userId}` }),
]).enableRLS();

/** Não depende da existência da nota: apagá-la não devolve crédito já consumido. */
export const consumosWiki = pgTable("consumos_wiki", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usuariosAuth.id, { onDelete: "cascade" }),
  dia: date("dia").notNull(), notaId: text("nota_id").notNull(), geracao: integer("geracao").notNull(),
  reservado: integer("reservado").notNull(), utilizado: integer("utilizado"),
  estado: text("estado").notNull().default("reservado"),
  modelo: text("modelo").notNull(), versaoPipeline: integer("versao_pipeline").notNull().default(1),
}, (t) => [index("consumos_wiki_dono_dia_idx").on(t.userId, t.dia),
  check("consumos_wiki_quantidade_valida", sql`${t.reservado} > 0 and (${t.utilizado} is null or ${t.utilizado} >= 0)`),
  check("consumos_wiki_estado_valido", sql`${t.estado} in ('reservado', 'confirmado', 'incerto')`),
  pgPolicy("consumos_wiki_dono_policy", { for: "select", to: "authenticated",
    using: sql`(select auth.uid()) = ${t.userId}` }),
]).enableRLS();

import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, jsonb, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usuariosAuth } from "./auth";
import type { FonteDaResposta, UsoDeFerramenta } from "../../types";

/** O histórico do chat. Só o backend grava; a policy deixa a pessoa ler apenas o que é dela. */
export const conversas = pgTable("conversas", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usuariosAuth.id, { onDelete: "cascade" }),
  titulo: text("titulo").notNull(),
  criadaEm: timestamp("criada_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadaEm: timestamp("atualizada_em", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Alvo da chave composta das mensagens: impede uma mensagem de apontar para a conversa de outra pessoa.
  uniqueIndex("conversas_id_dono_idx").on(t.id, t.userId),
  index("conversas_dono_recentes_idx").on(t.userId, t.atualizadaEm.desc(), t.id),
  check("conversas_titulo_valido", sql`char_length(${t.titulo}) between 1 and 200`),
  pgPolicy("conversas_dono_policy", { for: "select", to: "authenticated", using: sql`(select auth.uid()) = ${t.userId}` }),
]).enableRLS();

/** Só cresce: o id vem do cliente, então repetir um pedido não duplica a mensagem. */
export const mensagensDeConversa = pgTable("mensagens_de_conversa", {
  id: uuid("id").primaryKey(),
  conversaId: uuid("conversa_id").notNull(),
  userId: uuid("user_id").notNull().references(() => usuariosAuth.id, { onDelete: "cascade" }),
  /** A ordem de gravação; o relógio não serve porque duas mensagens do mesmo pedido nascem juntas. */
  seq: bigint("seq", { mode: "number" }).notNull().generatedAlwaysAsIdentity(),
  papel: text("papel").$type<"usuario" | "agente">().notNull(),
  conteudo: text("conteudo").notNull(),
  ferramentas: jsonb("ferramentas").$type<UsoDeFerramenta[]>(),
  fontes: jsonb("fontes").$type<FonteDaResposta[]>(),
  criadaEm: timestamp("criada_em", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.conversaId, t.userId], foreignColumns: [conversas.id, conversas.userId] }).onDelete("cascade"),
  index("mensagens_de_conversa_ordem_idx").on(t.conversaId, t.seq),
  check("mensagens_de_conversa_papel_valido", sql`${t.papel} in ('usuario', 'agente')`),
  check("mensagens_de_conversa_conteudo_valido", sql`char_length(${t.conteudo}) between 1 and 20000`),
  pgPolicy("mensagens_de_conversa_dono_policy", { for: "select", to: "authenticated", using: sql`(select auth.uid()) = ${t.userId}` }),
]).enableRLS();

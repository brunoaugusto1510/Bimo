import { sql } from "drizzle-orm";
import { bigint, index, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usuariosAuth } from "./auth";
import { criadoPorEnum } from "./enums";
import { nos } from "./nos";
import { tsvector } from "./tipos-customizados";

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
    /**
     * Caminho completo da pasta (ex.: "Projetos/Bimo/Ideias"), sem o nome do
     * arquivo. É só organização/exportação e cor no grafo — nunca vira nó nem
     * relação (diferente de Entidade, que não tem este campo).
     */
    pasta: text("pasta"),
    tags: text("tags").array(),
    criadoPor: criadoPorEnum("criado_por").notNull(),
    /** Nome da ferramenta que criou/editou, quando `criadoPor = 'agente'`. */
    criadoPorFerramenta: text("criado_por_ferramenta"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Coluna gerada (STORED) para full-text search (Fase 4 - Retrieval).
     * Peso A = título, B = tags, C = conteúdo — `ts_rank` usa isso pra
     * priorizar match no título acima de match perdido no meio do corpo.
     * `portugues_sem_acento` (ver migration `0004_busca_textual_infra`) é a
     * config `portuguese` do Postgres com `unaccent` acoplado ao mapeamento,
     * pra "codigo" achar "código" sem o usuário precisar digitar o acento.
     */
    vetorBusca: tsvector("vetor_busca").notNull().generatedAlwaysAs(
      sql`setweight(to_tsvector('public.portugues_sem_acento', coalesce(titulo, '')), 'A') || setweight(to_tsvector('public.portugues_sem_acento', public.texto_de_lista(tags)), 'B') || setweight(to_tsvector('public.portugues_sem_acento', coalesce(conteudo, '')), 'C')`,
    ),
  },
  (tabela) => [
    index("notas_user_id_idx").on(tabela.userId),
    index("notas_vetor_busca_idx").using("gin", tabela.vetorBusca),
    pgPolicy("notas_dono_policy", {
      for: "all",
      to: "authenticated",
      using: sql`(select auth.uid()) = ${tabela.userId}`,
      withCheck: sql`(select auth.uid()) = ${tabela.userId}`,
    }),
  ],
).enableRLS();

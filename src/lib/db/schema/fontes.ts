import { sql } from "drizzle-orm";
import { bigint, index, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usuariosAuth } from "./auth";

/**
 * Fonte: blob imutável, preservado exatamente como veio (Decisão 1 do
 * Architecture Audit). Nunca é editada depois de ingerida — uma atualização
 * gera uma nova ingestão, não uma sobrescrita. O conteúdo em si vive no
 * Supabase Storage; aqui só ficam os metadados e o caminho.
 */
export const fontes = pgTable(
  "fontes",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usuariosAuth.id, { onDelete: "cascade" }),
    /** Caminho/chave do objeto no Supabase Storage. */
    caminhoArmazenamento: text("caminho_armazenamento").notNull(),
    nomeArquivoOriginal: text("nome_arquivo_original"),
    /** URL de origem, quando a Fonte foi buscada da web em vez de enviada como arquivo. */
    urlOrigem: text("url_origem"),
    tipoMime: text("tipo_mime"),
    /** Hash do conteúdo, útil pra detectar reingestão do mesmo arquivo. */
    hashConteudo: text("hash_conteudo"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    index("fontes_user_id_idx").on(tabela.userId),
    pgPolicy("fontes_dono_policy", {
      for: "all",
      to: "authenticated",
      using: sql`(select auth.uid()) = ${tabela.userId}`,
      withCheck: sql`(select auth.uid()) = ${tabela.userId}`,
    }),
  ],
).enableRLS();

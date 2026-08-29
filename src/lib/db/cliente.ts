import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Cliente Drizzle de runtime — usa o transaction pooler do Supabase (porta
 * 6543, `DATABASE_URL`), compatível com funções serverless.
 *
 * `prepare: false` é obrigatório aqui: o transaction pooler (pgbouncer em
 * modo transaction) não sustenta prepared statements entre requisições —
 * cada uma pode cair numa conexão física diferente (ver referência
 * conn-prepared-statements do skill supabase-postgres-best-practices).
 */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL não configurada — veja .env.example.");
}

const conexao = postgres(url, { prepare: false });

export const db = drizzle(conexao, { schema });

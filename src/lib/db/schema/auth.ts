import { pgSchema, uuid } from "drizzle-orm/pg-core";

/**
 * Referência mínima à tabela de usuários gerenciada pelo Supabase Auth.
 *
 * Não criamos nem alteramos essa tabela por aqui — ela já existe no projeto
 * Supabase (schema `auth`). Só precisamos dela pra poder referenciar
 * `usuariosAuth.id` como foreign key em `user_id` nas nossas tabelas
 * (Decisão 7 do Architecture Audit: isolamento por linha).
 */
const esquemaAuth = pgSchema("auth");

export const usuariosAuth = esquemaAuth.table("users", {
  id: uuid("id").primaryKey(),
});

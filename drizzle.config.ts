import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Config do drizzle-kit (generate/migrate) — usa o session pooler do
 * Supabase (porta 5432, `DATABASE_URL_MIGRATIONS`), não o transaction
 * pooler: DDL e migrations não são recomendadas em modo transaction.
 */
const urlMigrations = process.env.DATABASE_URL_MIGRATIONS;
if (!urlMigrations) {
  throw new Error("DATABASE_URL_MIGRATIONS não configurada — veja .env.example.");
}

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: urlMigrations,
  },
});

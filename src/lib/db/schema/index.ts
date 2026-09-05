/**
 * Barrel do schema Drizzle — usado pelo `drizzle.config.ts` (geração de
 * migrations) e pelo cliente de runtime (`src/lib/db/cliente.ts`).
 *
 * Não reexporta `./auth`: `usuariosAuth` é só uma referência de leitura à
 * tabela do Supabase Auth, não faz parte do nosso schema de aplicação.
 */
export * from "./enums";
export * from "./nos";
export * from "./entidades";
export * from "./notas";
export * from "./fontes";
export * from "./relacoes";
export * from "./proveniencia";
export * from "./versoes";

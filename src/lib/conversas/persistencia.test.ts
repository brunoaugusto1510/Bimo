// @vitest-environment node
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { criarRepositorioDeConversasDoBanco } from "./banco";
import { executarContratoDoRepositorioDeConversas } from "./suite-de-contrato";

const sim = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("../db/cliente", () => ({ get db() { return sim.db; } }));
let pg: PGlite;
const antiga = randomUUID(), donoAntigo = randomUUID();
beforeAll(async () => {
  pg = new PGlite(); sim.db = drizzle(pg);
  await pg.exec("create schema auth; create role authenticated; create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$; create table auth.users (id uuid primary key);");
  await pg.exec(await readFile("drizzle/0012_conversas.sql", "utf8"));
  await pg.query("insert into auth.users values ($1)", [donoAntigo]);
  await pg.query("insert into conversas(id,user_id,titulo) values ($1,$2,'Anterior')", [antiga, donoAntigo]);
  await pg.exec(await readFile("drizzle/0014_notas_de_contexto.sql", "utf8"));
}, 30_000);
afterAll(async () => { await pg?.close(); });
it("migra conversas existentes com seleção vazia", async () => {
  expect((await criarRepositorioDeConversasDoBanco(donoAntigo).obter(antiga))?.notasDeContexto).toEqual([]);
});
executarContratoDoRepositorioDeConversas("Postgres isolado (PGlite)", async () => {
  const ana = randomUUID(), beto = randomUUID();
  await pg.query("insert into auth.users values ($1),($2)", [ana, beto]);
  return { repo: criarRepositorioDeConversasDoBanco(ana), outraPessoa: criarRepositorioDeConversasDoBanco(beto) };
});

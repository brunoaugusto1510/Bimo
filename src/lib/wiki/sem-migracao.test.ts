// @vitest-environment node
import { readFile } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { criarRepositorioDoBanco } from "../repositorio-de-notas/banco";
import { processarWiki } from "./automacao";
import { esquecerSondagemDaWiki } from "./disponibilidade";

const sim = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("../db/cliente", () => ({ get db() { return sim.db; } }));
const dono = "00000000-0000-4000-8000-000000000001";
const autor = { criadoPor: "usuario" as const };
let pg: PGlite;

// Só o substrato anterior à wiki: as migrações 0007 a 0009 NÃO são aplicadas, como num banco ainda não migrado.
beforeAll(async () => {
  pg = new PGlite(); sim.db = drizzle(pg);
  await pg.exec(`create schema auth; create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table auth.users (id uuid primary key);
    create table nos (id bigint generated always as identity primary key, tipo text not null, user_id uuid not null references auth.users(id));
    create text search configuration public.portugues_sem_acento (copy = pg_catalog.portuguese);
    create table notas (id bigint primary key references nos(id), user_id uuid not null references auth.users(id), titulo text not null,
      conteudo text not null, pasta text, tags text[], revisao integer not null default 1, criado_por text not null, criado_por_ferramenta text,
      criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
      vetor_busca tsvector generated always as (to_tsvector('public.portugues_sem_acento', titulo || ' ' || conteudo)) stored);
    create unique index notas_usuario_pasta_titulo_unico on notas (user_id, coalesce(pasta, ''), lower(titulo));
    create table versoes_nota (id bigint generated always as identity primary key, nota_id bigint references notas(id), user_id uuid not null,
      titulo text not null, conteudo text not null, pasta text, tags text[], criado_por text not null, criado_por_ferramenta text,
      sessao_aberta boolean not null default false, versionado_em timestamptz not null default now());`);
  await pg.exec(await readFile("drizzle/0013_lixeira.sql", "utf8"));
}, 30_000);
beforeEach(async () => {
  esquecerSondagemDaWiki();
  vi.stubEnv("WIKI_VIVA_ATIVA", "1"); vi.stubEnv("WIKI_AUTOMATICA_ATIVA", "1");
  await pg.exec("truncate table auth.users, nos, notas, versoes_nota restart identity cascade");
  await pg.query("insert into auth.users values ($1)", [dono]);
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => { await pg?.close(); });

it("ligar as variáveis antes de migrar não impede criar, editar, renomear nem mover notas", async () => {
  const repo = criarRepositorioDoBanco(dono);
  const criada = await repo.criarNota({ titulo: "A", conteudo: "texto" }, autor);
  expect(criada.tipo).toBe("ok");
  expect((await repo.atualizarNota("1", { conteudo: "texto novo" }, { revisaoBase: 1, autor })).tipo).toBe("ok");
  expect((await repo.renomearNota("1", "B", { revisaoBase: 2, autor })).tipo).toBe("ok");
  expect((await repo.atualizarNota("1", { pasta: "Redes" }, { revisaoBase: 3, autor })).tipo).toBe("ok");
  expect(await repo.listarResumos()).toHaveLength(1);
});

it("a wiki fica vazia, sem erro, e a fila não faz nada", async () => {
  const repo = criarRepositorioDoBanco(dono);
  await repo.criarNota({ titulo: "A", conteudo: "texto" }, autor);
  expect(await repo.wiki!.listar()).toEqual([]);
  expect(await repo.wiki!.obter("1")).toBeNull();
  const fila = repo.wiki!.automacao!;
  await expect(fila.solicitar("1")).resolves.toBeUndefined();
  expect(await fila.reivindicar()).toBeNull();
  expect(await fila.conceitos()).toEqual([]);
  expect(await fila.cobertura()).toMatchObject({ elegiveis: 0, pendentes: 0 });
  const gerar = vi.fn();
  expect((await processarWiki(repo, gerar, { tetoDiario: 200_000 })).tipo).toBe("ocioso");
  expect(gerar).not.toHaveBeenCalled();
});

it("uma sondagem que falha não cancela a gravação da nota e a wiki fica desligada por um tempo", async () => {
  const registro = vi.spyOn(console, "error").mockImplementation(() => {});
  const original = pg.query.bind(pg);
  // Só a sondagem quebra; as demais consultas seguem normalmente.
  const quebrar = vi.spyOn(pg, "query").mockImplementation(((consulta: string, ...resto: unknown[]) => {
    if (typeof consulta === "string" && consulta.includes("to_regclass")) return Promise.reject(Object.assign(new Error("sondagem quebrou"), { code: "57014" }));
    return (original as (...a: unknown[]) => Promise<unknown>)(consulta, ...resto);
  }) as typeof pg.query);
  try {
    const repo = criarRepositorioDoBanco(dono);
    expect((await repo.criarNota({ titulo: "A", conteudo: "texto" }, autor)).tipo).toBe("ok");
    expect((await repo.atualizarNota("1", { conteudo: "texto novo" }, { revisaoBase: 1, autor })).tipo).toBe("ok");
    expect(await repo.wiki!.listar()).toEqual([]);
    expect(JSON.stringify(registro.mock.calls)).not.toContain("sondagem quebrou");
  } finally { quebrar.mockRestore(); registro.mockRestore(); }
});


it("migração parcial (sem a coluna da 0009) mantém a fila desligada em vez de quebrar depois da chamada paga", async () => {
  for (const caminho of ["drizzle/0007_wiki_viva.sql", "drizzle/0008_wiki_automatica.sql"]) await pg.exec(await readFile(caminho, "utf8"));
  esquecerSondagemDaWiki();
  const repo = criarRepositorioDoBanco(dono);
  expect((await repo.criarNota({ titulo: "A", conteudo: "texto" }, autor)).tipo).toBe("ok");
  // A tabela das páginas existe, mas a automação espera pela 0009.
  expect(await repo.wiki!.listar()).toEqual([]);
  expect((await pg.query("select * from trabalhos_wiki")).rows).toHaveLength(0);
  expect(await repo.wiki!.automacao!.reivindicar()).toBeNull();
  const gerar = vi.fn();
  expect((await processarWiki(repo, gerar, { tetoDiario: 200_000 })).tipo).toBe("ocioso");
  expect(gerar).not.toHaveBeenCalled();
});

it("espera a 0011 para automatizar e reconhece a migração sem reiniciar a instância", async () => {
  // Neste ponto o banco tem a 0007 e a 0008 (o teste anterior). A 0009 sozinha ainda não basta.
  await pg.exec(await readFile("drizzle/0009_wiki_ultimo_erro.sql", "utf8"));
  esquecerSondagemDaWiki();
  const repo = criarRepositorioDoBanco(dono);
  expect((await repo.criarNota({ titulo: "C", conteudo: "texto" }, autor)).tipo).toBe("ok");
  expect(await repo.wiki!.listar()).toEqual([]);
  expect(await repo.wiki!.automacao!.cobertura()).toMatchObject({ elegiveis: 0 });
  expect((await pg.query("select * from trabalhos_wiki")).rows).toHaveLength(0);

  await pg.exec(await readFile("drizzle/0010_wiki_estrutura.sql", "utf8"));
  esquecerSondagemDaWiki();
  const pronta = criarRepositorioDoBanco(dono);
  await pronta.criarNota({ titulo: "D", conteudo: "outro texto" }, autor);
  expect((await pronta.wiki!.automacao!.cobertura()).elegiveis).toBe(0);
  await pg.exec(await readFile("drizzle/0011_wiki_observabilidade.sql", "utf8"));
  const relogio = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31_000);
  try { expect((await pronta.wiki!.automacao!.cobertura()).elegiveis).toBeGreaterThan(0); }
  finally { relogio.mockRestore(); }
});

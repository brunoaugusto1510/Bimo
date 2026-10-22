// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const simulacao = vi.hoisted(() => ({ db: { select: vi.fn(), selectDistinct: vi.fn(), selectDistinctOn: vi.fn(), insert: vi.fn(), update: vi.fn(), execute: vi.fn(), transaction: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("../db/cliente", () => ({ db: simulacao.db }));
import { criarRepositorioDoBanco } from "../repositorio-de-notas/banco";
import { esquecerSondagemDaWiki } from "./disponibilidade";
const dono = "4c6831c0-fdc6-4074-a832-5465b0cbb953";
// A escrita da wiki só passa pela fila e é verificada no Postgres local (persistencia.test.ts); aqui ficam as leituras.
function consulta(valor: unknown) {
  const q = { from: vi.fn(() => q), where: vi.fn((f: SQL | undefined) => { void f; return q; }), orderBy: vi.fn(() => q), limit: vi.fn(() => q),
    then: (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) => Promise.resolve(valor).then(ok, falha) };
  return q;
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("WIKI_VIVA_ATIVA", "1");
  simulacao.db.execute.mockResolvedValue([{ viva: true, automatica: true }]); esquecerSondagemDaWiki();
});
afterEach(() => vi.unstubAllEnvs());
it("lista e lê metadados exclusivamente do dono com publicação mais recente", async () => {
  const lista = consulta([]); const leitura = consulta([]);
  simulacao.db.selectDistinctOn.mockReturnValue(lista); simulacao.db.select.mockReturnValue(leitura);
  const repo = criarRepositorioDoBanco(dono);
  await repo.wiki!.listar(); await repo.wiki!.obter("9");
  expect(new PgDialect().sqlToQuery(lista.where.mock.calls[0][0]!).params).toEqual([dono]);
  expect(new PgDialect().sqlToQuery(leitura.where.mock.calls[0][0]!).params).toEqual([dono, "9"]);
  expect(leitura.orderBy).toHaveBeenCalled(); expect(leitura.limit).toHaveBeenCalledWith(1);
});
it("não carrega tabela nova enquanto a wiki estiver desligada", () => {
  vi.stubEnv("WIKI_VIVA_ATIVA", "0"); expect(criarRepositorioDoBanco(dono).wiki).toBeUndefined();
  expect(simulacao.db.select).not.toHaveBeenCalled();
});
it("o repositório não oferece escrita direta de sínteses", () => {
  expect(Object.keys(criarRepositorioDoBanco(dono).wiki!).sort()).toEqual(["automacao", "listar", "obter"]);
});

// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const simulacao = vi.hoisted(() => ({ db: { select: vi.fn(), selectDistinct: vi.fn(), selectDistinctOn: vi.fn(), insert: vi.fn(), update: vi.fn(), execute: vi.fn(), transaction: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("../db/cliente", () => ({ db: simulacao.db }));
import { criarRepositorioDoBanco } from "../repositorio-de-notas/banco";
import { paginasWiki } from "../db/schema";
import { esquecerSondagemDaWiki } from "./disponibilidade";
const dono = "4c6831c0-fdc6-4074-a832-5465b0cbb953";
const data = new Date("2026-10-22T12:00:00Z");
const fonte = { id: "1", titulo: "A", pasta: null, conteudo: "original", revisao: 1 };
const linha = { ...fonte, tags: [], criadoEm: data, atualizadoEm: data };
const entrada = { titulo: "Síntese", conteudo: "Conhecimento", fontes: [fonte], afirmacoes: [], alvo: null };
function consulta(valor: unknown, erro?: Error) {
  const q = { from: vi.fn(() => q), where: vi.fn((f: SQL | undefined) => { void f; return q; }), orderBy: vi.fn(() => q), limit: vi.fn(() => q), for: vi.fn(() => q),
    values: vi.fn((v: unknown) => { void v; return q; }), set: vi.fn((v: unknown) => { void v; return q; }), returning: vi.fn(() => q),
    then: (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) => (erro ? Promise.reject(erro) : Promise.resolve(valor)).then(ok, falha) };
  return q;
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("WIKI_VIVA_ATIVA", "1");
  simulacao.db.transaction.mockImplementation(async (f) => f(simulacao.db)); simulacao.db.execute.mockResolvedValue([{ viva: true, automatica: true }]); esquecerSondagemDaWiki();
  simulacao.db.selectDistinct.mockReturnValue(consulta([]));
});
import { afterEach } from "vitest";
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
it("recusa revisão de fonte alterada dentro da transação antes de gravar", async () => {
  const leitura = consulta([{ ...linha, revisao: 2 }]);
  simulacao.db.select.mockReturnValueOnce(consulta([])).mockReturnValueOnce(leitura);
  await expect(criarRepositorioDoBanco(dono).wiki!.publicar(entrada)).rejects.toThrow(/mudou/);
  expect(leitura.for).toHaveBeenCalledWith("share");
  expect(new PgDialect().sqlToQuery(leitura.where.mock.calls[0][0]!).params).toEqual([dono, "1"]);
  expect(simulacao.db.insert).not.toHaveBeenCalled();
});
it("grava página, histórico e evidências na transação e propaga falha na evidência", async () => {
  const erro = new Error("falha simulada da persistência");
  simulacao.db.select.mockReturnValueOnce(consulta([])).mockReturnValueOnce(consulta([linha])).mockReturnValueOnce(consulta([]));
  simulacao.db.insert.mockReturnValueOnce(consulta([{ id: "9" }])).mockReturnValueOnce(consulta([{ ...linha, id: "9", titulo: entrada.titulo }]))
    .mockReturnValueOnce(consulta([])).mockReturnValueOnce(consulta([], erro));
  simulacao.db.update.mockReturnValue(consulta([]));
  await expect(criarRepositorioDoBanco(dono).wiki!.publicar(entrada)).rejects.toBe(erro);
  expect(simulacao.db.transaction).toHaveBeenCalledTimes(1);
  expect(simulacao.db.insert.mock.calls.at(-1)?.[0]).toBe(paginasWiki);
});
it("não carrega tabela nova enquanto a wiki estiver desligada", () => {
  vi.stubEnv("WIKI_VIVA_ATIVA", "0"); expect(criarRepositorioDoBanco(dono).wiki).toBeUndefined();
  expect(simulacao.db.select).not.toHaveBeenCalled();
});
it("adota a grafia da pasta já existente como as outras criações de nota", async () => {
  const insercao = consulta([{ ...linha, id: "9", titulo: entrada.titulo, pasta: "wiki" }]);
  simulacao.db.selectDistinct.mockReturnValue(consulta([{ pasta: "wiki" }]));
  simulacao.db.select.mockReturnValueOnce(consulta([])).mockReturnValueOnce(consulta([linha])).mockReturnValueOnce(consulta([]));
  simulacao.db.insert.mockReturnValueOnce(consulta([{ id: "9" }])).mockReturnValueOnce(insercao).mockReturnValue(consulta([]));
  simulacao.db.update.mockReturnValue(consulta([]));
  await criarRepositorioDoBanco(dono).wiki!.publicar(entrada);
  expect(insercao.values).toHaveBeenCalledWith(expect.objectContaining({ pasta: "wiki" }));
});

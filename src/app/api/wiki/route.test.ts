import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { pedido, SEGREDO_DE_TESTE } from "../notas/apoio-de-teste";
import { criarRepositorioEmMemoria } from "@/lib/repositorio-de-notas/memoria";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { processarWiki } from "@/lib/wiki/automacao";
import * as rota from "./route";

vi.mock("@/lib/repositorio-de-notas", () => ({ obterRepositorio: vi.fn() }));
const { GET } = rota;
let repo: ReturnType<typeof criarRepositorioEmMemoria>;

beforeEach(async () => {
  vi.clearAllMocks(); vi.stubEnv("SEGREDO_SESSAO", SEGREDO_DE_TESTE);
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "Texto de origem que serve de evidência." }]);
  vi.setSystemTime(new Date("2026-10-22T12:05:00Z"));
  await processarWiki(repo, async (c) => ({ proposta: { propostas: [{ titulo: "Conceito", alvoId: null, aliases: [], lacunas: [],
    afirmacoes: [{ texto: "Síntese", natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: "Texto de origem que serve de evidência" }] }] }] }, uso: null }), { tetoDiario: 200_000 });
  vi.mocked(obterRepositorio).mockResolvedValue(repo);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it("a manutenção é automática: a rota só expõe leitura", () => {
  expect(Object.keys(rota).filter((nome) => ["POST", "PUT", "PATCH", "DELETE"].includes(nome))).toEqual([]);
});

it("exige sessão antes de acessar as notas", async () => {
  expect((await GET(pedido("/api/wiki", { autenticado: false }))).status).toBe(401);
  expect(obterRepositorio).not.toHaveBeenCalled();
});

it("lista as sínteses com estado e origens, sem notas para seleção", async () => {
  const corpo = await (await GET(pedido("/api/wiki"))).json();
  expect(Object.keys(corpo)).toEqual(["paginas"]);
  expect(corpo.paginas[0]).toMatchObject({ titulo: "Conceito", estado: "atualizada", fontes: 1 });
});

it("devolve a síntese, o estado e as evidências das origens acessíveis", async () => {
  const [{ id }] = (await (await GET(pedido("/api/wiki"))).json()).paginas;
  const corpo = await (await GET(pedido(`/api/wiki?id=${id}`))).json();
  expect(corpo).toMatchObject({ estado: "atualizada", nota: { titulo: "Conceito" } });
  expect(corpo.evidencias.afirmacoes[0].evidencias[0].citacao).toBe("Texto de origem que serve de evidência");
});

it("omite evidências de origens que o usuário não alcança mais", async () => {
  const [{ id }] = (await (await GET(pedido("/api/wiki"))).json()).paginas;
  vi.mocked(obterRepositorio).mockResolvedValue({ ...repo, obterNota: async (alvo: string) => (alvo === "1" ? null : repo.obterNota(alvo)) });
  const corpo = await (await GET(pedido(`/api/wiki?id=${id}`))).json();
  expect(corpo.evidencias.fontes).toEqual([]);
  expect(corpo.evidencias.afirmacoes[0].evidencias).toEqual([]);
});

it("página inexistente responde 404 e a wiki desligada, 503", async () => {
  expect((await GET(pedido("/api/wiki?id=999"))).status).toBe(404);
  vi.mocked(obterRepositorio).mockResolvedValue({ ...repo, wiki: undefined });
  expect((await GET(pedido("/api/wiki"))).status).toBe(503);
});

it("falha interna não vaza a mensagem e registra só a categoria", async () => {
  const registro = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(obterRepositorio).mockRejectedValue(Object.assign(new Error("segredo e texto privado"), { code: "57014" }));
  const res = await GET(pedido("/api/wiki"));
  expect(res.status).toBe(500);
  expect(await res.text()).not.toContain("segredo");
  expect(JSON.stringify(registro.mock.calls)).not.toContain("segredo");
  expect(registro).toHaveBeenCalledWith(expect.stringContaining("[wiki]"), { erro: "Error:57014" });
  registro.mockRestore();
});

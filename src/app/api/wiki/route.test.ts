import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { pedido, SEGREDO_DE_TESTE } from "../notas/apoio-de-teste";
import { criarRepositorioEmMemoria } from "@/lib/repositorio-de-notas/memoria";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { gerarSinteseWiki } from "@/lib/wiki/gerador";
import { GET, POST } from "./route";
const limitador = vi.hoisted(() => ({ tentar: vi.fn() }));
vi.mock("@/lib/limite-de-uso", () => ({ criarLimitadorDeUso: () => limitador }));
vi.mock("@/lib/repositorio-de-notas", () => ({ obterRepositorio: vi.fn() }));
vi.mock("@/lib/wiki/gerador", () => ({ gerarSinteseWiki: vi.fn() }));
let repo: ReturnType<typeof criarRepositorioEmMemoria>;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("SEGREDO_SESSAO", SEGREDO_DE_TESTE); vi.stubEnv("OPENAI_API_KEY", "falsa");
  limitador.tentar.mockReturnValue({ permitido: true });
  repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "Texto de origem." }]);
  vi.mocked(obterRepositorio).mockResolvedValue(repo);
  vi.mocked(gerarSinteseWiki).mockResolvedValue({ afirmacoes: [{ texto: "Síntese", natureza: "explicita", evidencias: [{ fonteId: "1", citacao: "Texto de origem" }] }], lacunas: [] });
});
afterEach(() => vi.unstubAllEnvs());
it("exige sessão antes de acessar notas e origem antes de gerar", async () => {
  expect((await GET(pedido("/api/wiki", { autenticado: false }))).status).toBe(401);
  expect((await POST(pedido("/api/wiki", { metodo: "POST", corpo: {}, cabecalhos: { origin: "https://outro.local" } }))).status).toBe(403);
  expect(obterRepositorio).not.toHaveBeenCalled(); expect(gerarSinteseWiki).not.toHaveBeenCalled();
});
it("gera sob pedido, lista índice e permite consultar evidências", async () => {
  const res = await POST(pedido("/api/wiki", { metodo: "POST", corpo: { titulo: "Conceito", fontes: ["1"] } }));
  expect(res.status).toBe(201);
  const { nota } = await res.json();
  const indice = await GET(pedido("/api/wiki"));
  expect(indice.headers.get("cache-control")).toBe("no-store");
  expect((await indice.json()).paginas[0]).toMatchObject({ titulo: "Conceito", estado: "atualizada" });
  const detalhe = await (await GET(pedido(`/api/wiki?id=${nota.id}`))).json();
  expect(detalhe.evidencias.fontes[0].conteudo).toBe("Texto de origem.");
});
it("recusa configuração, metadados extras e seleção inválida sem inferência", async () => {
  expect((await POST(pedido("/api/wiki", { metodo: "POST", corpo: { titulo: "X", fontes: ["1"], userId: "intruso" } }))).status).toBe(400);
  expect((await POST(pedido("/api/wiki", { metodo: "POST", corpo: { titulo: "X", fontes: ["99"] } }))).status).toBe(404);
  vi.stubEnv("OPENAI_API_KEY", "");
  expect((await POST(pedido("/api/wiki", { metodo: "POST", corpo: { titulo: "X", fontes: ["1"] } }))).status).toBe(503);
  expect(gerarSinteseWiki).not.toHaveBeenCalled();
});
it("não expõe erro do provedor e não grava síntese incompleta", async () => {
  vi.mocked(gerarSinteseWiki).mockRejectedValue(new Error("segredo e texto privado"));
  const res = await POST(pedido("/api/wiki", { metodo: "POST", corpo: { titulo: "X", fontes: ["1"] } }));
  expect(res.status).toBe(500); expect(await res.text()).not.toMatch(/segredo|privado/);
  expect(await repo.listarResumos()).toHaveLength(1);
});
it("aplica limite de frequência e preserva somente leitura sem chamar o modelo", async () => {
  limitador.tentar.mockReturnValueOnce({ permitido: false, esperarSegundos: 30 });
  const res = await POST(pedido("/api/wiki", { metodo: "POST", corpo: { titulo: "X", fontes: ["1"] } }));
  expect(res.status).toBe(429); expect(res.headers.get("retry-after")).toBe("30");
  vi.mocked(obterRepositorio).mockResolvedValue({ ...repo, capacidades: { escrita: false, datas: true } });
  expect((await POST(pedido("/api/wiki", { metodo: "POST", corpo: { titulo: "X", fontes: ["1"] } }))).status).toBe(403);
  expect(gerarSinteseWiki).not.toHaveBeenCalled();
});
it("trata ausência de página e wiki desativada", async () => {
  expect((await GET(pedido("/api/wiki?id=99"))).status).toBe(404);
  vi.mocked(obterRepositorio).mockResolvedValue({ ...repo, wiki: undefined });
  expect((await GET(pedido("/api/wiki"))).status).toBe(503);
});

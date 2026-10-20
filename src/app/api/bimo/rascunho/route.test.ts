import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/rascunho-do-bimo", () => ({ gerarRascunho: vi.fn() }));
import { gerarRascunho } from "@/lib/rascunho-do-bimo";
import { criarTokenDeSessao, NOME_DO_COOKIE } from "@/lib/sessao";
import { POST } from "./route";
const pedido = { acao: "continuar", titulo: " Nota ", antes: " Texto ", trecho: "", depois: " " };
let ip = 0;
function requisicao(corpo: unknown = pedido, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/bimo/rascunho", {
    method: "POST", headers: { "content-type": "application/json", cookie: `${NOME_DO_COOKIE}=${criarTokenDeSessao()}`, "x-forwarded-for": String(ip), ...headers },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}
beforeEach(() => {
  ip++;
  // O limite é um só (app de um usuário) e vale por minuto: cada teste roda em "um minuto" próprio.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2030, 0, 1).getTime() + ip * 120_000);
  vi.resetAllMocks();
  vi.stubEnv("SEGREDO_SESSAO", "um-segredo-de-testes-com-mais-de-32-caracteres");
  vi.stubEnv("GEMINI_API_KEY", "teste");
  vi.mocked(gerarRascunho).mockResolvedValue("sugestão");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });
it("exige sessão antes da origem e do corpo", async () => {
  expect((await POST(requisicao("inválido", { cookie: "", origin: "http://outro" }))).status).toBe(401);
  expect(gerarRascunho).not.toHaveBeenCalled();
});
it("recusa outra origem", async () => {
  expect((await POST(requisicao(pedido, { origin: "http://outro" }))).status).toBe(403);
  expect(gerarRascunho).not.toHaveBeenCalled();
});
it.each([
  "inválido", {}, { ...pedido, acao: "apagar" }, { ...pedido, antes: " " },
  { ...pedido, trecho: "seleção" }, { ...pedido, acao: "resumir", trecho: " " },
  { ...pedido, acao: "melhorar", trecho: "" }, { ...pedido, titulo: "x".repeat(201) },
  { ...pedido, antes: "x".repeat(4001) }, { ...pedido, depois: "x".repeat(2001) },
  { ...pedido, acao: "resumir", trecho: "x".repeat(8001) },
])("recusa corpo inválido %j", async (corpo) => {
  expect((await POST(requisicao(corpo))).status).toBe(400);
  expect(gerarRascunho).not.toHaveBeenCalled();
});
it("limita bytes reais mesmo sem content-length", async () => {
  expect((await POST(requisicao({ ...pedido, extra: "x".repeat(65_536) }))).status).toBe(413);
  expect(gerarRascunho).not.toHaveBeenCalled();
});
it("exige JSON", async () => {
  expect((await POST(requisicao(pedido, { "content-type": "text/plain" }))).status).toBe(415);
});
it("gera com campos aparados e sem cache", async () => {
  const resposta = await POST(requisicao());
  expect(resposta.status).toBe(200);
  expect(resposta.headers.get("cache-control")).toBe("no-store");
  expect(await resposta.json()).toEqual({ texto: "sugestão" });
  expect(gerarRascunho).toHaveBeenCalledWith({ acao: "continuar", titulo: "Nota", antes: "Texto", trecho: "", depois: "" }, { sinal: expect.any(AbortSignal) });
});
it("limita a 20 pedidos por minuto no total: mudar o x-forwarded-for não zera o limite", async () => {
  for (let indice = 0; indice < 20; indice++) expect((await POST(requisicao(pedido, { "x-forwarded-for": `10.0.0.${indice}` }))).status).toBe(200);
  const resposta = await POST(requisicao(pedido, { "x-forwarded-for": "10.9.9.9" }));
  expect(resposta.status).toBe(429);
  expect(Number(resposta.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(await resposta.json()).toEqual({ erro: "Muitos pedidos seguidos. Espere alguns segundos." });
  expect(gerarRascunho).toHaveBeenCalledTimes(20);
});
it("não expõe erros nem conteúdo da nota no log", async () => {
  vi.mocked(gerarRascunho).mockRejectedValue(new Error("segredo Texto"));
  const resposta = await POST(requisicao());
  expect(resposta.status).toBe(500);
  expect(await resposta.json()).toEqual({ erro: "Não consegui gerar o rascunho agora. Tente de novo." });
  expect(console.error).toHaveBeenCalled();
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("Texto");
});
it("configuração ausente retorna 503 genérico", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  const resposta = await POST(requisicao());
  expect(resposta.status).toBe(503);
  expect(JSON.stringify(await resposta.json())).not.toContain("GEMINI_API_KEY");
  expect(gerarRascunho).not.toHaveBeenCalled();
});

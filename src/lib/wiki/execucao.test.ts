// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("../repositorio-de-notas", () => ({ obterRepositorio: vi.fn() }));
vi.mock("./gerador", () => ({ gerarConhecimentoWiki: vi.fn() }));
import { executorWikiAutorizado } from "./configuracao";
import { POST } from "../../app/api/wiki/processar/route";
import { obterRepositorio } from "../repositorio-de-notas";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { gerarConhecimentoWiki } from "./gerador";
import { criarTokenDeSessao, NOME_DO_COOKIE } from "../sessao";

const segredo = "segredo-ficticio-do-executor-mais-de-32-caracteres";
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
it("não aceita segredo ausente, curto ou token incorreto", () => {
  for (const configurado of ["", "curto", segredo]) {
    vi.stubEnv("WIKI_EXECUTOR_SEGREDO", configurado);
    expect(executorWikiAutorizado(new Request("https://bimo.local/api/wiki/processar", { headers: { authorization: "Bearer errado" } }))).toBe(false);
  }
});
it("barra acesso sem sessão ou segredo antes de consultar banco ou modelo", async () => {
  vi.stubEnv("SEGREDO_SESSAO", "segredo-de-sessao-falso-mais-de-32-caracteres");
  const r = await POST(new Request("https://bimo.local/api/wiki/processar", { method: "POST" }));
  expect(r.status).toBe(401);
  expect(obterRepositorio).not.toHaveBeenCalled();
  expect(gerarConhecimentoWiki).not.toHaveBeenCalled();
});
it("aceita executor autenticado e não expõe notas nem chamadas pagas quando ocioso", async () => {
  vi.stubEnv("WIKI_EXECUTOR_SEGREDO", segredo); vi.stubEnv("WIKI_VIVA_ATIVA", "1");
  vi.stubEnv("WIKI_AUTOMATICA_ATIVA", "1"); vi.stubEnv("OPENAI_API_KEY", "falsa");
  vi.mocked(obterRepositorio).mockResolvedValue(criarRepositorioEmMemoria());
  const r = await POST(new Request("https://bimo.local/api/wiki/processar", { method: "POST", headers: { authorization: `Bearer ${segredo}` } }));
  expect(r.status).toBe(200); expect(await r.json()).toMatchObject({ tipo: "ocioso" });
  expect(gerarConhecimentoWiki).not.toHaveBeenCalled();
});
it("uma sessão do navegador ainda exige mesma origem", async () => {
  vi.stubEnv("SEGREDO_SESSAO", "segredo-de-sessao-falso-mais-de-32-caracteres");
  const r = await POST(new Request("https://bimo.local/api/wiki/processar", { method: "POST", headers: {
    cookie: `${NOME_DO_COOKIE}=${criarTokenDeSessao()}`, origin: "https://outro.local",
  } }));
  expect(r.status).toBe(403); expect(obterRepositorio).not.toHaveBeenCalled();
});

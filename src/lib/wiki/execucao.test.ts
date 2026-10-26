// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("../repositorio-de-notas", () => ({ obterRepositorio: vi.fn() }));
vi.mock("./gerador", () => ({ gerarConhecimentoWiki: vi.fn() }));
import { executorWikiAutorizado } from "./configuracao";
import { GET, POST } from "../../app/api/wiki/processar/route";
import { obterRepositorio } from "../repositorio-de-notas";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { gerarConhecimentoWiki } from "./gerador";
import { criarTokenDeSessao, NOME_DO_COOKIE } from "../sessao";

const segredo = "segredo-ficticio-do-executor-mais-de-32-caracteres";
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.resetAllMocks(); });
it("GET exige o segredo exclusivo do Cron, mesmo com sessão válida, e não retoma trabalhos bloqueados", async () => {
  vi.stubEnv("CRON_SECRET", segredo); vi.stubEnv("SEGREDO_SESSAO", "segredo-de-sessao-falso-mais-de-32-caracteres");
  expect((await GET(new Request("https://bimo.local/api/wiki/processar", { headers: { cookie: `${NOME_DO_COOKIE}=${criarTokenDeSessao()}` } }))).status).toBe(401);
  expect(obterRepositorio).not.toHaveBeenCalled();
  vi.stubEnv("WIKI_VIVA_ATIVA", "1"); vi.stubEnv("WIKI_AUTOMATICA_ATIVA", "1"); vi.stubEnv("OPENAI_API_KEY", "falsa");
  const repo = criarRepositorioEmMemoria(); const retomar = vi.spyOn(repo.wiki!.automacao!, "retomar");
  vi.mocked(obterRepositorio).mockResolvedValue(repo);
  const r = await GET(new Request("https://bimo.local/api/wiki/processar?acao=retomar", { headers: { authorization: `Bearer ${segredo}` } }));
  expect(r.status).toBe(200); expect(retomar).not.toHaveBeenCalled(); expect(gerarConhecimentoWiki).not.toHaveBeenCalled();
});
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

it.each(["GET", "POST"])("%s percorre o acervo em lote e informa cobertura sem expor notas", async (metodo) => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
  vi.stubEnv("CRON_SECRET", segredo); vi.stubEnv("WIKI_EXECUTOR_SEGREDO", segredo);
  vi.stubEnv("WIKI_VIVA_ATIVA", "1"); vi.stubEnv("WIKI_AUTOMATICA_ATIVA", "1"); vi.stubEnv("OPENAI_API_KEY", "falsa");
  const repo = criarRepositorioEmMemoria([1, 2, 3].map((n) => ({ titulo: `Origem ${n}`, conteudo: "conteúdo privado da origem" })));
  vi.advanceTimersByTime(91_000);
  vi.mocked(obterRepositorio).mockResolvedValue(repo);
  vi.mocked(gerarConhecimentoWiki).mockResolvedValue({ proposta: { propostas: [] }, uso: { entrada: 100, saida: 20 } });
  const executar = metodo === "GET" ? GET : POST;
  const resposta = await executar(new Request("https://bimo.local/api/wiki/processar", { method: metodo, headers: { authorization: `Bearer ${segredo}` } }));
  const texto = await resposta.text(); const dados = JSON.parse(texto);
  expect(resposta.status).toBe(200);
  expect(dados).toMatchObject({ lote: { processados: 3, parada: "ocioso" }, cobertura: { concluidos: 3, pendentes: 0 } });
  expect(gerarConhecimentoWiki).toHaveBeenCalledTimes(3);
  expect(texto).not.toMatch(/conteúdo privado|Origem|fonteId/);
});

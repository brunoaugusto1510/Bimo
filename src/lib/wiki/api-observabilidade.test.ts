// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../repositorio-de-notas", () => ({ obterRepositorio: vi.fn() }));
vi.mock("./agendar", () => ({ agendarManutencaoWiki: vi.fn() }));
import { obterRepositorio } from "../repositorio-de-notas";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { criarTokenDeSessao, NOME_DO_COOKIE } from "../sessao";
import { GET as diario } from "../../app/api/wiki/diario/route";
import { GET as cerebro } from "../../app/api/wiki/cerebro/route";
import { POST as gerenciar } from "../../app/api/wiki/gerenciamento/route";
import { GET as detalhe } from "../../app/api/wiki/route";

beforeEach(() => { vi.stubEnv("SEGREDO_SESSAO", "segredo-ficticio-de-sessao-com-mais-de-32-caracteres"); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetAllMocks(); });
const pedido = (caminho: string, dados?: object) => new Request(`https://bimo.local${caminho}`, { method: dados ? "POST" : "GET", headers: {
  cookie: `${NOME_DO_COOKIE}=${criarTokenDeSessao()}`, ...(dados ? { origin: "https://bimo.local", "content-type": "application/json" } : {}),
}, ...(dados ? { body: JSON.stringify(dados) } : {}) });
it("barra leitura anônima de diário e cérebro antes de acessar dados", async () => {
  for (const ler of [diario, cerebro]) expect((await ler(new Request("https://bimo.local/api/wiki/diario"))).status).toBe(401);
  expect(obterRepositorio).not.toHaveBeenCalled();
});
it("valida período, tamanho e cursor do diário antes de acessar dados", async () => {
  for (const consulta of ["inicio=errado", "limite=101", "limite=0", "antesId=errado", "antesEm=2026-10-23T00:00:00Z", "inicio=2020-01-01T00:00:00Z&fim=2026-10-23T00:00:00Z"]) {
    expect((await diario(pedido(`/api/wiki/diario?${consulta}`))).status).toBe(400);
  }
  expect(obterRepositorio).not.toHaveBeenCalled();
});
it("devolve resumo e diário sem cache e só fornece cursor quando existe outra página", async () => {
  const repo = criarRepositorioEmMemoria(); vi.mocked(obterRepositorio).mockResolvedValue(repo);
  const energia = await cerebro(pedido("/api/wiki/cerebro"));
  expect(energia.headers.get("cache-control")).toBe("no-store");
  expect(await energia.json()).toMatchObject({ resumo: { neuronios: 0, notasLidas: 0 }, energia: { utilizada: 0 } });
  const ler = vi.spyOn(repo.wiki!.automacao!, "diario");
  ler.mockResolvedValueOnce([1, 2, 3].map((n) => ({ id: String(n), tipo: "nasceu", sinteseId: null, origemId: null, texto: "Nasceu", criadoEm: "2026-10-23T12:00:00.123456Z" })));
  const r = await diario(pedido("/api/wiki/diario?limite=2")); const dados = await r.json();
  expect(dados.eventos).toHaveLength(2); expect(dados.proximo).toEqual({ criadoEm: "2026-10-23T12:00:00.123456Z", id: "2" });
  expect(ler).toHaveBeenCalledWith(expect.objectContaining({ limite: 3 }));
  expect(r.headers.get("cache-control")).toBe("no-store");
  expect((await (await diario(pedido("/api/wiki/diario"))).json()).proximo).toBeNull();
});
it("pausar exige mesma origem e revisão; não aceita pausar e devolver na mesma operação", async () => {
  const repo = criarRepositorioEmMemoria(); vi.mocked(obterRepositorio).mockResolvedValue(repo);
  const pausar = vi.spyOn(repo.wiki!.automacao!, "pausar").mockResolvedValue("conflito");
  const dados = { notaId: "1", revisaoBase: 1, pausada: true };
  expect((await gerenciar(pedido("/api/wiki/gerenciamento", { ...dados, gerenciada: true }))).status).toBe(400);
  const cruzado = pedido("/api/wiki/gerenciamento", dados); cruzado.headers.set("origin", "https://outro.local");
  expect((await gerenciar(cruzado)).status).toBe(403);
  expect(pausar).not.toHaveBeenCalled();
  expect((await gerenciar(pedido("/api/wiki/gerenciamento", dados))).status).toBe(409);
  expect(pausar).toHaveBeenCalledWith("1", 1, true);
});
it("detalhe recupera perguntas antigas, informa estado e não devolve raízes removidas", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Síntese", conteudo: "## Questões em aberto\n\n- E amanhã?\n\n## Notas de origem\n" }]);
  vi.spyOn(repo.wiki!, "obter").mockResolvedValue({ notaId: "1", revisaoPublicada: 1, fontes: [{ id: "removida", titulo: "A", pasta: null, revisao: 1, conteudo: "O conteúdo antigo da origem." }],
    afirmacoes: [], estrutura: { ligacoes: [], lacunas: [] } });
  vi.mocked(obterRepositorio).mockResolvedValue(repo);
  const r = await detalhe(pedido("/api/wiki?id=1"));
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ estadoNeuronio: "sem_raizes", pausada: false, evidencias: { fontes: [], estrutura: { lacunas: ["E amanhã?"] } } });
});

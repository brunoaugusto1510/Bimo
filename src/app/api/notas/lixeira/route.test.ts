import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "@/lib/repositorio-de-notas/memoria";
import { pedido, SEGREDO_DE_TESTE, contextoComId } from "../apoio-de-teste";
import type { RepositorioDeNotas } from "@/lib/repositorio-de-notas/tipos";
const sim = vi.hoisted(() => ({ repo: null as RepositorioDeNotas | null, agendar: vi.fn() }));
vi.mock("@/lib/repositorio-de-notas", () => ({ obterRepositorio: async () => sim.repo! }));
vi.mock("@/lib/wiki/agendar", () => ({ agendarManutencaoWiki: sim.agendar }));
import { GET } from "./route";
import { POST as mover } from "../[id]/lixeira/route";
import { POST as restaurar } from "../[id]/restaurar/route";
beforeEach(() => {
  vi.stubEnv("SEGREDO_SESSAO", SEGREDO_DE_TESTE); sim.agendar.mockClear();
  sim.repo = criarRepositorioEmMemoria([{ titulo: "Privada", conteudo: "conteúdo" }]);
});
afterEach(() => vi.unstubAllEnvs());
const escrever = (restaura = false, corpo: unknown = { revisaoBase: restaura ? 2 : 1 }, extras = {}) =>
  (restaura ? restaurar : mover)(pedido("/api/notas/1/lixeira", { metodo: "POST", corpo, ...extras }), contextoComId("1"));
it("move, lista sem conteúdo e restaura pela API com cache desabilitado", async () => {
  expect((await escrever()).status).toBe(200);
  const lista = await GET(pedido("/api/notas/lixeira"));
  expect(lista.headers.get("cache-control")).toBe("no-store");
  const { notas } = await lista.json();
  expect(notas).toMatchObject([{ titulo: "Privada", revisao: 2 }]);
  expect(notas[0]).not.toHaveProperty("conteudo");
  expect((await escrever(true)).status).toBe(200);
  expect(sim.agendar).toHaveBeenCalledTimes(2);
  expect((await sim.repo!.obterNota("1"))?.conteudo).toBe("conteúdo");
});
it("exige sessão para listar, remover e restaurar", async () => {
  expect((await GET(pedido("/api/notas/lixeira", { autenticado: false }))).status).toBe(401);
  expect((await escrever(false, { revisaoBase: 1 }, { autenticado: false })).status).toBe(401);
  expect((await escrever(true, { revisaoBase: 2 }, { autenticado: false })).status).toBe(401);
  expect(await sim.repo!.listarLixeira()).toEqual([]);
});
it.each([false, true])("recusa outra origem e somente leitura, restaurar=%s", async (restaura) => {
  expect((await escrever(restaura, { revisaoBase: 1 }, { cabecalhos: { origin: "https://outro.example" } })).status).toBe(403);
  sim.repo!.capacidades.escrita = false;
  expect((await escrever(restaura)).status).toBe(403);
  expect(await sim.repo!.listarLixeira()).toEqual([]);
});
it.each([{}, { revisaoBase: -1 }, { revisaoBase: 1.2 }, { revisaoBase: 1, userId: "outro" }])("valida revisão e rejeita campos extras: %j", async (corpo) => {
  expect((await escrever(false, corpo)).status).toBe(400);
  expect(await sim.repo!.listarLixeira()).toEqual([]);
});
it("devolve 409 para edição concorrente e para colisão ao restaurar", async () => {
  expect((await escrever(false, { revisaoBase: 9 })).status).toBe(409);
  await escrever();
  await sim.repo!.criarNota({ titulo: "Privada" }, { criadoPor: "usuario" });
  const resposta = await escrever(true);
  expect(resposta.status).toBe(409);
  expect(await resposta.json()).toMatchObject({ tipo: "titulo-em-uso" });
  expect(await sim.repo!.listarLixeira()).toHaveLength(1);
});

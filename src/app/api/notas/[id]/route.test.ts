import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "@/lib/repositorio-de-notas/memoria";
import type { RepositorioDeNotas } from "@/lib/repositorio-de-notas/tipos";
import { SEGREDO_DE_TESTE, contextoComId, pedido } from "../apoio-de-teste";

const estado = vi.hoisted(() => ({ repo: null as RepositorioDeNotas | null }));
vi.mock("@/lib/repositorio-de-notas", () => ({ obterRepositorio: async () => estado.repo! }));

import { GET, PATCH } from "./route";

let idA = "";

beforeEach(async () => {
  process.env.SEGREDO_SESSAO = SEGREDO_DE_TESTE;
  estado.repo = criarRepositorioEmMemoria([
    { titulo: "A", pasta: "Pasta", conteudo: "Veja [[B]] e [[Fantasma]]. Falei de zebra." },
    { titulo: "B", conteudo: "Volta para [[A]]." },
    { titulo: "Zebra", conteudo: "" },
  ]);
  const resumos = await estado.repo.listarResumos();
  idA = resumos.find((r) => r.titulo === "A")!.id;
});

afterEach(() => {
  delete process.env.SEGREDO_SESSAO;
});

describe("GET /api/notas/[id]", () => {
  it("devolve a nota e as capacidades, sem esperar pelo cálculo das ligações", async () => {
    const listar = vi.spyOn(estado.repo!, "listarComConteudo");

    const res = await GET(pedido(`/api/notas/${idA}`), contextoComId(idA));

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.nota).toMatchObject({ id: idA, titulo: "A", conteudo: expect.stringContaining("[[B]]") });
    expect(corpo.capacidades).toEqual({ escrita: true, datas: true });
    // Ler uma nota é ler uma nota: não baixa todas as outras (seriam centenas de leituras).
    expect(listar).not.toHaveBeenCalled();
  });

  it("devolve 404 para uma nota que não existe e 400 para um id inválido", async () => {
    expect((await GET(pedido("/api/notas/999"), contextoComId("999"))).status).toBe(404);
    expect((await GET(pedido("/api/notas/a:b"), contextoComId("a:b"))).status).toBe(400);
    expect((await GET(pedido("/api/notas/..%2Fx"), contextoComId("../x"))).status).toBe(400);
  });

  it("devolve 401 sem sessão", async () => {
    expect((await GET(pedido(`/api/notas/${idA}`, { autenticado: false }), contextoComId(idA))).status).toBe(401);
  });
});

describe("PATCH /api/notas/[id]", () => {
  const patch = (id: string, corpo: unknown, extras = {}) =>
    PATCH(pedido(`/api/notas/${id}`, { metodo: "PATCH", corpo, ...extras }), contextoComId(id));

  it("grava o conteúdo e devolve a nota com a revisão nova", async () => {
    const res = await patch(idA, { revisaoBase: 1, conteudo: "texto novo" });

    expect(res.status).toBe(200);
    expect((await res.json()).nota).toMatchObject({ conteudo: "texto novo", revisao: 2 });
    expect((await estado.repo!.obterNota(idA))?.conteudo).toBe("texto novo");
  });

  it("move de pasta e troca as tags, normalizando", async () => {
    const res = await patch(idA, { revisaoBase: 1, pasta: " / Outra / ", tags: ["#x", "x", "y"], checkpoint: true });

    expect((await res.json()).nota).toMatchObject({ pasta: "Outra", tags: ["x", "y"] });
  });

  it("devolve 409 com o que está salvo quando a revisão ficou velha", async () => {
    await patch(idA, { revisaoBase: 1, conteudo: "v2" });

    const res = await patch(idA, { revisaoBase: 1, conteudo: "v3" });

    expect(res.status).toBe(409);
    const corpo = await res.json();
    expect(corpo).toMatchObject({ tipo: "conflito" });
    expect(corpo.atual.conteudo).toBe("v2");
  });

  it("devolve 404 para nota inexistente, 400 sem revisaoBase e 400 para id inválido", async () => {
    expect((await patch("999", { revisaoBase: 1, conteudo: "x" })).status).toBe(404);
    expect((await patch(idA, { conteudo: "x" })).status).toBe(400);
    expect((await patch("a:b", { revisaoBase: 1 })).status).toBe(400);
  });

  it("não deixa mudar o título por aqui: título só muda em /renomear", async () => {
    await patch(idA, { revisaoBase: 1, titulo: "Outro", conteudo: "x" });

    expect((await estado.repo!.obterNota(idA))?.titulo).toBe("A");
  });

  it("devolve 403 de outra origem e 401 sem sessão, sem gravar", async () => {
    const outraOrigem = await patch(idA, { revisaoBase: 1, conteudo: "x" }, { cabecalhos: { origin: "https://x.example" } });
    const semSessao = await patch(idA, { revisaoBase: 1, conteudo: "x" }, { autenticado: false });

    expect(outraOrigem.status).toBe(403);
    expect(semSessao.status).toBe(401);
    expect((await estado.repo!.obterNota(idA))?.conteudo).not.toBe("x");
  });
});

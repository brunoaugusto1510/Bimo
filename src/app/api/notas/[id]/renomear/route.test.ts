import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "@/lib/repositorio-de-notas/memoria";
import type { RepositorioDeNotas } from "@/lib/repositorio-de-notas/tipos";
import { SEGREDO_DE_TESTE, contextoComId, pedido } from "../../apoio-de-teste";

const estado = vi.hoisted(() => ({ repo: null as RepositorioDeNotas | null }));
vi.mock("@/lib/repositorio-de-notas", () => ({ obterRepositorio: async () => estado.repo! }));

import { POST } from "./route";

let idA = "";
let idB = "";

beforeEach(async () => {
  process.env.SEGREDO_SESSAO = SEGREDO_DE_TESTE;
  estado.repo = criarRepositorioEmMemoria([
    { titulo: "Antigo", conteudo: "" },
    { titulo: "Outra", conteudo: "veja [[Antigo]] e [[Antigo|apelido]]" },
  ]);
  const resumos = await estado.repo.listarResumos();
  idA = resumos.find((r) => r.titulo === "Antigo")!.id;
  idB = resumos.find((r) => r.titulo === "Outra")!.id;
});

afterEach(() => {
  delete process.env.SEGREDO_SESSAO;
});

const renomear = (id: string, corpo: unknown, extras = {}) =>
  POST(pedido(`/api/notas/${id}/renomear`, { metodo: "POST", corpo, ...extras }), contextoComId(id));

describe("POST /api/notas/[id]/renomear", () => {
  it("renomeia, reescreve as ligações das outras notas e diz quantas mudaram", async () => {
    const res = await renomear(idA, { revisaoBase: 1, titulo: " Novo " });

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.nota.titulo).toBe("Novo");
    expect(corpo.notasReescritas).toBe(1);
    expect((await estado.repo!.obterNota(idB))?.conteudo).toBe("veja [[Novo]] e [[Novo|apelido]]");
  });

  it("devolve 409 quando o título já existe na pasta, dizendo qual nota o usa", async () => {
    const res = await renomear(idA, { revisaoBase: 1, titulo: "outra" });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ tipo: "titulo-em-uso", idExistente: idB });
  });

  it("devolve 409 de conflito quando a revisão ficou velha", async () => {
    await estado.repo!.atualizarNota(idA, { conteudo: "mudou" }, { revisaoBase: 1, autor: { criadoPor: "usuario" } });

    const res = await renomear(idA, { revisaoBase: 1, titulo: "Novo" });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ tipo: "conflito" });
  });

  it("devolve 400 para título inválido, 404 para nota inexistente e 400 para id inválido", async () => {
    expect((await renomear(idA, { revisaoBase: 1, titulo: "A/B" })).status).toBe(400);
    expect((await renomear("999", { revisaoBase: 1, titulo: "X" })).status).toBe(404);
    expect((await renomear("a:b", { revisaoBase: 1, titulo: "X" })).status).toBe(400);
  });

  it("devolve 403 de outra origem e 401 sem sessão", async () => {
    expect((await renomear(idA, { revisaoBase: 1, titulo: "X" }, { cabecalhos: { origin: "https://x.example" } })).status).toBe(403);
    expect((await renomear(idA, { revisaoBase: 1, titulo: "X" }, { autenticado: false })).status).toBe(401);
    expect((await estado.repo!.obterNota(idA))?.titulo).toBe("Antigo");
  });
});

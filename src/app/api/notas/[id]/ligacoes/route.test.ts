import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "@/lib/repositorio-de-notas/memoria";
import type { RepositorioDeNotas } from "@/lib/repositorio-de-notas/tipos";
import { SEGREDO_DE_TESTE, contextoComId, pedido } from "../../apoio-de-teste";

const estado = vi.hoisted(() => ({ repo: null as RepositorioDeNotas | null }));
vi.mock("@/lib/repositorio-de-notas", () => ({ obterRepositorio: async () => estado.repo! }));

import { GET } from "./route";

let idA = "";

beforeEach(async () => {
  process.env.SEGREDO_SESSAO = SEGREDO_DE_TESTE;
  estado.repo = criarRepositorioEmMemoria([
    { titulo: "A", pasta: "Pasta", conteudo: "Veja [[B]] e [[Fantasma]]. Falei de zebra." },
    { titulo: "B", conteudo: "Volta para [[A]]." },
    { titulo: "Zebra", conteudo: "" },
  ]);
  idA = (await estado.repo.listarResumos()).find((r) => r.titulo === "A")!.id;
});

afterEach(() => {
  delete process.env.SEGREDO_SESSAO;
});

describe("GET /api/notas/[id]/ligacoes", () => {
  it("devolve quem a nota cita, quem a cita e os títulos mencionados sem ligação", async () => {
    const res = await GET(pedido(`/api/notas/${idA}/ligacoes`), contextoComId(idA));

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.ligacoes.saida.map((d: { titulo: string }) => d.titulo)).toEqual(["B", "Fantasma"]);
    expect(corpo.ligacoes.entrada.map((e: { titulo: string }) => e.titulo)).toEqual(["B"]);
    expect(corpo.mencoesSemLigacao.map((m: { titulo: string }) => m.titulo)).toEqual(["Zebra"]);
  });

  it("devolve 404 para nota inexistente, 400 para id inválido e 401 sem sessão", async () => {
    expect((await GET(pedido("/api/notas/999/ligacoes"), contextoComId("999"))).status).toBe(404);
    expect((await GET(pedido("/api/notas/a:b/ligacoes"), contextoComId("a:b"))).status).toBe(400);
    expect((await GET(pedido(`/api/notas/${idA}/ligacoes`, { autenticado: false }), contextoComId(idA))).status).toBe(401);
  });
});

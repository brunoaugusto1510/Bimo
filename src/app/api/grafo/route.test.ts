import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "@/lib/repositorio-de-notas/memoria";
import type { RepositorioDeNotas } from "@/lib/repositorio-de-notas/tipos";
import { SEGREDO_DE_TESTE, pedido } from "../notas/apoio-de-teste";

const estado = vi.hoisted(() => ({ repo: null as RepositorioDeNotas | null }));
vi.mock("@/lib/repositorio-de-notas", () => ({ obterRepositorio: async () => estado.repo! }));

import { GET } from "./route";

beforeEach(() => {
  process.env.SEGREDO_SESSAO = SEGREDO_DE_TESTE;
  estado.repo = criarRepositorioEmMemoria([
    { titulo: "A", conteudo: "[[B]]" },
    { titulo: "B", conteudo: "" },
  ]);
});

afterEach(() => {
  delete process.env.SEGREDO_SESSAO;
});

describe("GET /api/grafo", () => {
  it("entrega árvore e grafo juntos para atualização sem navegação, sob sessão", async () => {
    const res = await GET(pedido("/api/grafo?comArvore=1"));
    const dados = await res.json(); expect(dados.itens).toHaveLength(2); expect(dados.grafo.nos).toHaveLength(2);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await GET(pedido("/api/grafo?comArvore=1", { autenticado: false }))).status).toBe(401);
  });
  it("devolve nós e arestas pelo id das notas, mais a configuração do grafo", async () => {
    const res = await GET(pedido("/api/grafo"));

    expect(res.status).toBe(200);
    const grafo = await res.json();
    const [a, b] = await estado.repo!.listarResumos();
    expect(grafo.nos).toEqual([
      { tipo: "nota", id: a.id, titulo: "A", grupo: "Raiz" },
      { tipo: "nota", id: b.id, titulo: "B", grupo: "Raiz" },
    ]);
    expect(grafo.arestas).toEqual([{ de: a.id, para: b.id }]);
    expect(grafo.configuracao).toBeDefined();
  });

  it("devolve 401 sem sessão", async () => {
    expect((await GET(pedido("/api/grafo", { autenticado: false }))).status).toBe(401);
  });
});

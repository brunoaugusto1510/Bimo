import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "@/lib/repositorio-de-notas/memoria";
import type { RepositorioDeNotas } from "@/lib/repositorio-de-notas/tipos";
import { SEGREDO_DE_TESTE, pedido } from "../apoio-de-teste";

const estado = vi.hoisted(() => ({ repo: null as RepositorioDeNotas | null }));
vi.mock("@/lib/repositorio-de-notas", () => ({ obterRepositorio: async () => estado.repo! }));

import { GET } from "./route";

beforeEach(() => {
  process.env.SEGREDO_SESSAO = SEGREDO_DE_TESTE;
  estado.repo = criarRepositorioEmMemoria([
    { titulo: "Café", conteudo: "moagem e temperatura" },
    { titulo: "Chá", conteudo: "temperatura da água" },
  ]);
});

afterEach(() => {
  delete process.env.SEGREDO_SESSAO;
});

describe("GET /api/notas/busca", () => {
  it("busca no conteúdo e devolve id, título, pasta e trecho", async () => {
    const res = await GET(pedido("/api/notas/busca?q=moagem"));

    expect(res.status).toBe(200);
    const { resultados } = await res.json();
    expect(resultados).toHaveLength(1);
    expect(resultados[0]).toMatchObject({ titulo: "Café", pasta: null, trecho: expect.stringContaining("moagem") });
    expect(typeof resultados[0].id).toBe("string");
  });

  it("respeita o limite", async () => {
    const res = await GET(pedido("/api/notas/busca?q=temperatura&limite=1"));

    expect((await res.json()).resultados).toHaveLength(1);
  });

  it("devolve 400 sem consulta ou com limite inválido", async () => {
    expect((await GET(pedido("/api/notas/busca"))).status).toBe(400);
    expect((await GET(pedido("/api/notas/busca?q="))).status).toBe(400);
    expect((await GET(pedido("/api/notas/busca?q=a&limite=100"))).status).toBe(400);
  });

  it("devolve 401 sem sessão", async () => {
    expect((await GET(pedido("/api/notas/busca?q=a", { autenticado: false }))).status).toBe(401);
  });
});

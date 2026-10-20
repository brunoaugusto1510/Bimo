import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "@/lib/repositorio-de-notas/memoria";
import { ErroDeConfiguracao } from "@/lib/repositorio-de-notas/config";
import { SEGREDO_DE_TESTE, pedido } from "../apoio-de-teste";

const estado = vi.hoisted(() => ({ obterRepositorio: vi.fn() }));
vi.mock("@/lib/repositorio-de-notas", () => estado);
import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("SEGREDO_SESSAO", SEGREDO_DE_TESTE);
  estado.obterRepositorio.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/notas/tags", () => {
  it("recusa pedidos sem sessão antes de acessar o repositório", async () => {
    expect((await GET(pedido("/api/notas/tags", { autenticado: false }))).status).toBe(401);
    expect(estado.obterRepositorio).not.toHaveBeenCalled();
  });

  it("devolve tags contadas por nota, sem duplicar coluna e texto, em ordem de quantidade e nome", async () => {
    const repo = criarRepositorioEmMemoria([
      { titulo: "A", tags: ["Bimo"], conteudo: "#bimo #zebra #alpha" },
      { titulo: "B", conteudo: "#BIMO" },
    ]);
    estado.obterRepositorio.mockResolvedValue(repo);
    const listar = vi.spyOn(repo, "listarComConteudo");
    const resposta = await GET(pedido("/api/notas/tags"));
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ tags: [
      { nome: "Bimo", quantidade: 2 }, { nome: "alpha", quantidade: 1 }, { nome: "zebra", quantidade: 1 },
    ] });
    await GET(pedido("/api/notas/tags"));
    expect(listar).toHaveBeenCalledTimes(1);
  });

  it("traduz erros de configuração em 503", async () => {
    estado.obterRepositorio.mockRejectedValue(new ErroDeConfiguracao("Falta DATABASE_URL.", ["DATABASE_URL"]));
    const resposta = await GET(pedido("/api/notas/tags"));
    expect(resposta.status).toBe(503);
    expect(await resposta.json()).toEqual({ erro: "Falta DATABASE_URL.", variaveis: ["DATABASE_URL"] });
  });

  it("registra erros inesperados com o contexto da rota e devolve 500 genérico", async () => {
    const erro = new Error("segredo interno");
    estado.obterRepositorio.mockRejectedValue(erro);
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    const resposta = await GET(pedido("/api/notas/tags"));
    expect(resposta.status).toBe(500);
    expect(JSON.stringify(await resposta.json())).not.toContain("segredo interno");
    expect(registro).toHaveBeenCalledWith("GET /api/notas/tags:", erro);
  });
});

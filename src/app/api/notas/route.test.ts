import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "@/lib/repositorio-de-notas/memoria";
import { ErroDeConfiguracao } from "@/lib/repositorio-de-notas/config";
import type { RepositorioDeNotas } from "@/lib/repositorio-de-notas/tipos";
import { LIMITE_DO_CORPO_EM_BYTES } from "@/lib/http-de-notas";
import { SEGREDO_DE_TESTE, pedido } from "./apoio-de-teste";

const estado = vi.hoisted(() => ({ repo: null as RepositorioDeNotas | null, erro: null as Error | null }));
vi.mock("@/lib/repositorio-de-notas", () => ({
  obterRepositorio: async () => {
    if (estado.erro) throw estado.erro;
    return estado.repo!;
  },
}));

import { GET, POST } from "./route";

beforeEach(() => {
  process.env.SEGREDO_SESSAO = SEGREDO_DE_TESTE;
  estado.repo = criarRepositorioEmMemoria([{ titulo: "Existente", pasta: "Pasta", conteudo: "texto" }]);
  estado.erro = null;
});

afterEach(() => {
  delete process.env.SEGREDO_SESSAO;
  vi.restoreAllMocks();
});

describe("GET /api/notas", () => {
  it("lista os resumos (sem o texto) e as capacidades", async () => {
    const res = await GET(pedido("/api/notas"));

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.capacidades).toEqual({ escrita: true, datas: true });
    expect(corpo.notas).toHaveLength(1);
    expect(corpo.notas[0]).toMatchObject({ titulo: "Existente", pasta: "Pasta" });
    expect(corpo.notas[0]).not.toHaveProperty("conteudo");
  });

  it("devolve 401 sem sessão", async () => {
    expect((await GET(pedido("/api/notas", { autenticado: false }))).status).toBe(401);
  });

  it("devolve 503 com a lista de variáveis quando a fonte não está configurada", async () => {
    estado.erro = new ErroDeConfiguracao("Falta DATABASE_URL.", ["DATABASE_URL"]);

    const res = await GET(pedido("/api/notas"));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ erro: "Falta DATABASE_URL.", variaveis: ["DATABASE_URL"] });
  });

  it("devolve 500 genérico, sem vazar a mensagem, quando o repositório quebra", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    estado.erro = new Error('relation "notas" does not exist');

    const res = await GET(pedido("/api/notas"));

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("relation");
  });
});

describe("POST /api/notas", () => {
  it("cria a nota e devolve 201 com ela", async () => {
    const res = await POST(pedido("/api/notas", { metodo: "POST", corpo: { titulo: " Nova ", pasta: "A/B", conteudo: "oi" } }));

    expect(res.status).toBe(201);
    const { nota } = await res.json();
    expect(nota).toMatchObject({ titulo: "Nova", pasta: "A/B", conteudo: "oi", revisao: 1 });
    expect(await estado.repo!.obterNota(nota.id)).not.toBeNull();
  });

  it("devolve 409 com o id da nota que já usa o título", async () => {
    const [existente] = await estado.repo!.listarResumos();

    const res = await POST(pedido("/api/notas", { metodo: "POST", corpo: { titulo: "existente", pasta: "Pasta" } }));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ tipo: "titulo-em-uso", idExistente: existente.id });
  });

  it("devolve 400 com a mensagem de validação", async () => {
    const res = await POST(pedido("/api/notas", { metodo: "POST", corpo: { titulo: "A/B" } }));

    expect(res.status).toBe(400);
    expect((await res.json()).erro).toMatch(/não pode conter/);
  });

  it("devolve 400 para JSON inválido, 415 para outro Content-Type e 413 para corpo grande", async () => {
    expect((await POST(pedido("/api/notas", { metodo: "POST", corpo: "{ quebrado" }))).status).toBe(400);
    expect(
      (await POST(pedido("/api/notas", { metodo: "POST", corpo: "x", cabecalhos: { "content-type": "text/plain" } }))).status,
    ).toBe(415);
    const grande = { titulo: "A", conteudo: "a".repeat(LIMITE_DO_CORPO_EM_BYTES) };
    expect((await POST(pedido("/api/notas", { metodo: "POST", corpo: grande }))).status).toBe(413);
  });

  it("devolve 403 para pedido de outra origem, sem criar nada", async () => {
    const res = await POST(
      pedido("/api/notas", {
        metodo: "POST",
        corpo: { titulo: "X" },
        cabecalhos: { origin: "https://site-malicioso.example" },
      }),
    );

    expect(res.status).toBe(403);
    expect(await estado.repo!.listarResumos()).toHaveLength(1);
  });

  it("devolve 403 quando o repositório é somente leitura", async () => {
    estado.repo = { ...estado.repo!, capacidades: { escrita: false, datas: false }, criarNota: async () => ({ tipo: "somente-leitura" }) };

    const res = await POST(pedido("/api/notas", { metodo: "POST", corpo: { titulo: "X" } }));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ tipo: "somente-leitura" });
  });

  it("devolve 401 sem sessão", async () => {
    const res = await POST(pedido("/api/notas", { metodo: "POST", corpo: { titulo: "X" }, autenticado: false }));

    expect(res.status).toBe(401);
  });
});

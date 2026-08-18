import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agente", () => ({
  responder: vi.fn(),
}));

import { responder } from "@/lib/agente";
import { NOME_DO_COOKIE, criarTokenDeSessao } from "@/lib/sessao";
import { POST } from "./route";

const SEGREDO = "um-segredo-de-testes-com-mais-de-32-caracteres";

/** A rota exige sessão, então todo pedido de teste já vai com cookie válido. */
function cookieValido(): string {
  return `${NOME_DO_COOKIE}=${criarTokenDeSessao()}`;
}

function requisicao(corpo: unknown, autenticado = true): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(autenticado ? { cookie: cookieValido() } : {}),
    },
    body: JSON.stringify(corpo),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SEGREDO_SESSAO = SEGREDO;
});

afterEach(() => {
  delete process.env.SEGREDO_SESSAO;
});

describe("POST /api/chat", () => {
  it("chama responder() com o histórico e devolve 200 com o resultado", async () => {
    vi.mocked(responder).mockResolvedValue({ resposta: "Oi!", ferramentas: [] });

    const res = await POST(
      requisicao({ mensagens: [{ papel: "usuario", conteudo: "Olá" }] }),
    );

    expect(res.status).toBe(200);
    expect(responder).toHaveBeenCalledWith([{ papel: "usuario", conteudo: "Olá" }]);
    await expect(res.json()).resolves.toEqual({ resposta: "Oi!", ferramentas: [] });
  });

  it("devolve 400 quando o corpo não é JSON válido", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: cookieValido() },
      body: "isso não é json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(responder).not.toHaveBeenCalled();
  });

  it("devolve 400 quando 'mensagens' está ausente", async () => {
    const res = await POST(requisicao({}));
    expect(res.status).toBe(400);
    expect(responder).not.toHaveBeenCalled();
  });

  it("devolve 400 quando 'mensagens' é um array vazio", async () => {
    const res = await POST(requisicao({ mensagens: [] }));
    expect(res.status).toBe(400);
  });

  it("devolve 400 quando uma mensagem tem 'papel' inválido", async () => {
    const res = await POST(
      requisicao({ mensagens: [{ papel: "sistema", conteudo: "oi" }] }),
    );
    expect(res.status).toBe(400);
    expect(responder).not.toHaveBeenCalled();
  });

  it("devolve 400 quando 'conteudo' está vazio", async () => {
    const res = await POST(
      requisicao({ mensagens: [{ papel: "usuario", conteudo: "   " }] }),
    );
    expect(res.status).toBe(400);
  });

  it("devolve 500 com a mensagem de erro quando responder() lança exceção", async () => {
    vi.mocked(responder).mockRejectedValue(
      new Error("GEMINI_API_KEY não está definida."),
    );

    const res = await POST(
      requisicao({ mensagens: [{ papel: "usuario", conteudo: "oi" }] }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      erro: "GEMINI_API_KEY não está definida.",
    });
  });

  /*
   * A rota já é protegida pelo `proxy.ts`, mas ela também confere por conta
   * própria — então estes casos garantem que a segunda tranca funciona mesmo se
   * o `matcher` do proxy mudar.
   */
  it("devolve 401 e não chama o agente quando não há cookie de sessão", async () => {
    const res = await POST(
      requisicao({ mensagens: [{ papel: "usuario", conteudo: "oi" }] }, false),
    );

    expect(res.status).toBe(401);
    expect(responder).not.toHaveBeenCalled();
  });

  it("devolve 401 e não chama o agente quando o cookie está adulterado", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${NOME_DO_COOKIE}=9999999999999.assinatura-inventada`,
      },
      body: JSON.stringify({ mensagens: [{ papel: "usuario", conteudo: "oi" }] }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(responder).not.toHaveBeenCalled();
  });

  it("recusa antes de validar o corpo, para não vazar o formato esperado", async () => {
    const res = await POST(requisicao({ mensagens: [] }, false));

    // Corpo inválido *e* sem sessão: a auth vem primeiro, então 401 (não 400).
    expect(res.status).toBe(401);
  });
});

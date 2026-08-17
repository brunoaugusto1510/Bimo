import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agente", () => ({
  responder: vi.fn(),
}));

import { responder } from "@/lib/agente";
import { POST } from "./route";

function requisicao(corpo: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
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
      headers: { "Content-Type": "application/json" },
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
});

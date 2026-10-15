import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuscaWebError, buscarPagina } from "../busca-web";

function respostaFalsa(
  corpo: string,
  opts: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(corpo, {
    status: opts.status ?? 200,
    headers: { "content-type": "text/html", ...opts.headers },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buscarPagina", () => {
  it("busca a página e devolve o conteúdo e o tipo MIME (sem parâmetros de charset)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      respostaFalsa("<html><body>Olá</body></html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );

    const resultado = await buscarPagina("https://exemplo.com/artigo");

    expect(resultado.tipoMime).toBe("text/html");
    expect(resultado.conteudo.toString()).toContain("Olá");
  });

  it("rejeita esquemas que não sejam http/https", async () => {
    await expect(buscarPagina("file:///etc/passwd")).rejects.toThrow(BuscaWebError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejeita localhost", async () => {
    await expect(buscarPagina("http://localhost:3000/admin")).rejects.toThrow(BuscaWebError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejeita IPs privados (ex.: 10.x)", async () => {
    await expect(buscarPagina("http://10.0.0.5/interno")).rejects.toThrow(BuscaWebError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejeita o endereço de metadata de nuvem (169.254.169.254)", async () => {
    await expect(buscarPagina("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
      BuscaWebError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("segue um redirecionamento pra um host seguro", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://exemplo.com/final" } }),
      )
      .mockResolvedValueOnce(respostaFalsa("conteúdo final"));

    const resultado = await buscarPagina("https://exemplo.com/inicial");

    expect(resultado.conteudo.toString()).toBe("conteúdo final");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejeita quando o redirecionamento aponta pra um host bloqueado (SSRF via redirect)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
    );

    await expect(buscarPagina("https://exemplo.com/inicial")).rejects.toThrow(BuscaWebError);
  });

  it("rejeita quando a resposta não é ok", async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFalsa("não encontrado", { status: 404 }));

    await expect(buscarPagina("https://exemplo.com/nao-existe")).rejects.toThrow(BuscaWebError);
  });

  it("rejeita quando o content-length declarado excede o limite", async () => {
    vi.mocked(fetch).mockResolvedValue(
      respostaFalsa("x", { headers: { "content-length": String(50 * 1024 * 1024) } }),
    );

    await expect(buscarPagina("https://exemplo.com/arquivo-grande")).rejects.toThrow(BuscaWebError);
  });
});

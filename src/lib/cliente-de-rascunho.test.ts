import { afterEach, describe, expect, it, vi } from "vitest";
import { ErroDoCliente } from "./cliente-de-notas";
import { pedirRascunho } from "./cliente-de-rascunho";

const pedido = { acao: "continuar", titulo: "Nota", antes: "Texto", depois: "", trecho: "" } as const;

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("pedirRascunho", () => {
  it("envia o pedido por POST em JSON e devolve o texto", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(Response.json({ texto: "continuação" }));
    vi.stubGlobal("fetch", fetchFalso);
    expect(await pedirRascunho(pedido)).toBe("continuação");
    expect(fetchFalso).toHaveBeenCalledWith("/api/bimo/rascunho", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pedido) }));
  });
  it("repassa a mensagem do servidor nas recusas (400, 429, 500)", async () => {
    for (const [status, erro] of [[400, "Selecione um trecho."], [429, "Muitos pedidos seguidos."], [500, "Não consegui gerar o rascunho agora."]] as const) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ erro }, { status })));
      await expect(pedirRascunho(pedido)).rejects.toMatchObject({ message: erro, status });
    }
  });
  it("sem mensagem do servidor, usa uma genérica; resposta sem texto também é erro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("falha", { status: 502 })));
    await expect(pedirRascunho(pedido)).rejects.toMatchObject({ message: "Não consegui gerar o rascunho agora. Tente de novo.", status: 502 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ texto: 3 })));
    await expect(pedirRascunho(pedido)).rejects.toBeInstanceOf(ErroDoCliente);
  });
  it("falha de rede vira ErroDoCliente sem vazar o erro original", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("segredo interno")));
    await expect(pedirRascunho(pedido)).rejects.toMatchObject({ message: "Não consegui falar com o servidor." });
  });
  it("cancelar pelo sinal rejeita com AbortError (a pessoa já sabe que cancelou)", async () => {
    const controle = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_url: string, opcoes: RequestInit) => new Promise((_, rejeitar) => {
      opcoes.signal?.addEventListener("abort", () => rejeitar(new DOMException("abortado", "AbortError")));
    })));
    const promessa = pedirRascunho(pedido, controle.signal);
    controle.abort();
    await expect(promessa).rejects.toMatchObject({ name: "AbortError" });
  });
  it("demorar demais vira uma mensagem clara", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, opcoes: RequestInit) => new Promise((_, rejeitar) => {
      opcoes.signal?.addEventListener("abort", () => rejeitar(new DOMException("abortado", "AbortError")));
    })));
    const promessa = pedirRascunho(pedido);
    const resultado = expect(promessa).rejects.toMatchObject({ message: "O Bimo demorou demais. Tente de novo." });
    await vi.advanceTimersByTimeAsync(40_000);
    await resultado;
  });
});

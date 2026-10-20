import { afterEach, expect, it, vi } from "vitest";
import { salvarNota, ErroDoCliente, buscarPrevia, buscarTags, esquecerPrevias } from "../cliente-de-notas";
afterEach(() => vi.unstubAllGlobals());
it.each([[200, { nota: { id: "1" } }, "ok"], [409, { tipo: "conflito", atual: { id: "1" } }, "conflito"], [409, { tipo: "titulo-em-uso" }, "titulo-em-uso"], [404, {}, "nao-encontrada"], [403, { tipo: "somente-leitura" }, "somente-leitura"]])("mapeia %s %j", async (status, corpo, tipo) => {
  const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status })); vi.stubGlobal("fetch", fetchFalso);
  expect((await salvarNota("a/b", { conteudo: "novo" }, { revisaoBase: 2, checkpoint: true }, { keepalive: true })).tipo).toBe(tipo);
  expect(fetchFalso).toHaveBeenCalledWith("/api/notas/a%2Fb", expect.objectContaining({ method: "PATCH", keepalive: true, body: JSON.stringify({ conteudo: "novo", revisaoBase: 2, checkpoint: true }) }));
});
it("rede e 5xx viram ErroDoCliente", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("segredo")));
  await expect(salvarNota("1", {}, { revisaoBase: 1 })).rejects.toBeInstanceOf(ErroDoCliente);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("falha", { status: 500 })));
  await expect(salvarNota("1", {}, { revisaoBase: 1 })).rejects.toMatchObject({ status: 500 });
});
it("413 vira recusa e o PATCH recebe um prazo de cancelamento", async () => {
  const prazo = vi.spyOn(AbortSignal, "timeout");
  const fetchFalso = vi.fn().mockResolvedValue(new Response("", { status: 413 })); vi.stubGlobal("fetch", fetchFalso);
  expect(await salvarNota("1", { conteudo: "grande" }, { revisaoBase: 1 })).toEqual({ tipo: "grande-demais" });
  expect(prazo).toHaveBeenCalledWith(20000); expect(fetchFalso.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal); prazo.mockRestore();
});
it("repassa notasReescritas quando o servidor informa e omite quando não", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ nota: { id: "1" }, notasReescritas: 3 }))));
  expect(await salvarNota("1", { pasta: "A" }, { revisaoBase: 1 })).toEqual({ tipo: "ok", nota: { id: "1" }, notasReescritas: 3 });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ nota: { id: "1" } }))));
  expect(await salvarNota("1", { conteudo: "x" }, { revisaoBase: 1 })).toEqual({ tipo: "ok", nota: { id: "1" } });
});
it("400 de validação repassa o motivo do servidor", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: "Use no máximo 30 tags." }), { status: 400 })));
  await expect(salvarNota("1", { tags: [] }, { revisaoBase: 1 })).rejects.toMatchObject({ message: "Use no máximo 30 tags.", status: 400 });
});
it("buscarTags devolve a lista do servidor", async () => {
  const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tags: [{ nome: "ideia", quantidade: 2 }] })));
  vi.stubGlobal("fetch", fetchFalso);
  expect(await buscarTags()).toEqual([{ nome: "ideia", quantidade: 2 }]);
  expect(fetchFalso.mock.calls[0][0]).toBe("/api/notas/tags");
});
it("sucesso invalida a prévia antes do próximo pedido", async () => {
  esquecerPrevias();
  const nota = { id: "1", titulo: "Nota", pasta: null, conteudo: "antes" };
  const fetchFalso = vi.fn().mockImplementation(async (_url, opcoes) => new Response(JSON.stringify({ nota: opcoes?.method === "PATCH" ? { ...nota, conteudo: "depois" } : nota })));
  vi.stubGlobal("fetch", fetchFalso); await buscarPrevia("1"); await buscarPrevia("1"); expect(fetchFalso).toHaveBeenCalledTimes(1);
  await salvarNota("1", { conteudo: "depois" }, { revisaoBase: 1 }); await buscarPrevia("1"); expect(fetchFalso).toHaveBeenCalledTimes(3);
});

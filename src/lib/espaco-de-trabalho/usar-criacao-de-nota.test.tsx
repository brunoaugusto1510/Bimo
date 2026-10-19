import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useCriacaoDeNota } from "./usar-criacao-de-nota";
afterEach(() => vi.unstubAllGlobals());
function preparar(escrita = true) {
 const registrar = vi.fn(), abrir = vi.fn();
 const hook = renderHook(() => useCriacaoDeNota({ capacidades: { escrita, datas: true }, notas: [], registrar, abrir }));
 return { ...hook, registrar, abrir };
}
it("ignora duplicação em voo e tenta outro número na colisão automática", async () => {
 let resolver!: (r: Response) => void;
 const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>((r) => resolver = r)).mockResolvedValueOnce(Response.json({ nota: { id: "nova", titulo: "Sem título 1", pasta: null } }, { status: 201 })); vi.stubGlobal("fetch", fetch);
 const { result, registrar, abrir } = preparar();
 let pedido!: Promise<unknown>;
 act(() => { pedido = result.current.criar({ pasta: null }); });
 await act(async () => { await result.current.criar({ pasta: null }); });
 expect(fetch).toHaveBeenCalledTimes(1);
 await act(async () => { resolver(Response.json({ tipo: "titulo-em-uso", idExistente: "outra" }, { status: 409 })); await pedido; });
 expect(fetch).toHaveBeenCalledTimes(2); expect(registrar).toHaveBeenCalled(); expect(abrir).toHaveBeenCalledWith("nova", expect.objectContaining({ alvo: "titulo" }));
});
it("colisão explícita abre existente e somente leitura não faz pedido", async () => {
 const fetch = vi.fn().mockResolvedValue(Response.json({ tipo: "titulo-em-uso", idExistente: "existente" }, { status: 409 })); vi.stubGlobal("fetch", fetch);
 const primeiro = preparar(); await act(async () => { await primeiro.result.current.criar({ titulo: "X", pasta: null }); });
 expect(primeiro.abrir).toHaveBeenCalledWith("existente", expect.anything()); expect(primeiro.result.current.anuncio).toBe("Já existia; abri a nota");
 expect(primeiro.registrar).not.toHaveBeenCalled();
 fetch.mockClear(); const segundo = preparar(false); await act(async () => { await segundo.result.current.criar({ pasta: null }); });
 expect(fetch).not.toHaveBeenCalled(); expect(segundo.result.current.erro).toMatch(/somente leitura/);
});
it("suporta mais de três colisões automáticas", async () => {
 const fetch = vi.fn();
 for (let n = 0; n < 5; n++) fetch.mockResolvedValueOnce(Response.json({ tipo: "titulo-em-uso", idExistente: `n${n}` }, { status: 409 }));
 fetch.mockResolvedValueOnce(Response.json({ nota: { id: "livre", titulo: "Sem título 5", pasta: null } }));
 vi.stubGlobal("fetch", fetch);
 const { result, abrir } = preparar();
 await act(async () => { await result.current.criar({ pasta: null }); });
 expect(abrir).toHaveBeenCalledWith("livre", expect.anything());
});
it("após resposta perdida consulta a lista e abre o título original sem outro POST", async () => {
 const fetch = vi.fn().mockRejectedValueOnce(new TypeError("rede"))
  .mockResolvedValueOnce(Response.json({ itens: [{ tipo: "nota", id: "criada", nome: "Sem título", pasta: null }] }));
 vi.stubGlobal("fetch", fetch);
 const { result, abrir } = preparar();
 await act(async () => { await result.current.criar({ pasta: null }); });
 await act(async () => { await result.current.criar({ pasta: null }); });
 expect(fetch).toHaveBeenCalledTimes(2);
 expect(fetch.mock.calls[1][0]).toBe("/api/grafo?comArvore=1");
 expect(abrir).toHaveBeenCalledWith("criada", expect.objectContaining({ criada: false }));
});
it("reenvio incerto mantém a pasta raiz mesmo após trocar de pasta", async () => {
 const fetch = vi.fn().mockRejectedValueOnce(new TypeError("rede"))
  .mockResolvedValueOnce(Response.json({ itens: [] }))
  .mockResolvedValueOnce(Response.json({ nota: { id: "raiz", titulo: "Sem título", pasta: null } }));
 vi.stubGlobal("fetch", fetch);
 const { result } = preparar();
 await act(async () => { await result.current.criar({ pasta: null }); });
 await act(async () => { await result.current.criar({ pasta: "Outra" }); });
 expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ titulo: "Sem título", pasta: null });
});

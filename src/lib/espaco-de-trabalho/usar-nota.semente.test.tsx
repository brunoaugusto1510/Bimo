import { StrictMode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { buscarNota, salvarNota, semearNota } from "../cliente-de-notas";
import { useNota } from "./usar-nota";

afterEach(() => vi.unstubAllGlobals());
it("semente expira em dez segundos e o primeiro salvamento a invalida", async () => {
 const resposta = { nota: { id: "ttl", titulo: "Nova", conteudo: "", pasta: null, revisao: 1, tags: [], criadoEm: null, atualizadoEm: null }, capacidades: { escrita: true, datas: true } };
 const fetch = vi.fn().mockImplementation(async () => Response.json(resposta)); vi.stubGlobal("fetch", fetch);
 const agora = vi.spyOn(Date, "now").mockReturnValue(100);
 semearNota(resposta); agora.mockReturnValue(10200);
 await buscarNota("ttl"); expect(fetch).toHaveBeenCalledTimes(1);
 semearNota(resposta); await salvarNota("ttl", { conteudo: "novo" }, { revisaoBase: 1 });
 await buscarNota("ttl"); expect(fetch).toHaveBeenCalledTimes(3);
 agora.mockRestore();
});
it("a primeira leitura semeada permanece pronta inclusive no StrictMode, sem GET", async () => {
  const resposta = { nota: { id: "strict", titulo: "Nova", conteudo: "", pasta: null, revisao: 1, tags: [], criadoEm: null, atualizadoEm: null }, capacidades: { escrita: true, datas: true } };
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); semearNota(resposta);
  const { result } = renderHook(() => useNota("strict"), { wrapper: StrictMode });
  expect(result.current.estado).toBe("pronto");
  await waitFor(() => expect(result.current.dados).toEqual(resposta));
  expect(fetch).not.toHaveBeenCalled();
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useLigacoes, useNota } from "./usar-nota";
it("mantém ligações visíveis durante revalidação e falha", async () => {
  const dados = { ligacoes: { entrada: [], saida: [] }, mencoesSemLigacao: [] };
  let rejeitar!: (e: Error) => void;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(dados))).mockImplementationOnce(() => new Promise((_, reject) => { rejeitar = reject; })));
  const { result } = renderHook(() => useLigacoes("1")); await waitFor(() => expect(result.current.dados).toEqual(dados));
  act(() => result.current.recarregar()); expect(result.current.dados).toEqual(dados); expect(result.current.estado).toBe("pronto");
  await act(async () => rejeitar(new Error("rede"))); expect(result.current.dados).toEqual(dados);
});
it("A para B pendente para A guarda dados por id e revalida", async () => {
  const dados = { nota: { id: "A", revisao: 1 }, capacidades: { escrita: true } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(dados))).mockImplementation(() => new Promise(() => {})));
  const { result, rerender } = renderHook(({ id }) => useNota(id), { initialProps: { id: "A" } });
  await waitFor(() => expect(result.current.dados).toEqual(dados));
  rerender({ id: "B" }); expect(result.current.dados).toBeUndefined(); rerender({ id: "A" }); expect(result.current.dados).toEqual(dados);
});
it("aba inativa não busca; ativar revalida", async () => {
  const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ nota: { id: "1" } }))); vi.stubGlobal("fetch", fetchFalso);
  const { rerender } = renderHook(({ ativa }) => useNota("1", ativa), { initialProps: { ativa: false } });
  expect(fetchFalso).not.toHaveBeenCalled(); rerender({ ativa: true }); await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
});

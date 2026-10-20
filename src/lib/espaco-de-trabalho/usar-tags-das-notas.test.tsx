import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const buscarTags = vi.hoisted(() => vi.fn());
vi.mock("../cliente-de-notas", () => ({ buscarTags }));
import { esquecerTagsDasNotas, useTagsDasNotas } from "./usar-tags-das-notas";

beforeEach(() => { vi.useFakeTimers(); esquecerTagsDasNotas(); buscarTags.mockReset().mockResolvedValue([{ nome: "ideia", quantidade: 3 }, { nome: "estudo", quantidade: 1 }]); });
afterEach(() => vi.useRealTimers());

it("não consulta enquanto desabilitado", async () => {
  renderHook(() => useTagsDasNotas(false)); await act(async () => {});
  expect(buscarTags).not.toHaveBeenCalled();
});
it("consulta uma vez ao habilitar e devolve só os nomes, na ordem do servidor", async () => {
  const { result, rerender } = renderHook(({ ligado }) => useTagsDasNotas(ligado), { initialProps: { ligado: true } });
  await act(async () => {});
  expect(result.current).toEqual(["ideia", "estudo"]);
  rerender({ ligado: false }); rerender({ ligado: true }); await act(async () => {});
  expect(buscarTags).toHaveBeenCalledTimes(1);
});
it("dois consumidores compartilham o mesmo pedido", async () => {
  renderHook(() => useTagsDasNotas(true)); renderHook(() => useTagsDasNotas(true)); await act(async () => {});
  expect(buscarTags).toHaveBeenCalledTimes(1);
});
it("autosave comum não refaz a consulta", async () => {
  renderHook(() => useTagsDasNotas(true)); await act(async () => {});
  act(() => { window.dispatchEvent(new CustomEvent("bimo:nota-salva", { detail: { id: "1", checkpoint: false } })); });
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(buscarTags).toHaveBeenCalledTimes(1);
});
it("depois de um checkpoint, refaz a consulta com atraso", async () => {
  const { result } = renderHook(() => useTagsDasNotas(true)); await act(async () => {});
  buscarTags.mockResolvedValue([{ nome: "nova", quantidade: 1 }]);
  act(() => { window.dispatchEvent(new CustomEvent("bimo:nota-salva", { detail: { id: "1", checkpoint: true } })); });
  expect(buscarTags).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(buscarTags).toHaveBeenCalledTimes(2); expect(result.current).toEqual(["nova"]);
});
it("falha vira lista vazia e a próxima tentativa consulta de novo", async () => {
  buscarTags.mockRejectedValueOnce(new Error("rede"));
  const { result, rerender } = renderHook(({ ligado }) => useTagsDasNotas(ligado), { initialProps: { ligado: true } });
  await act(async () => {}); expect(result.current).toEqual([]);
  rerender({ ligado: false }); rerender({ ligado: true }); await act(async () => {});
  expect(buscarTags).toHaveBeenCalledTimes(2); expect(result.current).toEqual(["ideia", "estudo"]);
});

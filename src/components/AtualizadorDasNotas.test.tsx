import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import AtualizadorDasNotas from "./AtualizadorDasNotas";
import { EVENTO_NOTA_SALVA } from "@/lib/espaco-de-trabalho/usar-edicao-de-nota";
afterEach(() => vi.useRealTimers());
it("agrupa salvamentos por API sem exceder uma a cada 10s", async () => {
  const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ itens: [], grafo: {} })));
  vi.stubGlobal("fetch", fetchFalso);
  vi.useFakeTimers(); render(<AtualizadorDasNotas />);
  const salvo = () => window.dispatchEvent(new CustomEvent(EVENTO_NOTA_SALVA, { detail: { checkpoint: true } }));
  await act(async () => salvo()); expect(fetchFalso).toHaveBeenCalledTimes(1);
  await act(async () => { salvo(); salvo(); await vi.advanceTimersByTimeAsync(9999); }); expect(fetchFalso).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(1)); expect(fetchFalso).toHaveBeenCalledTimes(2);
  expect(refresh).not.toHaveBeenCalled();
});
it("falha na API preserva a árvore montada", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
  const atualizar = vi.fn(); render(<><input aria-label="Conversa" defaultValue="texto local" /><AtualizadorDasNotas aoAtualizar={atualizar} /></>);
  const conversa = screen.getByLabelText("Conversa");
  await act(async () => { window.dispatchEvent(new Event(EVENTO_NOTA_SALVA)); });
  expect(screen.getByLabelText("Conversa")).toBe(conversa); expect(atualizar).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
});

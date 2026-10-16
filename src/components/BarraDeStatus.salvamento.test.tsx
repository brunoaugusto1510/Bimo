import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import BarraDeStatus from "./BarraDeStatus";
afterEach(() => vi.useRealTimers());
it("não anuncia estados transitórios, anuncia Salvo com atraso e imediatamente no atalho", async () => {
  vi.useFakeTimers();
  const { rerender } = render(<BarraDeStatus itens={[]} estado="pendente" mensagem="Alterações ainda não salvas" />);
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  rerender(<BarraDeStatus itens={[]} estado="salvando" mensagem="Salvando…" />); await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  rerender(<BarraDeStatus itens={[]} estado="salvo" mensagem="Salvo" />); await act(() => vi.advanceTimersByTimeAsync(1499)); expect(screen.getByRole("status")).toBeEmptyDOMElement();
  await act(() => vi.advanceTimersByTimeAsync(1)); expect(screen.getByRole("status")).toHaveTextContent("Salvo");
  rerender(<BarraDeStatus itens={[]} estado="salvo" mensagem="Salvo" anuncioManual={1} />);
  await act(() => vi.advanceTimersByTimeAsync(0)); expect(screen.getByRole("status")).toBeEmptyDOMElement();
  await act(() => vi.advanceTimersByTimeAsync(1)); expect(screen.getByRole("status")).toHaveTextContent("Salvo");
});
it("erro persiste uma vez mesmo durante tentativas", async () => {
  vi.useFakeTimers();
  const { rerender } = render(<BarraDeStatus itens={[]} estado="erro" mensagem="Falhou" />);
  await act(() => vi.advanceTimersByTimeAsync(0)); const alerta = screen.getByRole("alert"); expect(alerta).toHaveTextContent("Falhou");
  rerender(<BarraDeStatus itens={[]} estado="salvando" mensagem="Salvando…" />); await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.getByRole("alert")).toBe(alerta); expect(alerta).toHaveTextContent("Falhou");
});

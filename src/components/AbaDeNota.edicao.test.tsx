import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AbaDeNota as EstadoDaAba } from "@/lib/espaco-de-trabalho/estado";
const mocks = vi.hoisted(() => ({ salvar: vi.fn(), recarregar: vi.fn() }));
vi.mock("@/lib/cliente-de-notas", async (importar) => ({ ...await importar<object>(), salvarNota: mocks.salvar }));
const nota = { id: "1", titulo: "Nota", pasta: null, tags: [], conteudo: "inicial", revisao: 1, criadoEm: null, atualizadoEm: null };
vi.mock("@/lib/espaco-de-trabalho/usar-nota", () => ({
  useNota: () => ({ estado: "pronto", dados: { nota, capacidades: { escrita: true, datas: true } }, recarregar: mocks.recarregar }),
  useLigacoes: () => ({ estado: "pronto", recarregar: mocks.recarregar }),
}));
import AbaDeNota from "./AbaDeNota";
const aba: EstadoDaAba = { tipo: "nota", chave: "aba-1", historico: { pilha: ["1"], indice: 0 }, modo: "edicao" };
const props = { notas: new Map(), aoVoltar: vi.fn(), aoAvancar: vi.fn(), aoAlternarModo: vi.fn(), aoAbrirNota: vi.fn(), aoCriarNota: vi.fn(), aoPerguntarAoBimo: vi.fn() };
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); mocks.salvar.mockReset().mockImplementation(async (_id, mudancas) => ({ tipo: "ok", nota: { ...nota, ...mudancas, revisao: 2 } }));
  mocks.recarregar.mockClear();
});
afterEach(() => vi.useRealTimers());
it("digitar salva após 3s, anuncia status e refaz ligações; Leitura mantém texto", async () => {
  const { rerender } = render(<AbaDeNota aba={aba} {...props} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "novo texto" } });
  expect(screen.getByText("Alterações ainda não salvas")).toHaveAttribute("aria-hidden", "true");
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(mocks.salvar.mock.calls[0][2]).toEqual({ revisaoBase: 1, checkpoint: false });
  expect(mocks.recarregar).not.toHaveBeenCalled(); expect(screen.getByText("Salvo")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "ainda sem salvar" } });
  rerender(<AbaDeNota aba={{ ...aba, modo: "leitura" }} {...props} />);
  expect(screen.getByText("ainda sem salvar")).toBeInTheDocument(); await act(async () => {});
  expect(mocks.salvar.mock.calls.at(-1)?.[1].conteudo).toBe("ainda sem salvar");
  expect(mocks.salvar.mock.calls.at(-1)?.[2].checkpoint).toBe(true);
  await act(() => vi.advanceTimersByTimeAsync(600)); expect(mocks.recarregar).toHaveBeenCalled();
});
it("Ctrl+S força checkpoint sem esperar debounce", async () => {
  render(<AbaDeNota aba={aba} {...props} />); fireEvent.change(screen.getByRole("textbox"), { target: { value: "nova" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "s", ctrlKey: true }); await act(async () => {});
  expect(mocks.salvar.mock.calls[0][2]).toEqual({ revisaoBase: 1, checkpoint: true });
});
it.each(["manter", "usar", "copiar"])("resolve conflito: %s e mantém foco", async (escolha) => {
  mocks.salvar.mockResolvedValueOnce({ tipo: "conflito", atual: { ...nota, conteudo: "servidor", revisao: 7 } });
  const copiar = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copiar } });
  render(<AbaDeNota aba={aba} {...props} />); fireEvent.change(screen.getByRole("textbox"), { target: { value: "minha" } });
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(screen.getByRole("group", { name: "Conflito de edição" })).toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("minha"); await act(() => vi.advanceTimersByTimeAsync(60000)); expect(mocks.salvar).toHaveBeenCalledTimes(1);
  const nomes = { manter: "Manter minha versão (substitui a salva)", usar: "Usar a versão salva (descarta a minha)", copiar: "Copiar minha versão" };
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: nomes[escolha as keyof typeof nomes] })); });
  if (escolha === "manter") expect(mocks.salvar.mock.calls[1]).toEqual(["1", { conteudo: "minha" }, { revisaoBase: 7, checkpoint: true }, { keepalive: false }]);
  else if (escolha === "usar") { expect(screen.getByRole("textbox")).toHaveValue("servidor"); expect(mocks.salvar).toHaveBeenCalledTimes(1); }
  if (escolha === "copiar") { expect(copiar).toHaveBeenCalledWith("minha"); expect(screen.getByRole("textbox")).toHaveValue("minha"); expect(screen.getByRole("group", { name: "Conflito de edição" })).toBeInTheDocument(); }
  else expect(screen.getByRole("textbox")).toHaveFocus();
});
it("oferece e restaura rascunho recuperável", async () => {
  localStorage.setItem("bimo_rascunho:1", JSON.stringify({ conteudo: "recuperado", revisaoBase: 1, em: 1 }));
  render(<AbaDeNota aba={aba} {...props} />); expect(screen.getByRole("group", { name: "Recuperação de rascunho" })).toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  expect(screen.getByRole("button", { name: "Restaurar rascunho" })).toHaveFocus();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Restaurar rascunho" })); });
  expect(screen.getByRole("textbox")).toHaveValue("recuperado");
});
it("abrir em Leitura não dispara salvamento", async () => {
  render(<AbaDeNota aba={{ ...aba, modo: "leitura" }} {...props} />);
  await act(() => vi.advanceTimersByTimeAsync(60000)); expect(mocks.salvar).not.toHaveBeenCalled();
});

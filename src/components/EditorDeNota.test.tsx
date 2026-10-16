import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import EditorDeNota from "./EditorDeNota";
it("foca o texto, mantém idioma e intercepta Ctrl/Cmd+S com checkpoint", () => {
  const forcar = vi.fn(); const aoMudar = vi.fn();
  render(<EditorDeNota texto="texto" titulo="Teste" focarAoEntrar aoMudar={aoMudar} forcar={forcar} />);
  const editor = screen.getByRole("textbox", { name: "Texto da nota Teste, Markdown" });
  expect(editor).toHaveFocus(); expect(editor).toHaveAttribute("lang", "pt-BR");
  fireEvent.change(editor, { target: { value: "novo" } }); expect(aoMudar).toHaveBeenCalledWith("novo");
  expect(fireEvent.keyDown(editor, { key: "s", ctrlKey: true })).toBe(false);
  fireEvent.keyDown(editor, { key: "s", metaKey: true }); expect(forcar).toHaveBeenCalledWith({ checkpoint: true });
  const outroAtalho = vi.fn(); window.addEventListener("keydown", outroAtalho);
  fireEvent.keyDown(editor, { key: "o", ctrlKey: true }); expect(outroAtalho).toHaveBeenCalled(); window.removeEventListener("keydown", outroAtalho);
});
it("montagem comum não rouba foco e recuperação é descrita", () => {
  render(<EditorDeNota texto="texto" titulo="Nota" aguardandoRecuperacao descricaoRecuperacao="aviso" aoMudar={vi.fn()} forcar={vi.fn()} />);
  const editor = screen.getByRole("textbox"); expect(editor).not.toHaveFocus();
  expect(editor).toHaveAttribute("aria-readonly", "true"); expect(editor).toHaveAttribute("aria-describedby", "aviso");
});

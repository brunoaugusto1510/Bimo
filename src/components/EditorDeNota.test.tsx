import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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
  expect(editor).toHaveAttribute("readonly"); expect(editor).not.toHaveAttribute("aria-readonly"); expect(editor).toHaveAttribute("aria-describedby", "aviso");
});
const SUGESTOES = [
  { id: "1", titulo: "Receitas", pasta: "Cozinha", alvo: "Receitas", intervalos: [[0, 2]] as [number, number][] },
  { id: "2", titulo: "Reunião", pasta: null, alvo: "Reunião", intervalos: [[0, 2]] as [number, number][] },
];
/** O editor é controlado: um pai com estado, como na aba, para o texto digitado ficar. */
function EditorComEstado({ inicial = "", sugerir, ...resto }: { inicial?: string; sugerir?: (consulta: string) => typeof SUGESTOES; ocupado?: boolean }) {
  const [texto, definirTexto] = useState(inicial);
  return <EditorDeNota texto={texto} titulo="Nota" aoMudar={definirTexto} forcar={vi.fn()} sugerirLigacoes={sugerir} {...resto} />;
}
const digitar = (campo: HTMLTextAreaElement, valor: string) => { campo.focus(); fireEvent.change(campo, { target: { value: valor } }); campo.setSelectionRange(valor.length, valor.length); fireEvent.select(campo); };
const editor = () => screen.getByRole("textbox", { name: /Texto da nota/ }) as HTMLTextAreaElement;

it("ao digitar [[ abre as sugestões, liga o campo à lista e anuncia", () => {
  const sugerir = vi.fn().mockReturnValue(SUGESTOES);
  render(<EditorComEstado sugerir={sugerir} />);
  digitar(editor(), "Veja [[re");
  expect(sugerir).toHaveBeenLastCalledWith("re");
  const lista = screen.getByRole("listbox", { name: "Notas para ligar" });
  expect(editor()).toHaveAttribute("aria-autocomplete", "list"); expect(editor()).toHaveAttribute("aria-controls", lista.id);
  expect(editor()).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0].id);
  expect(screen.getByText("2 notas sugeridas. Setas escolhem, Enter insere, Esc fecha.")).toBeInTheDocument();
});
it("a opção ativa tem id próprio da nota: se o topo muda ao digitar, o activedescendant muda", () => {
  let resultados = SUGESTOES;
  render(<EditorComEstado sugerir={() => resultados} />);
  digitar(editor(), "[[re");
  const primeiro = editor().getAttribute("aria-activedescendant");
  resultados = [SUGESTOES[1], SUGESTOES[0]];
  digitar(editor(), "[[reu");
  expect(editor().getAttribute("aria-activedescendant")).not.toBe(primeiro);
  expect(editor().getAttribute("aria-activedescendant")).toBe(screen.getAllByRole("option")[0].id);
});
it("setas mudam a opção ativa em ciclo e Enter insere o alvo fechando com ]]", () => {
  render(<EditorComEstado sugerir={() => SUGESTOES} />);
  digitar(editor(), "Veja [[re");
  const ids = () => screen.getAllByRole("option").map((o) => o.id);
  fireEvent.keyDown(editor(), { key: "ArrowDown" });
  expect(editor().getAttribute("aria-activedescendant")).toBe(ids()[1]);
  fireEvent.keyDown(editor(), { key: "ArrowDown" });
  expect(editor().getAttribute("aria-activedescendant")).toBe(ids()[0]);
  fireEvent.keyDown(editor(), { key: "ArrowUp" });
  expect(editor().getAttribute("aria-activedescendant")).toBe(ids()[1]);
  const enter = fireEvent.keyDown(editor(), { key: "Enter" });
  expect(enter).toBe(false);
  expect(editor()).toHaveValue("Veja [[Reunião]]"); expect(editor().selectionStart).toBe("Veja [[Reunião]]".length);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(screen.getByText("Ligação inserida: «Reunião»")).toBeInTheDocument();
});
it("Tab só insere depois de escolher com as setas; sozinho segue sendo sair do campo", () => {
  render(<EditorComEstado sugerir={() => SUGESTOES} />);
  digitar(editor(), "[[re");
  expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(true);
  expect(editor()).toHaveValue("[[re");
  fireEvent.keyDown(editor(), { key: "ArrowDown" });
  expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(false);
  expect(editor()).toHaveValue("[[Reunião]]");
});
it("clicar numa opção insere sem tirar o foco do campo (mousedown cancelado, o click escolhe)", () => {
  render(<EditorComEstado sugerir={() => SUGESTOES} />);
  digitar(editor(), "[[r");
  const opcao = screen.getAllByRole("option")[1];
  const evento = new MouseEvent("mousedown", { bubbles: true, cancelable: true }); opcao.dispatchEvent(evento);
  expect(evento.defaultPrevented).toBe(true); expect(editor()).toHaveValue("[[r");
  fireEvent.click(opcao);
  expect(editor()).toHaveValue("[[Reunião]]"); expect(editor()).toHaveFocus();
});
it("mover o cursor para dentro de uma ligação que já existe não abre a lista nem sequestra as setas", () => {
  render(<EditorComEstado sugerir={() => SUGESTOES} inicial="Veja [[Minha nota]] aqui" />);
  const campo = editor(); campo.focus();
  campo.setSelectionRange(11, 11); fireEvent.select(campo);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(fireEvent.keyDown(campo, { key: "ArrowDown" })).toBe(true); expect(fireEvent.keyDown(campo, { key: "Enter" })).toBe(true);
});
it("Esc é persistente: continuar digitando no mesmo [[ não reabre; um [[ novo abre", () => {
  render(<EditorComEstado sugerir={() => SUGESTOES} />);
  digitar(editor(), "[[re");
  fireEvent.keyDown(editor(), { key: "Escape" });
  digitar(editor(), "[[rec"); expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  digitar(editor(), "[[rec e depois [[no"); expect(screen.getByRole("listbox")).toBeInTheDocument();
});
it("setas com modificador (selecionar, ir ao início) são do campo", () => {
  render(<EditorComEstado sugerir={() => SUGESTOES} />);
  digitar(editor(), "[[re");
  expect(fireEvent.keyDown(editor(), { key: "ArrowDown", shiftKey: true })).toBe(true);
  expect(fireEvent.keyDown(editor(), { key: "ArrowUp", ctrlKey: true })).toBe(true);
  expect(fireEvent.keyDown(editor(), { key: "Enter", shiftKey: true })).toBe(true);
});
it("durante uma renomeação a lista fecha de verdade: as teclas voltam ao campo e ela não reaparece velha", () => {
  const { rerender } = render(<EditorComEstado sugerir={() => SUGESTOES} />);
  digitar(editor(), "[[re"); expect(screen.getByRole("listbox")).toBeInTheDocument();
  rerender(<EditorComEstado sugerir={() => SUGESTOES} ocupado />);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(fireEvent.keyDown(editor(), { key: "Enter" })).toBe(true);
  expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(true);
  rerender(<EditorComEstado sugerir={() => SUGESTOES} />);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});
it("se o texto mudou por fora enquanto a lista estava aberta, escolher não insere no lugar errado", () => {
  render(<EditorComEstado sugerir={() => SUGESTOES} />);
  digitar(editor(), "texto [[re");
  const campo = editor();
  // Outra aba/conflito trocou o texto por baixo: o `[[` deixou de existir.
  fireEvent.change(campo, { target: { value: "outro texto" } });
  fireEvent.click(screen.queryAllByRole("option")[0] ?? campo);
  expect(editor()).toHaveValue("outro texto");
});
it("Esc fecha sem inserir e não sobe para quem fecharia o editor", () => {
  const aoTeclar = vi.fn(); window.addEventListener("keydown", aoTeclar);
  render(<EditorComEstado sugerir={() => SUGESTOES} />);
  digitar(editor(), "[[re");
  fireEvent.keyDown(editor(), { key: "Escape" });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument(); expect(editor()).toHaveValue("[[re"); expect(aoTeclar).not.toHaveBeenCalled();
  window.removeEventListener("keydown", aoTeclar);
});
it("com a lista fechada, Enter e Tab seguem o comportamento normal", () => {
  render(<EditorComEstado sugerir={() => SUGESTOES} />);
  digitar(editor(), "texto sem gatilho");
  expect(fireEvent.keyDown(editor(), { key: "Enter" })).toBe(true); expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(true);
});
it("sem resultados, o cursor fora do [[ ou depois do ]] a lista não aparece", () => {
  const { rerender } = render(<EditorComEstado sugerir={() => []} />);
  digitar(editor(), "[[zzz"); expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  rerender(<EditorComEstado sugerir={() => SUGESTOES} />);
  digitar(editor(), "[[re]] fim"); expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});
it("não abre com a seção # na consulta, e Enter durante a composição (IME) não insere", () => {
  render(<EditorComEstado sugerir={() => SUGESTOES} />);
  digitar(editor(), "[[Nota#sec"); expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  digitar(editor(), "[[re"); expect(screen.getByRole("listbox")).toBeInTheDocument();
  fireEvent.keyDown(editor(), { key: "Enter", keyCode: 229 }); expect(editor()).toHaveValue("[[re");
});
it("durante a composição de texto a lista não abre; ao terminar, abre", () => {
  render(<EditorComEstado sugerir={() => SUGESTOES} />);
  fireEvent.compositionStart(editor());
  digitar(editor(), "[[re"); expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  fireEvent.compositionEnd(editor());
  expect(screen.getByRole("listbox")).toBeInTheDocument();
});
it("sem a função de sugestões o editor não muda de comportamento", () => {
  render(<EditorComEstado />); digitar(editor(), "[[re");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument(); expect(editor()).not.toHaveAttribute("aria-autocomplete");
});
it("ocupado: somente leitura, aria-busy e aviso falado ligado ao campo", () => {
  const { rerender } = render(<EditorDeNota texto="texto" titulo="Nota" aoMudar={vi.fn()} forcar={vi.fn()} />);
  const editor = screen.getByRole("textbox");
  expect(editor).not.toHaveAttribute("readonly"); expect(editor).toHaveAttribute("aria-busy", "false");
  rerender(<EditorDeNota texto="texto" titulo="Nota" ocupado aoMudar={vi.fn()} forcar={vi.fn()} />);
  expect(editor).toHaveAttribute("readonly"); expect(editor).toHaveAttribute("aria-busy", "true");
  expect(editor).toHaveAccessibleDescription("Atualizando a nota…");
  expect(screen.getByText("Atualizando a nota…")).toHaveAttribute("role", "status");
});

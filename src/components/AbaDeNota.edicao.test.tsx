import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AbaDeNota as EstadoDaAba } from "@/lib/espaco-de-trabalho/estado";
const mocks = vi.hoisted(() => ({ salvar: vi.fn(), recarregar: vi.fn(), renomear: vi.fn(), tags: vi.fn() }));
vi.mock("@/lib/cliente-de-notas", async (importar) => ({ ...await importar<object>(), salvarNota: mocks.salvar, renomearNota: mocks.renomear, buscarTags: mocks.tags }));
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
  mocks.recarregar.mockClear(); mocks.tags.mockReset().mockResolvedValue([{ nome: "estudo", quantidade: 2 }]);
});
afterEach(() => vi.useRealTimers());
it("digitar salva após 3s, anuncia status e refaz ligações; Leitura mantém texto", async () => {
  const { rerender } = render(<AbaDeNota aba={aba} {...props} />);
  fireEvent.change(screen.getByRole("textbox", { name: /Texto da nota/ }), { target: { value: "novo texto" } });
  expect(screen.getByText("Alterações ainda não salvas")).toHaveAttribute("aria-hidden", "true");
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(mocks.salvar.mock.calls[0][2]).toEqual({ revisaoBase: 1, checkpoint: false });
  expect(mocks.recarregar).not.toHaveBeenCalled(); expect(screen.getByText("Salvo")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: /Texto da nota/ }), { target: { value: "ainda sem salvar" } });
  rerender(<AbaDeNota aba={{ ...aba, modo: "leitura" }} {...props} />);
  expect(screen.getByText("ainda sem salvar")).toBeInTheDocument(); await act(async () => {});
  expect(mocks.salvar.mock.calls.at(-1)?.[1].conteudo).toBe("ainda sem salvar");
  expect(mocks.salvar.mock.calls.at(-1)?.[2].checkpoint).toBe(true);
  await act(() => vi.advanceTimersByTimeAsync(600)); expect(mocks.recarregar).toHaveBeenCalled();
});
it("Ctrl+S força checkpoint sem esperar debounce", async () => {
  render(<AbaDeNota aba={aba} {...props} />); fireEvent.change(screen.getByRole("textbox", { name: /Texto da nota/ }), { target: { value: "nova" } });
  fireEvent.keyDown(screen.getByRole("textbox", { name: /Texto da nota/ }), { key: "s", ctrlKey: true }); await act(async () => {});
  expect(mocks.salvar.mock.calls[0][2]).toEqual({ revisaoBase: 1, checkpoint: true });
});
it.each(["manter", "usar", "copiar"])("resolve conflito: %s e mantém foco", async (escolha) => {
  mocks.salvar.mockResolvedValueOnce({ tipo: "conflito", atual: { ...nota, conteudo: "servidor", revisao: 7 } });
  const copiar = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copiar } });
  render(<AbaDeNota aba={aba} {...props} />); fireEvent.change(screen.getByRole("textbox", { name: /Texto da nota/ }), { target: { value: "minha" } });
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(screen.getByRole("group", { name: "Conflito de edição" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveValue("minha"); await act(() => vi.advanceTimersByTimeAsync(60000)); expect(mocks.salvar).toHaveBeenCalledTimes(1);
  const nomes = { manter: "Manter minha versão (substitui a salva)", usar: "Usar a versão salva (descarta a minha)", copiar: "Copiar minha versão" };
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: nomes[escolha as keyof typeof nomes] })); });
  if (escolha === "manter") expect(mocks.salvar.mock.calls[1]).toEqual(["1", { conteudo: "minha" }, { revisaoBase: 7, checkpoint: true }, { keepalive: false }]);
  else if (escolha === "usar") { expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveValue("servidor"); expect(mocks.salvar).toHaveBeenCalledTimes(1); }
  if (escolha === "copiar") { expect(copiar).toHaveBeenCalledWith("minha"); expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveValue("minha"); expect(screen.getByRole("group", { name: "Conflito de edição" })).toBeInTheDocument(); }
  else expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveFocus();
});
it("oferece e restaura rascunho recuperável", async () => {
  localStorage.setItem("bimo_rascunho:1", JSON.stringify({ conteudo: "recuperado", revisaoBase: 1, em: 1 }));
  render(<AbaDeNota aba={aba} {...props} />); expect(screen.getByRole("group", { name: "Recuperação de rascunho" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveAttribute("readonly");
  expect(screen.getByRole("button", { name: "Restaurar rascunho" })).toHaveFocus();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Restaurar rascunho" })); });
  expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveValue("recuperado");
});
it("abrir em Leitura não dispara salvamento", async () => {
  render(<AbaDeNota aba={{ ...aba, modo: "leitura" }} {...props} />);
  await act(() => vi.advanceTimersByTimeAsync(60000)); expect(mocks.salvar).not.toHaveBeenCalled();
});

it("título de nota existente só é editável em Edição com escrita", () => {
 const { rerender } = render(<AbaDeNota aba={aba} {...props} />);
 expect(screen.getByRole("textbox", { name: "Título da nota" })).toHaveValue("Nota");
 rerender(<AbaDeNota aba={{ ...aba, modo: "leitura" }} {...props} />);
 expect(screen.queryByRole("textbox", { name: "Título da nota" })).not.toBeInTheDocument();
 rerender(<AbaDeNota aba={aba} {...props} escritaDisponivel={false} />);
 expect(screen.queryByRole("textbox", { name: "Título da nota" })).not.toBeInTheDocument();
});
it.each([0, 2])("renomear bloqueia editor e anuncia contagem %s sem remontá-lo", async (notasReescritas) => {
 let concluir!: (valor: unknown) => void;
 mocks.renomear.mockImplementationOnce(() => new Promise((r) => { concluir = r; }));
 const registrar = vi.fn();
 render(<AbaDeNota aba={aba} {...props} aoRenomear={registrar} />);
 const campo = screen.getByRole("textbox", { name: "Título da nota" });
 const editor = screen.getByRole("textbox", { name: /Texto da nota/ });
 fireEvent.change(campo, { target: { value: "Novo" } });
 await act(async () => { fireEvent.keyDown(campo, { key: "Enter" }); });
 expect(editor).toHaveAttribute("readonly"); expect(editor).not.toHaveAttribute("aria-readonly"); expect(editor).toHaveAttribute("aria-busy", "true");
 expect(editor).toHaveAccessibleDescription("Atualizando a nota…");
 const salva = { ...nota, titulo: "Novo", conteudo: "[[Novo]]", revisao: 2 };
 await act(async () => concluir({ tipo: "ok", nota: salva, notasReescritas }));
 expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toBe(editor);
 expect(editor).not.toHaveAttribute("readonly"); expect(editor).toHaveAttribute("aria-busy", "false");
 expect(editor).not.toHaveAccessibleDescription("Atualizando a nota…");
 expect(editor).toHaveValue("[[Novo]]"); expect(registrar).toHaveBeenCalledWith(salva);
 expect(screen.getByText(`Título alterado para «Novo»${notasReescritas ? "; 2 notas tiveram ligações atualizadas" : ""}`)).toBeInTheDocument();
});
it("depois do Enter, o foco só vai ao texto quando a renomeação termina e o editor volta a aceitar digitação", async () => {
 let concluir!: (valor: unknown) => void;
 mocks.renomear.mockImplementationOnce(() => new Promise((r) => { concluir = r; }));
 render(<AbaDeNota aba={aba} {...props} />);
 const campo = screen.getByRole("textbox", { name: "Título da nota" });
 const editor = screen.getByRole("textbox", { name: /Texto da nota/ });
 campo.focus(); fireEvent.change(campo, { target: { value: "Novo" } });
 await act(async () => { fireEvent.keyDown(campo, { key: "Enter" }); });
 expect(editor).not.toHaveFocus();
 await act(async () => concluir({ tipo: "ok", nota: { ...nota, titulo: "Novo", revisao: 2 }, notasReescritas: 0 }));
 expect(editor).not.toHaveAttribute("readonly"); expect(editor).toHaveFocus();
});
it("não deixa mudar para Leitura enquanto renomeia e leva o foco ao título", async () => {
 let concluir!: (valor: unknown) => void;
 mocks.renomear.mockImplementationOnce(() => new Promise((r) => { concluir = r; }));
 const alternar = vi.fn();
 render(<AbaDeNota aba={aba} {...props} aoAlternarModo={alternar} />);
 const campo = screen.getByRole("textbox", { name: "Título da nota" });
 fireEvent.change(campo, { target: { value: "Novo" } });
 await act(async () => { fireEvent.keyDown(campo, { key: "Enter" }); });
 fireEvent.click(screen.getByRole("button", { name: "Leitura" }));
 expect(alternar).not.toHaveBeenCalled();
 expect(screen.getByText("Aguarde a atualização terminar antes de mudar para Leitura.")).toBeInTheDocument();
 await act(async () => concluir({ tipo: "ok", nota: { ...nota, titulo: "Novo", revisao: 2 }, notasReescritas: 0 }));
 fireEvent.click(screen.getByRole("button", { name: "Leitura" }));
 expect(alternar).toHaveBeenCalledTimes(1);
});
it("título pendente bloqueia a troca de modo e leva o foco ao campo", () => {
 const alternar = vi.fn();
 render(<AbaDeNota aba={aba} {...props} aoAlternarModo={alternar} />);
 const campo = screen.getByRole("textbox", { name: "Título da nota" });
 fireEvent.change(campo, { target: { value: "Digitando" } });
 fireEvent.click(screen.getByRole("button", { name: "Leitura" }));
 expect(alternar).not.toHaveBeenCalled(); expect(campo).toHaveFocus();
 expect(screen.getByText(/Confirme o título com Enter/)).toBeInTheDocument();
});
it("em Edição, mover a nota de pasta salva como checkpoint, registra a nota e anuncia a contagem", async () => {
 mocks.salvar.mockResolvedValueOnce({ tipo: "ok", nota: { ...nota, pasta: "Ideias", revisao: 2 }, notasReescritas: 2 });
 const registrar = vi.fn();
 render(<AbaDeNota aba={aba} {...props} notas={new Map([["9", { id: "9", titulo: "Outra", pasta: "Ideias", tags: [] }]])} aoRenomear={registrar} />);
 const campo = screen.getByRole("combobox", { name: "Pasta" });
 expect(campo).toHaveValue("Raiz");
 campo.focus(); fireEvent.change(campo, { target: { value: "Ideias" } });
 await act(async () => { fireEvent.keyDown(campo, { key: "Enter" }); });
 expect(mocks.salvar).toHaveBeenCalledWith("1", { pasta: "Ideias" }, { revisaoBase: 1, checkpoint: true });
 expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ pasta: "Ideias" }));
 expect(screen.getByText("Pasta alterada para «Ideias»; 2 notas tiveram ligações atualizadas")).toBeInTheDocument();
});
it("em Edição, adicionar uma tag salva só as tags e sugere as de outras notas", async () => {
 mocks.salvar.mockResolvedValueOnce({ tipo: "ok", nota: { ...nota, tags: ["estudo"], revisao: 2 } });
 const { container } = render(<AbaDeNota aba={aba} {...props} />);
 await act(async () => {});
 expect([...container.querySelectorAll("datalist option")].map((o) => o.getAttribute("value"))).toContain("estudo");
 const campo = screen.getByRole("combobox", { name: "Adicionar tag" });
 fireEvent.change(campo, { target: { value: "#estudo" } });
 await act(async () => { fireEvent.keyDown(campo, { key: "Enter" }); });
 expect(mocks.salvar).toHaveBeenCalledWith("1", { tags: ["estudo"] }, { revisaoBase: 1, checkpoint: true });
 expect(screen.getByText("Tag «estudo» adicionada")).toBeInTheDocument();
});
it("depois de mover, o caminho da nota mostra a pasta nova", async () => {
 mocks.salvar.mockResolvedValueOnce({ tipo: "ok", nota: { ...nota, pasta: "Ideias", revisao: 2 }, notasReescritas: 0 });
 render(<AbaDeNota aba={aba} {...props} />);
 const campo = screen.getByRole("combobox", { name: "Pasta" });
 campo.focus(); fireEvent.change(campo, { target: { value: "Ideias" } });
 await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mover" })); });
 expect(screen.getByRole("navigation", { name: "Caminho da nota" })).toHaveTextContent("Ideias");
});
it("ao navegar para outra nota na mesma aba, pasta e tags recomeçam do zero", async () => {
 const { rerender } = render(<AbaDeNota aba={aba} {...props} />);
 fireEvent.change(screen.getByRole("combobox", { name: "Pasta" }), { target: { value: "Rascunho" } });
 fireEvent.change(screen.getByRole("combobox", { name: "Adicionar tag" }), { target: { value: "pendente" } });
 rerender(<AbaDeNota aba={{ ...aba, historico: { pilha: ["1", "2"], indice: 1 } }} {...props} />);
 await act(async () => {});
 expect(screen.getByRole("combobox", { name: "Pasta" })).toHaveValue("Raiz");
 expect(screen.getByRole("combobox", { name: "Adicionar tag" })).toHaveValue("");
});
it("em Edição, [[ sugere as outras notas e Enter insere o alvo certo (Pasta/Título quando o título se repete)", async () => {
 const notas = new Map([
  ["1", { id: "1", titulo: "Nota", pasta: null, tags: [] }],
  ["2", { id: "2", titulo: "Receitas", pasta: "Cozinha", tags: [] }],
  ["3", { id: "3", titulo: "Reunião", pasta: "Trabalho", tags: [] }],
  ["4", { id: "4", titulo: "Reunião", pasta: "Pessoal", tags: [] }],
 ]);
 render(<AbaDeNota aba={aba} {...props} notas={notas} />);
 const editor = screen.getByRole("textbox", { name: /Texto da nota/ }) as HTMLTextAreaElement;
 editor.focus(); fireEvent.change(editor, { target: { value: "ver [[rece" } });
 expect(screen.getByRole("listbox", { name: "Notas para ligar" })).toBeInTheDocument();
 expect(screen.queryByRole("option", { name: /^Nota/ })).not.toBeInTheDocument();
 fireEvent.keyDown(editor, { key: "Enter" });
 expect(editor).toHaveValue("ver [[Receitas]]");
 fireEvent.change(editor, { target: { value: "ver [[Receitas]] e [[reun" } });
 const opcoes = screen.getAllByRole("option").map((o) => o.getAttribute("aria-label"));
 expect(opcoes.sort()).toEqual(["Reunião, na pasta Pessoal", "Reunião, na pasta Trabalho"]);
 fireEvent.keyDown(editor, { key: "Enter" });
 expect(editor.value).toMatch(/^ver \[\[Receitas\]\] e \[\[(Pessoal|Trabalho)\/Reunião\]\]$/);
});
it("em Leitura pasta e tags são só texto", () => {
 render(<AbaDeNota aba={{ ...aba, modo: "leitura" }} {...props} />);
 expect(screen.queryByRole("combobox", { name: "Pasta" })).not.toBeInTheDocument();
 expect(screen.queryByRole("combobox", { name: "Adicionar tag" })).not.toBeInTheDocument();
});
it("a renomeação em voo de uma nota não trava o editor de outra na mesma aba", async () => {
 mocks.renomear.mockImplementationOnce(() => new Promise(() => {}));
 const { rerender } = render(<AbaDeNota aba={aba} {...props} />);
 const campo = screen.getByRole("textbox", { name: "Título da nota" });
 fireEvent.change(campo, { target: { value: "Novo" } });
 await act(async () => { fireEvent.keyDown(campo, { key: "Enter" }); });
 expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveAttribute("readonly");
 rerender(<AbaDeNota aba={{ ...aba, historico: { pilha: ["1", "2"], indice: 1 } }} {...props} />);
 await act(async () => {});
 expect(screen.getByRole("textbox", { name: /Texto da nota/ })).not.toHaveAttribute("readonly");
});

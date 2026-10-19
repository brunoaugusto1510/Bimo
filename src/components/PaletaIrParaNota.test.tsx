import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarNoConteudo } from "@/lib/cliente-de-notas";
import PaletaIrParaNota from "./PaletaIrParaNota";
vi.mock("@/lib/cliente-de-notas", () => ({ buscarNoConteudo: vi.fn() }));
const buscar = vi.mocked(buscarNoConteudo);
function propriedades() {
  return { aberta: true, notas: [{ id: "a", titulo: "Árvore", pasta: "Ideias" }, { id: "b", titulo: "Leituras", pasta: null }], recentes: ["b"], podeCriar: true, pastaDaCriacao: "Ideias", aoFechar: vi.fn(), aoAbrir: vi.fn(), aoCriar: vi.fn() };
}
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
describe("PaletaIrParaNota", () => {
  it("não monta fechada; foca ao abrir, prende Tab e restaura foco ao fechar", async () => {
    const props = propriedades();
    const usuario = userEvent.setup();
    const { rerender } = render(<><button>Origem</button><PaletaIrParaNota {...props} aberta={false} /></>);
    const origem = screen.getByRole("button", { name: "Origem" });
    origem.focus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<><button>Origem</button><PaletaIrParaNota {...props} /></>);
    const campo = screen.getByRole("combobox", { name: "Buscar nota pelo nome" });
    expect(campo).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    await usuario.tab();
    expect(campo).toHaveFocus();
    await usuario.keyboard("{Escape}");
    expect(props.aoFechar).toHaveBeenCalledOnce();
    rerender(<><button>Origem</button><PaletaIrParaNota {...props} aberta={false} /></>);
    expect(origem).toHaveFocus();
  });
  it("ordena recentes, navega circularmente e abre com Enter e Shift+Enter", async () => {
    const props = propriedades();
    render(<PaletaIrParaNota {...props} />);
    const usuario = userEvent.setup();
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Leituras");
    await usuario.keyboard("{ArrowUp}{Enter}");
    expect(props.aoAbrir).toHaveBeenLastCalledWith("a", { novaAba: false });
    await usuario.keyboard("{ArrowDown}{Shift>}{Enter}{/Shift}");
    expect(props.aoAbrir).toHaveBeenLastCalledWith("b", { novaAba: true });
    const campo = screen.getByRole("combobox");
    expect(document.getElementById(campo.getAttribute("aria-activedescendant")!)).toHaveAttribute("aria-selected", "true");
  });
  it("destaca acentos e abre ao clicar, sem criar título equivalente", async () => {
    const props = propriedades();
    render(<PaletaIrParaNota {...props} />);
    const usuario = userEvent.setup();
    await usuario.type(screen.getByRole("combobox"), "arvore");
    expect(screen.getByText("Árvore", { selector: "strong,mark" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Criar nota/ })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole("option"));
    expect(props.aoAbrir).toHaveBeenCalledWith("a", { novaAba: false });
  });
  it("cria com título aparado e Ctrl+Enter; respeita somente leitura", async () => {
    const props = propriedades();
    const { rerender } = render(<PaletaIrParaNota {...props} />);
    const usuario = userEvent.setup();
    await usuario.type(screen.getByRole("combobox"), "  Nova  ");
    await usuario.keyboard("{Control>}{Enter}{/Control}");
    expect(props.aoCriar).toHaveBeenCalledExactlyOnceWith("Nova", "Ideias");
    rerender(<PaletaIrParaNota {...props} podeCriar={false} />);
    const criar = screen.getByRole("button", { name: /Criar nota/ });
    expect(criar).toHaveAttribute("aria-disabled", "true");
    expect(criar).toHaveAccessibleDescription("Criar notas não está disponível no modo somente leitura.");
    await usuario.keyboard("{Control>}{Enter}{/Control}");
    expect(props.aoCriar).toHaveBeenCalledOnce();
  });
  it("busca após 250ms, cancela a anterior, ignora atrasadas e limita a cinco", async () => {
    vi.useFakeTimers();
    let entregar!: (valor: Awaited<ReturnType<typeof buscarNoConteudo>>) => void;
    buscar.mockImplementationOnce(() => new Promise((resolver) => { entregar = resolver; }));
    buscar.mockResolvedValueOnce(Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, titulo: `Conteúdo ${i}`, pasta: null, trecho: "Trecho encontrado" })));
    const props = propriedades();
    render(<PaletaIrParaNota {...props} />);
    const campo = screen.getByRole("combobox");
    fireEvent.change(campo, { target: { value: "a" } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(buscar).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: "ab" } });
    await act(() => vi.advanceTimersByTimeAsync(249));
    expect(buscar).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    const sinal = buscar.mock.calls[0][2]!;
    expect(buscar).toHaveBeenCalledWith("ab", 5, expect.any(AbortSignal));
    fireEvent.change(campo, { target: { value: "abc" } });
    expect(sinal.aborted).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => entregar([{ id: "velha", titulo: "Atrasada", pasta: null, trecho: "Velho" }]));
    expect(screen.queryByText("Atrasada")).not.toBeInTheDocument();
    expect(screen.getAllByText("Trecho encontrado")).toHaveLength(5);
    fireEvent.click(screen.getByRole("option", { name: /Conteúdo 0/ }));
    expect(props.aoAbrir).toHaveBeenCalledWith("c0", { novaAba: false });
  });
  it("informa falhas e limpa ao apagar a consulta", async () => {
    buscar.mockRejectedValue(new Error("Falha de rede"));
    render(<PaletaIrParaNota {...propriedades()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "abc" } });
    await waitFor(() => expect(buscar).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Não foi possível buscar no conteúdo."));
    expect(screen.getByText("Não foi possível buscar no conteúdo.", { selector: '[aria-hidden="true"]' })).toBeVisible();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(screen.queryByRole("region", { name: "No conteúdo" })).not.toBeInTheDocument();
  });
});

it("cancela o temporizador ao fechar e reinicia a consulta ao reabrir", async () => {
  vi.useFakeTimers();
  const props = propriedades();
  const { rerender } = render(<PaletaIrParaNota {...props} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "ab" } });
  rerender(<PaletaIrParaNota {...props} aberta={false} />);
  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(buscar).not.toHaveBeenCalled();
  rerender(<PaletaIrParaNota {...props} />);
  expect(screen.getByRole("combobox")).toHaveValue("");
  expect(screen.queryByRole("button", { name: /Criar nota/ })).not.toBeInTheDocument();
});

it("aborta uma busca em andamento ao desmontar e ignora sua resposta", async () => {
  vi.useFakeTimers();
  let entregar!: (valor: Awaited<ReturnType<typeof buscarNoConteudo>>) => void;
  buscar.mockImplementationOnce(() => new Promise((resolver) => { entregar = resolver; }));
  const { unmount } = render(<PaletaIrParaNota {...propriedades()} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "ab" } });
  await act(() => vi.advanceTimersByTimeAsync(250));
  const sinal = buscar.mock.calls[0][2]!;
  unmount();
  expect(sinal.aborted).toBe(true);
  await act(async () => entregar([{ id: "a", titulo: "Atrasada", pasta: null, trecho: "Trecho" }]));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("cria por clique na raiz e não abre nem cria com consulta vazia sem resultados", async () => {
  const props = propriedades();
  render(<PaletaIrParaNota {...props} notas={[]} pastaDaCriacao={null} />);
  const usuario = userEvent.setup();
  await usuario.keyboard("{Enter}{Control>}{Enter}{/Control}");
  expect(props.aoAbrir).not.toHaveBeenCalled();
  expect(props.aoCriar).not.toHaveBeenCalled();
  await usuario.type(screen.getByRole("combobox"), "Nova");
  await usuario.click(screen.getByRole("button", { name: "Criar nota «Nova» em Raiz" }));
  expect(props.aoCriar).toHaveBeenCalledExactlyOnceWith("Nova", null);
});

it("conserva Tab no diálogo mesmo após focar uma opção por clique", async () => {
  render(<><PaletaIrParaNota {...propriedades()} /><button>Fora</button></>);
  const usuario = userEvent.setup();
  await usuario.click(screen.getAllByRole("option")[1]);
  await usuario.tab();
  expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
});

it("não cria nem abre ao confirmar uma composição de texto", () => {
  const props = propriedades();
  render(<PaletaIrParaNota {...props} />);
  const campo = screen.getByRole("combobox");
  fireEvent.change(campo, { target: { value: "Nova" } });
  fireEvent.keyDown(campo, { key: "Enter", ctrlKey: true, isComposing: true });
  expect(props.aoCriar).not.toHaveBeenCalled();
  expect(props.aoAbrir).not.toHaveBeenCalled();
});

it("trata teclado no document e fecha somente pelo fundo", async () => {
  const props = propriedades();
  render(<PaletaIrParaNota {...props} />);
  fireEvent.click(screen.getByText("Notas", { selector: "h2" }));
  expect(props.aoFechar).not.toHaveBeenCalled();
  screen.getByRole("combobox").blur();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(screen.getByRole("combobox")).toHaveFocus();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "Nova" } });
  screen.getByRole("combobox").blur();
  fireEvent.keyDown(document, { key: "Enter", ctrlKey: true });
  await act(async () => {});
  expect(props.aoCriar).toHaveBeenCalledWith("Nova", "Ideias");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(props.aoFechar).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("dialog").parentElement!);
  expect(props.aoFechar).toHaveBeenCalledTimes(2);
});

it("anuncia resultados e busca, preserva conteúdo anterior e navega nele", async () => {
  vi.useFakeTimers();
  buscar.mockResolvedValueOnce([{ id: "c", titulo: "Outra", pasta: null, trecho: "Trecho" }]);
  let entregar!: (valor: Awaited<ReturnType<typeof buscarNoConteudo>>) => void;
  buscar.mockImplementationOnce(() => new Promise((resolver) => { entregar = resolver; }));
  const props = propriedades();
  render(<PaletaIrParaNota {...props} />);
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.getByRole("status")).toHaveTextContent("2 resultados");
  const campo = screen.getByRole("combobox");
  fireEvent.change(campo, { target: { value: "zz" } });
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(campo).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("status")).toHaveTextContent("Nenhuma nota encontrada");
  await act(() => vi.advanceTimersByTimeAsync(250));
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(screen.getByRole("status")).toHaveTextContent("1 resultados no conteúdo");
  expect(screen.getByRole("listbox")).toContainElement(screen.getByRole("option", { name: /Outra/ }));
  expect(campo).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(campo, { key: "Enter" });
  expect(props.aoAbrir).toHaveBeenCalledWith("c", { novaAba: false });
  fireEvent.change(campo, { target: { value: "zzz" } });
  await act(() => vi.advanceTimersByTimeAsync(250));
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(screen.getByRole("status")).toHaveTextContent("Buscando no conteúdo…");
  expect(screen.getByRole("option", { name: /Outra/ })).toBeInTheDocument();
  await act(async () => entregar([]));
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
});

it.each(["abrir", "criar"])("não restaura foco anterior ao %s", async (acao) => {
  const props = propriedades();
  const { rerender } = render(<><button>Origem</button><PaletaIrParaNota {...props} aberta={false} /></>);
  const origem = screen.getByRole("button", { name: "Origem" });
  origem.focus();
  rerender(<><button>Origem</button><PaletaIrParaNota {...props} /></>);
  if (acao === "abrir") fireEvent.click(screen.getAllByRole("option")[0]);
  else {
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Nova" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar nota/ }));
  }
  rerender(<><button>Origem</button><PaletaIrParaNota {...props} aberta={false} /></>);
  expect(origem).not.toHaveFocus();
});

it("identifica Esc pelo texto visível e destaca foco e opção ativa", () => {
  render(<PaletaIrParaNota {...propriedades()} />);
  expect(screen.getByRole("button", { name: "Fechar a paleta" })).toBeInTheDocument();
  expect(screen.getByRole("combobox").parentElement?.className).toContain("focus-within:");
  expect(screen.getByRole("option", { selected: true }).className).toContain("border-l-destaque");
});

it("navega entre títulos e conteúdo no mesmo listbox", async () => {
  vi.useFakeTimers();
  buscar.mockResolvedValue([{ id: "c", titulo: "Outra", pasta: null, trecho: "Leituras no texto" }]);
  const props = propriedades();
  render(<PaletaIrParaNota {...props} />);
  const campo = screen.getByRole("combobox");
  fireEvent.change(campo, { target: { value: "Leituras" } });
  await act(() => vi.advanceTimersByTimeAsync(250));
  fireEvent.keyDown(campo, { key: "ArrowDown" });
  const opcao = screen.getByRole("option", { name: /Outra/ });
  expect(opcao).toHaveAttribute("aria-selected", "true");
  expect(campo).toHaveAttribute("aria-activedescendant", opcao.id);
  fireEvent.keyDown(campo, { key: "Enter", shiftKey: true });
  expect(props.aoAbrir).toHaveBeenLastCalledWith("c", { novaAba: true });
  fireEvent.keyDown(campo, { key: "ArrowDown" });
  fireEvent.keyDown(campo, { key: "Enter" });
  expect(props.aoAbrir).toHaveBeenLastCalledWith("b", { novaAba: false });
});

it("restaura foco ao fechar pelo fundo", () => {
  const props = propriedades();
  const { rerender } = render(<><button>Origem</button><PaletaIrParaNota {...props} aberta={false} /></>);
  const origem = screen.getByRole("button", { name: "Origem" });
  origem.focus();
  rerender(<><button>Origem</button><PaletaIrParaNota {...props} /></>);
  fireEvent.click(screen.getByRole("dialog").parentElement!);
  expect(props.aoFechar).toHaveBeenCalledOnce();
  rerender(<><button>Origem</button><PaletaIrParaNota {...props} aberta={false} /></>);
  expect(origem).toHaveFocus();
});
